# Branch Closure Feature — Design Document (Final)

## Latar Belakang

Saat ini branch hanya punya status `active` | `inactive`. Tidak ada mekanisme "tutup cabang" yang
mempertahankan akses baca ke data historis sambil memblokir transaksi baru.

**Masalah utama**: Kalau branch di-set `inactive`, user **tidak bisa akses sama sekali** — termasuk
lihat laporan historis. Ini karena `resolveBranchContext` middleware dan `getMyBranches` filter
`eb.status = 'active'`.

## Tujuan

- Branch yang tutup **tetap bisa diakses** untuk baca data historis (laporan, jurnal, transaksi)
- Branch yang tutup **tidak bisa** dipakai untuk transaksi baru
- Ada tanggal tutup (`closed_at`) untuk audit trail
- `closed` bersifat **permanen dan irreversible** — tidak ada reopen
- Semua data historis sebelum tanggal tutup tetap utuh dan bisa diakses

---

## Database Changes

```sql
-- Tambah kolom ke tabel branches
ALTER TABLE branches ADD COLUMN closed_at  TIMESTAMP DEFAULT NULL;
ALTER TABLE branches ADD COLUMN closed_by  UUID DEFAULT NULL REFERENCES auth_users(id);
ALTER TABLE branches ADD COLUMN closed_reason TEXT DEFAULT NULL;

-- Constraint: closed_at harus terisi kalau status = 'closed', dan NULL kalau tidak
ALTER TABLE branches
  ADD CONSTRAINT chk_closed_at CHECK (
    (status = 'closed' AND closed_at IS NOT NULL) OR
    (status != 'closed' AND closed_at IS NULL)
  );
```

**Tidak perlu migrasi data** — kolom baru nullable, existing rows tetap `NULL`.

Status transition yang valid setelah ini:

| Dari → Ke   | active | inactive | closed |
|-------------|--------|----------|--------|
| active      | —      | ✅       | ✅     |
| inactive    | ✅     | —        | ✅     |
| closed      | ❌     | ❌       | —      |

---

## Critical Design Notes

### Note 1 — Employee branch status vs branch status (gap logis)

Middleware sekarang hanya cek `eb.status = 'active'` (status di tabel `employee_branches`,
bukan di `branches`). Ini dua hal berbeda:

- `eb.status` = status assignment karyawan ke branch (`active | inactive | suspended`)
- `b.status` = status branch itu sendiri (`active | inactive | closed`)

Query middleware harus di-join ke `branches` dan cek keduanya:

```sql
-- SEBELUM (salah konsep):
WHERE e.user_id = $1 AND eb.status = 'active'

-- SESUDAH (benar):
WHERE e.user_id = $1
  AND eb.status = 'active'        -- assignment karyawan masih aktif
  AND b.status IN ('active', 'closed')  -- branch ada dan bukan inactive
-- Lalu: kalau b.status = 'closed' → req.context.is_read_only = true
```

### Note 2 — `POST /:id/close` tidak boleh kena `write-guard`

`write-guard` middleware akan di-apply ke routes berdasarkan branch context **aktif saat ini**
(branch yang sedang dipakai user). `POST /:id/close` adalah operasi **admin terhadap** branch lain,
bukan operasi **di dalam** branch itu. Kalau write-guard di-apply di sini, admin tidak bisa menutup
branch yang sudah closed (circular block).

Solusi: `POST /:id/close` **tidak** pakai `write-guard`. Guard-nya ada di dalam `closeBranch()`
service sendiri (cek `branch.status === 'closed'` → throw error).

### Note 3 — Cache invalidation setelah close

`branchContextCache` TTL 5 menit. Kalau admin close branch, user yang sedang aktif di branch itu
masih bisa write selama maksimal 5 menit. Wajib panggil `invalidateBranchContextCache` segera
setelah `closeBranch()` berhasil.

### Note 4 — `cash_counts` pakai `branch_name`, bukan `branch_id`

Pending validation saat close harus pakai `branch_name` untuk cash counts, bukan join by UUID.
Ini inkonsistensi yang sudah ada di codebase — jangan diperbaiki di sini, ikuti saja konvensinya.

### Note 5 — `bulkUpdateStatus` harus di-guard

`bulkUpdateStatus` di service sekarang hanya allow `['active', 'inactive']`. Pastikan guard ini
tidak diubah — `closed` tidak boleh bisa dicapai lewat bulk endpoint.

---

## Impact Analysis — Backend

### 1. Types & Schema

| File | Perubahan |
|------|-----------|
| `branches/branches.types.ts` | `BranchStatus = 'active' \| 'inactive' \| 'closed'` + tambah field `closed_at`, `closed_by`, `closed_reason` ke `Branch` type |
| `branches/branches.schema.ts` | Update enum: `z.enum(['active', 'inactive', 'closed'])` di response schema saja. `CreateBranchSchema` dan `UpdateBranchSchema` tetap `['active', 'inactive']` — user tidak bisa set `closed` lewat create/update biasa |
| `types/common.types.ts` | `BranchContext` tambah `is_read_only: boolean`, `branch_status: string` |

### 2. Middleware (KRITIS)

**File**: `middleware/branch-context.middleware.ts`

Dua query di middleware (primary branch lookup + explicit branch lookup) keduanya harus diubah:

```typescript
// Query sekarang (salah konsep — filter di employee_branches, bukan branches):
WHERE e.user_id = $1 AND eb.is_primary = true AND eb.status = 'active'

// Query baru:
SELECT eb.*, b.id AS b_id, b.branch_name, b.company_id, b.status AS branch_status
FROM employee_branches eb
JOIN branches b ON b.id = eb.branch_id
JOIN employees e ON e.id = eb.employee_id
WHERE e.user_id = $1
  AND eb.is_primary = true
  AND eb.status = 'active'
  AND b.status IN ('active', 'closed')
LIMIT 1
```

Setelah query, set `is_read_only`:

```typescript
req.context = {
  company_id: row.company_id,
  branch_id: row.branch_id,
  branch_name: row.branch_name,
  employee_id: row.employee_id,
  role_id: row.role_id,
  approval_limit: row.approval_limit,
  is_read_only: row.branch_status === 'closed',  // ← tambah ini
  branch_status: row.branch_status,              // ← tambah ini
}
```

Cache key tidak perlu diubah — cache di-invalidate saat branch di-close (lihat Note 3).

### 3. Write Guard Middleware (BARU)

**File baru**: `middleware/write-guard.middleware.ts`

```typescript
import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types/common.types'
import { sendError } from '../utils/response.util'

export const requireWriteAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.context?.is_read_only) {
    sendError(res, 'Cabang ini sudah tutup. Tidak bisa membuat atau mengubah data.', 403)
    return
  }
  next()
}
```

Apply ke routes **sebelum** permission middleware pada semua mutation endpoints:

```typescript
// Contoh di journal-headers.routes.ts:
router.post('/', requireWriteAccess, canInsert('journals'), ...)
router.put('/:id', requireWriteAccess, canUpdate('journals'), ...)
router.delete('/:id', requireWriteAccess, canDelete('journals'), ...)
```

### 4. Branch Module

#### 4a. `branches.errors.ts` — Tambah 2 error class

```typescript
export class BranchAlreadyClosedError extends BusinessRuleError {
  constructor(id: string | number, branchName?: string) {
    super(
      `Branch '${branchName || id}' is already permanently closed`,
      { rule: 'branch_already_closed', branchId: id, branchName }
    )
    this.name = 'BranchAlreadyClosedError'
  }
}

export class CannotCloseBranchWithPendingDataError extends BusinessRuleError {
  constructor(branchName: string, pendingItems: { journals?: number; cashCounts?: number; posImports?: number }) {
    const details = Object.entries(pendingItems)
      .filter(([, v]) => v && v > 0)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ')
    super(
      `Cannot close branch '${branchName}' — pending data: ${details}`,
      { rule: 'branch_pending_data', branchName, pendingItems }
    )
    this.name = 'CannotCloseBranchWithPendingDataError'
  }
}
```

Tambah ke factory:

```typescript
export const BranchErrors = {
  // ... existing ...
  ALREADY_CLOSED: (id: string | number, branchName?: string) =>
    new BranchAlreadyClosedError(id, branchName),
  PENDING_DATA: (branchName: string, pendingItems: object) =>
    new CannotCloseBranchWithPendingDataError(branchName, pendingItems as any),
}
```

#### 4b. `branches.repository.ts` — Tambah `closeBranch` method

```typescript
async closeBranch(
  id: string,
  userId: string,
  reason: string
): Promise<Branch> {
  const { rows } = await pool.query(
    `UPDATE branches
     SET status = 'closed', closed_at = NOW(), closed_by = $2, closed_reason = $3, updated_by = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, userId, reason]
  )
  return rows[0]
}

// Pending check — journal DRAFT/SUBMITTED di branch ini
async countPendingJournals(branchId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM journal_headers
     WHERE branch_id = $1 AND status IN ('DRAFT', 'SUBMITTED') AND deleted_at IS NULL`,
    [branchId]
  )
  return rows[0].cnt
}

// Pending check — cash counts OPEN (pakai branch_name karena cash_counts tidak store branch_id)
async countOpenCashCounts(branchName: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM cash_counts
     WHERE branch_name = $1 AND status = 'OPEN'`,
    [branchName]
  )
  return rows[0].cnt
}

// Pending check — POS imports yang masih PROCESSING
async countProcessingPosImports(branchId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM pos_imports
     WHERE branch_id = $1 AND status = 'PROCESSING'`,
    [branchId]
  )
  return rows[0].cnt
}
```

> **Note**: `countOpenCashCounts` pakai `branch_name` bukan `branch_id` karena `cash_counts`
> memang tidak store `branch_id`. Ini inkonsistensi existing — tidak diperbaiki di sini.

#### 4c. `branches.service.ts` — Tambah `closeBranch` method

```typescript
async closeBranch(
  id: string,
  userId: string,
  reason: string
): Promise<Branch> {
  // 1. Cek branch ada
  const branch = await branchesRepository.findById(id)
  if (!branch) throw BranchErrors.NOT_FOUND(id)

  // 2. Guard permanen — tidak bisa reopen, tidak bisa close lagi
  if (branch.status === 'closed') {
    throw BranchErrors.ALREADY_CLOSED(id, branch.branch_name)
  }

  // 3. Cek pending data
  const [pendingJournals, openCashCounts, processingImports] = await Promise.all([
    branchesRepository.countPendingJournals(id),
    branchesRepository.countOpenCashCounts(branch.branch_name),
    branchesRepository.countProcessingPosImports(id),
  ])

  const hasPending = pendingJournals > 0 || openCashCounts > 0 || processingImports > 0
  if (hasPending) {
    throw BranchErrors.PENDING_DATA(branch.branch_name, {
      journals: pendingJournals,
      cashCounts: openCashCounts,
      posImports: processingImports,
    })
  }

  // 4. Close branch
  const closed = await branchesRepository.closeBranch(id, userId, reason)

  // 5. Invalidate cache SEGERA — jangan tunggu TTL 5 menit
  const { invalidateBranchContextCache } = require('../../middleware/branch-context.middleware')
  invalidateBranchContextCache(undefined, id) // invalidate semua user yang punya akses ke branch ini

  // 6. Audit log
  await AuditService.log('CLOSE', 'branch', id, userId,
    { status: branch.status },
    { status: 'closed', closed_at: closed.closed_at, reason }
  )

  logInfo('Branch closed permanently', { id, branch_name: branch.branch_name, closed_by: userId })
  return closed
}
```

> **Note cache invalidation**: `invalidateBranchContextCache` sekarang hanya support invalidate
> per user+branch atau semua branch dari satu user. Untuk invalidate semua user yang akses ke
> satu branch, perlu sedikit refactor di `invalidateBranchContextCache` — lihat section
> "Cache Invalidation Refactor" di bawah.

#### 4d. Cache Invalidation Refactor

Fungsi sekarang:
```typescript
export const invalidateBranchContextCache = (userId: string, branchId?: string): void => {
  if (branchId) {
    branchContextCache.delete(`${userId}:${branchId}`)
  } else {
    for (const key of branchContextCache.keys()) {
      if (key.startsWith(`${userId}:`)) branchContextCache.delete(key)
    }
  }
}
```

Perlu tambah overload untuk invalidate by branchId saja (semua user):
```typescript
export const invalidateBranchContextCache = (userId?: string, branchId?: string): void => {
  if (userId && branchId) {
    // Invalidate specific user+branch
    branchContextCache.delete(`${userId}:${branchId}`)
  } else if (userId) {
    // Invalidate semua branch dari satu user
    for (const key of branchContextCache.keys()) {
      if (key.startsWith(`${userId}:`)) branchContextCache.delete(key)
    }
  } else if (branchId) {
    // Invalidate semua user yang punya akses ke branch ini ← BARU
    for (const key of branchContextCache.keys()) {
      if (key.endsWith(`:${branchId}`)) branchContextCache.delete(key)
    }
  }
}
```

#### 4e. `branches.controller.ts` — Tambah handler

```typescript
async closeBranch(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params
  const { reason } = req.body
  const userId = req.user!.id

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    sendError(res, 'Alasan penutupan wajib diisi (minimal 5 karakter)', 400)
    return
  }

  const branch = await branchesService.closeBranch(id, userId, reason.trim())
  sendSuccess(res, branch, 'Branch berhasil ditutup secara permanen')
}
```

#### 4f. `branches.routes.ts` — Tambah route

```typescript
// TIDAK pakai requireWriteAccess — ini operasi admin, bukan operasi dalam branch
// Lihat Note 2
router.post(
  '/:id/close',
  canDelete('branches'),        // reuse delete permission — hanya admin yang bisa
  validateSchema(branchIdSchema),
  (req, res) => branchesController.closeBranch(req, res)
)
```

#### 4g. `branches.service.ts` — Guard di `bulkUpdateStatus`

```typescript
async bulkUpdateStatus(ids: string[], status: string, userId?: string): Promise<void> {
  const validStatuses = ['active', 'inactive']  // 'closed' tetap tidak masuk sini
  if (!validStatuses.includes(status)) throw BranchErrors.INVALID_STATUS(status)
  // ... rest tetap sama
}
```

Sudah benar sekarang — pastikan tidak ada yang mengubah ini saat menambah `'closed'` ke type.

### 5. Employee Branches

**File**: `employee_branches/employee_branches.service.ts`

```typescript
// getMyBranches — include closed branches supaya user bisa switch ke closed branch untuk baca data
async getMyBranches(userId: string): Promise<MyBranchDto[]> {
  const employee = await employeeBranchesRepository.findEmployeeByUserId(userId)
  if (!employee) throw EmployeeBranchErrors.EMPLOYEE_NOT_FOUND()

  const data = await employeeBranchesRepository.findByEmployeeId(employee.id)

  // SEBELUM: .filter(item => item.status === 'active')
  // SESUDAH: include closed branches (branch_status === 'closed')
  return data
    .filter(item =>
      item.status === 'active' &&                              // assignment karyawan masih aktif
      ['active', 'closed'].includes(item.branch.status)       // branch bukan inactive
    )
    .map(item => ({
      branch_id: item.branch_id,
      branch_name: item.branch.branch_name,
      branch_code: item.branch.branch_code,
      company_id: item.branch.company_id,
      employee_id: item.employee_id,
      role_id: item.role_id,
      role_name: item.role.name,
      approval_limit: item.approval_limit,
      status: item.status,
      is_primary: item.is_primary,
      branch_status: item.branch.status,          // ← tambah ini untuk frontend
      is_read_only: item.branch.status === 'closed', // ← tambah ini
    }))
}

// hasActiveBranchAccess — rename + split menjadi 2 fungsi
async hasBranchAccess(userId: string, branchId: string): Promise<boolean> {
  // Untuk akses baca — allow active dan closed
  const employee = await employeeBranchesRepository.findEmployeeByUserId(userId)
  if (!employee) return false
  const assignment = await employeeBranchesRepository.findByEmployeeAndBranch(employee.id, branchId)
  return assignment?.status === 'active' // assignment aktif, branch bisa active atau closed
}

async hasWriteBranchAccess(userId: string, branchId: string): Promise<boolean> {
  // Untuk akses tulis — hanya allow active branch
  // Cek branch status juga
  const branch = await branchesRepository.findById(branchId)
  if (!branch || branch.status !== 'active') return false
  return this.hasBranchAccess(userId, branchId)
}
```

### 6. Branch Dropdowns / Options

| File | Perubahan | Catatan |
|------|-----------|---------|
| `branches/branches.repository.ts` `getActiveOptions()` | `status = 'active'` → `status IN ('active', 'closed')` | Untuk dropdown laporan — include closed |
| `branches/branches.repository.ts` `findByName()` | `status = 'active'` → `status IN ('active', 'closed')` | Lookup by name untuk POS manual entry |
| `cash-flow/cash-flow-sales.repository.ts` baris 700 | `status = 'active'` → `status IN ('active', 'closed')` | Laporan cash flow perlu include closed |
| `cash-flow/cash-flow-sales.repository.ts` baris 849 | Sama | JOIN untuk cash flow |
| `employees/employees.repository.ts` baris 213 | `status = 'active'` → `status IN ('active', 'closed')` | Dropdown assignment karyawan |
| `jobs/processors/pos-journals.processor.ts` | **Tetap `status = 'active'`** | Background job tidak proses closed branch |
| `pos-aggregates/pos-aggregates.service.ts` `validateBranch()` | **Tetap `status !== 'active'` → reject** | POS aggregation tidak untuk closed branch |

### 7. Read Endpoints — Tidak Perlu Diubah

Semua laporan (Trial Balance, Income Statement, Balance Sheet, General Ledger) query by `branch_id`
langsung ke `general_ledger_view` — tidak ada filter branch status. Data tetap tampil untuk closed
branches tanpa perubahan apapun.

---

## Impact Analysis — Frontend

### 1. Types

**File**: `branch_context/types/index.ts`

```typescript
export interface BranchContext {
  branch_id: string
  branch_name: string
  company_id: string
  employee_id: string
  role_id: string
  role_name: string
  approval_limit: number
  is_read_only: boolean       // ← tambah
  branch_status: string       // ← tambah ('active' | 'inactive' | 'closed')
}
```

### 2. Hook — `useBranchAccess`

**File baru**: `branch_context/hooks/useBranchAccess.ts`

```typescript
import { useBranchContextStore } from '../store/branchContext.store'

export const useBranchAccess = () => {
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  return {
    isReadOnly: currentBranch?.is_read_only ?? false,
    branchStatus: currentBranch?.branch_status ?? 'active',
    isClosed: currentBranch?.branch_status === 'closed',
  }
}
```

Pakai hook ini di semua pages yang punya tombol create/edit/delete:

```typescript
const { isReadOnly } = useBranchAccess()

// Hide tombol — bukan disable, karena statusnya permanen
{!isReadOnly && (
  <Button onClick={handleCreate}>Buat Jurnal</Button>
)}
```

### 3. Read-only Banner

Tambah di layout utama (App.tsx atau shell layout):

```tsx
import { useBranchAccess } from '../branch_context/hooks/useBranchAccess'
import { useBranchContextStore } from '../branch_context/store/branchContext.store'

function ReadOnlyBanner() {
  const { isClosed } = useBranchAccess()
  const currentBranch = useBranchContextStore(s => s.currentBranch)

  if (!isClosed) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
      <span>⚠️</span>
      <span>
        Cabang <strong>{currentBranch?.branch_name}</strong> sudah tutup permanen.
        Hanya bisa melihat data historis.
      </span>
    </div>
  )
}
```

### 4. Branch Switcher

**File**: `branch_context/components/BranchSwitcher/BranchSwitcher.tsx`

```tsx
{branches.map((branch) => (
  <option key={branch.branch_id} value={branch.branch_id}>
    {branch.branch_name}
    {branch.branch_status === 'closed' ? ' [Tutup]' : ''}
  </option>
))}
```

### 5. Branch Filter di Laporan

File-file berikut perlu update query parameter — hapus atau ubah filter `status: 'active'`:

| File | Perubahan |
|------|-----------|
| `dashboard/api/useDashboardApi.ts` | `status: 'active'` → hapus filter. Dashboard tetap realtime, closed branch tidak punya data baru tapi history-nya tetap tampil |
| `pos-aggregates/components/PosAggregatesForm.tsx` | `{ status: 'active' }` → `{}` atau `{ status: 'active,closed' }` tergantung API support |
| `accounting/*/pages/*.tsx` (Trial Balance, Income Statement, Balance Sheet) | Branch dropdown gunakan `getActiveOptions` yang sudah diupdate include closed |

### 6. Branch Management Page

**File**: `branches/pages/BranchDetailPage.tsx`

- Tampilkan section "Informasi Penutupan" kalau `branch.status === 'closed'`:
  - Tanggal tutup (`closed_at`)
  - Ditutup oleh (`closed_by` → nama user)
  - Alasan (`closed_reason`)
- Sembunyikan semua tombol edit/update kalau `closed`
- Tombol "Tutup Cabang" hanya tampil kalau `status !== 'closed'`

**File**: `branches/components/BranchTable.tsx`

- Update `statusColors` map: tambah `closed: 'bg-gray-100 text-gray-600'`

**File baru**: `branches/components/CloseBranchModal.tsx`

Gunakan `ConfirmModal` yang sudah ada di `components/ui/ConfirmModal.tsx` sebagai base,
tapi dengan tambahan textarea untuk `reason`:

```tsx
// Tidak extend ConfirmModal langsung — buat komponen sendiri yang mirip polanya
// karena butuh input tambahan (reason)
interface CloseBranchModalProps {
  branch: Branch
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}
```

Isi modal harus jelas bahwa ini **tidak bisa di-undo**:

```
⚠️ Tutup Cabang Permanen

Cabang "[nama]" akan ditutup secara permanen. Tindakan ini tidak dapat dibatalkan.

Setelah ditutup:
• Tidak bisa membuat transaksi baru
• Data historis tetap bisa dilihat
• Status tidak bisa diubah kembali

Alasan penutupan *
[textarea — minimal 5 karakter]

[Batal]  [Tutup Cabang Permanen]
```

---

## Execution Order

### Phase 1 — Database + Backend Core

1. SQL migration: tambah `closed_at`, `closed_by`, `closed_reason`, DB constraint
2. `branches/branches.types.ts` — update `BranchStatus`, tambah field
3. `branches/branches.schema.ts` — update response enum saja, bukan create/update schema
4. `types/common.types.ts` — tambah `is_read_only`, `branch_status` ke `BranchContext`
5. `middleware/branch-context.middleware.ts` — update 2 query, set `is_read_only`, refactor `invalidateBranchContextCache`
6. `employee_branches/employee_branches.service.ts` — update `getMyBranches`, split `hasActiveBranchAccess`
7. `branches/branches.errors.ts` — tambah 2 error class
8. `branches/branches.repository.ts` — tambah `closeBranch`, 3 pending count methods
9. `branches/branches.service.ts` — tambah `closeBranch` method
10. `branches/branches.controller.ts` — tambah handler
11. `branches/branches.routes.ts` — register `POST /:id/close` (tanpa write-guard)
12. Build + test backend

### Phase 2 — Write Guard

13. Buat `middleware/write-guard.middleware.ts`
14. Apply `requireWriteAccess` ke semua mutation routes:
    - `journals/journal-headers.routes.ts` — create, update, delete, submit, approve, post, reverse
    - `pos-imports/pos-aggregates.routes.ts` — create, update, reconcile
    - `pos-imports/pos-imports.routes.ts` — upload, confirm, delete
    - `cash-counts/cash-counts.routes.ts` — create, close
    - `cash-flow/cash-flow-sales.routes.ts` — create, update, delete
    - `bank-statement-import/bank-statement-import.routes.ts` — upload, confirm, manualEntry
    - `reconciliation/bank-reconciliation.routes.ts` — reconcile, autoMatch, createMultiMatch
    - `expense-categorization/expense-categorization.routes.ts` — create, update, delete
15. Build + test: buka closed branch → pastikan semua mutation return 403

### Phase 3 — Branch Dropdowns

16. Update `branches.repository.ts` `getActiveOptions()` dan `findByName()` — include closed
17. Update `cash-flow-sales.repository.ts` — include closed
18. Update `employees.repository.ts` — include closed
19. Build + test

### Phase 4 — Frontend

20. Update `BranchContext` types — tambah `is_read_only`, `branch_status`
21. Buat `useBranchAccess` hook
22. Tambah `ReadOnlyBanner` di layout
23. Update `BranchSwitcher` — badge "[Tutup]"
24. Update pages: hide mutation buttons kalau `isReadOnly`
25. Buat `CloseBranchModal` component
26. Update `BranchDetailPage` — tampil info closure, tombol "Tutup Cabang"
27. Update `BranchTable` — tambah status color untuk `closed`
28. Update branch filter di laporan — include closed branches

### Phase 5 — End-to-End Test

29. Close branch → verify `closed_at` terisi di DB, constraint OK
30. Switch ke closed branch → verify `is_read_only = true` di context, banner tampil
31. Coba create jurnal di closed branch → verify 403
32. Buka laporan Trial Balance untuk closed branch, pilih tanggal sebelum tutup → verify data tampil
33. Coba close lagi branch yang sudah closed → verify error `ALREADY_CLOSED`
34. Coba close branch dengan pending journals → verify error `PENDING_DATA`
35. Verify POS processor dan pos-aggregates tetap skip closed branches

---

## Ringkasan Akses Setelah Branch Tutup

| Skenario | Bisa? | Mekanisme |
|----------|-------|-----------|
| Lihat laporan Trial Balance bulan lalu | ✅ | Laporan query by branch_id, tidak cek status |
| Lihat jurnal lama | ✅ | Journal list/detail, no status filter |
| Lihat POS transactions lama | ✅ | Query by branch_id, no status filter |
| Switch ke closed branch di switcher | ✅ | `getMyBranches` include closed |
| Lihat dashboard (read) | ✅ | Read-only, data historis tampil |
| Buat jurnal baru | ❌ | `write-guard` → 403 |
| Upload POS import | ❌ | `write-guard` → 403 |
| Buat cash count | ❌ | `write-guard` → 403 |
| Edit data lama | ❌ | `write-guard` → 403 |
| POS processor background job | ❌ | `validateBranch` tetap active-only |
| Close branch yang sudah closed | ❌ | `BranchAlreadyClosedError` di service |
| Bulk update status ke closed | ❌ | `validStatuses` guard di `bulkUpdateStatus` |
| Reopen closed branch | ❌ | Tidak ada endpoint, permanen |