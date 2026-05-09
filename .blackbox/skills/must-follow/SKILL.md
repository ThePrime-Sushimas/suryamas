---
name: must-follow
description: Brief description of what this Skill does and when to use it
---

# Must Follow

## Instructions
# Coding Patterns & Contracts

Dokumen ini adalah kontrak eksplisit untuk semua pattern yang WAJIB diikuti saat menulis kode baru. AI dan developer WAJIB baca file ini sebelum membuat modul baru.

---

## Soft Delete

- Semua tabel yang soft-deletable WAJIB punya kolom:
  ```sql
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  ```
- `findById` SELALU filter `deleted_at IS NULL` kecuali method bernama `findByIdIncludeDeleted`
- `softDelete` SELALU set keduanya: `deleted_at = now(), is_deleted = true`
- `restore` SELALU reset keduanya: `deleted_at = NULL, is_deleted = false`
- `findAll`, `search` SELALU include `deleted_at IS NULL` di WHERE

---

## Delete Guard (hasChildren)

- Sebelum `softDelete`, WAJIB cek apakah record masih direferensi tabel lain
- Urutan cek: dari tabel yang paling "dalam" ke "luar"
- Contoh hierarki:
  - `menu_categories` → cek `menu_groups` DAN `menus`
  - `menu_groups` → cek `menus`
  - `wip_items` → cek `recipe_lines`
- Jika ada children aktif (`deleted_at IS NULL`), throw `BusinessRuleError` dengan pesan yang jelas
- Pattern repository:
  ```typescript
  async hasChildren(id: string): Promise<boolean> {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM child_table WHERE parent_id = $1 AND deleted_at IS NULL',
      [id]
    )
    return rows[0].cnt > 0
  }
  ```

---

## Bulk Operations

- `bulkDelete` WAJIB menggunakan database transaction
- Pattern:
  ```typescript
  async bulkDelete(ids: string[], companyId: string, userId: string): Promise<{ success: number; failed: string[] }> {
    const client = await pool.connect()
    const failed: string[] = []
    let success = 0
    try {
      await client.query('BEGIN')
      for (const id of ids) {
        // cek hasChildren per item, skip jika in-use
        const hasChildren = await this.hasChildren(id)
        if (hasChildren) { failed.push(id); continue }
        await client.query(
          'UPDATE table SET deleted_at = now(), is_deleted = true, updated_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL',
          [userId, id, companyId]
        )
        success++
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
    return { success, failed }
  }
  ```
- Jika tidak pakai transaction (acceptable untuk MVP), minimal tangkap error per item dan return partial result

---

## Repository Query Rules

| Method | `deleted_at IS NULL` | `company_id` filter |
|--------|---------------------|---------------------|
| `findAll` | ✅ WAJIB | ✅ WAJIB |
| `findById` | ✅ WAJIB | ✅ WAJIB |
| `search` | ✅ WAJIB | ✅ WAJIB |
| `findByCode` | ✅ WAJIB | ✅ WAJIB |
| `create` | N/A | ✅ WAJIB |
| `update` | ✅ WAJIB (di WHERE) | ✅ WAJIB |
| `softDelete` | ✅ WAJIB (di WHERE) | ✅ WAJIB |
| `restore` | Cek `deleted_at IS NOT NULL` | ✅ WAJIB |

Exception: method khusus untuk restore flow (`findByIdIncludeDeleted`)

---

## Error Handling

- Setiap modul WAJIB punya file `*.errors.ts` dengan custom error classes
- Import dari `'../../utils/errors.base'` (atau sesuai depth)
- Error classes yang WAJIB ada per modul:

| Error Class | Kapan Dipakai |
|-------------|---------------|
| `NotFoundError` | Record tidak ditemukan |
| `ConflictError` | Duplicate (pg error `23505`) |
| `BusinessRuleError` | Pelanggaran business logic (in-use, invalid state, dll) |

- Pattern pengecekan Postgres error:
  ```typescript
  import { isPostgresError } from '../../utils/postgres-error.util'
  
  try {
    // insert/update
  } catch (err: unknown) {
    if (isPostgresError(err, '23505')) throw new DuplicateError(code)
    throw err
  }
  ```

---

## Service Layer Contracts

- `create` → cek duplicate (via unique constraint catch), audit log
- `update` → fetch existing dulu (untuk audit before/after), throw NotFound jika null
- `delete` → fetch existing, cek hasChildren, softDelete, audit log
- `restore` → restore, audit log
- Semua mutasi WAJIB panggil `AuditService.log(action, entity, entityId, userId, before?, after?)`

---

## Controller Layer Contracts

- `company_id` dari `req.context?.company_id` — BUKAN dari query param
- `user_id` dari `req.user?.id`
- Error handling: `await handleError(res, error, req, { action, id? })`
- Response: `sendSuccess(res, data, message, statusCode, pagination?)`
- Validated request: cast di dalam body `(req as CreateReq).validated`

---

## Routes Layer Contracts

- Middleware order: `authenticate → resolveBranchContext → permission → validateSchema`
- Static routes (`/search`, `/bulk/delete`) WAJIB sebelum `/:id`
- Permission per action: `canView`, `canInsert`, `canUpdate`, `canDelete`
- Register module: `PermissionService.registerModule(moduleName, description)`

---

## SQL Schema Contracts

Kolom WAJIB untuk setiap tabel baru:
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
company_id UUID NOT NULL REFERENCES companies(id),
-- ... domain columns ...
is_active BOOLEAN NOT NULL DEFAULT true,
is_deleted BOOLEAN NOT NULL DEFAULT false,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
created_by UUID REFERENCES auth_users(id),
updated_by UUID REFERENCES auth_users(id),
deleted_at TIMESTAMPTZ,
```

Index WAJIB:
```sql
CREATE INDEX idx_{table}_company ON {table}(company_id) WHERE deleted_at IS NULL;
```

Unique constraint WAJIB include `company_id`:
```sql
UNIQUE(company_id, {code_column})
```

---

## Multi-Tenant Safety

- SETIAP query ke tabel yang punya `company_id` WAJIB include `WHERE company_id = $N`
- Tidak ada pengecualian, termasuk untuk internal service calls
- Jika query tidak butuh company_id (misal lookup by PK yang sudah pasti milik company), tambahkan comment eksplisit: `-- company_id already guaranteed by caller`
- Tabel yang TIDAK punya company_id (misal `pos_staging_menus`): dokumentasikan eksplisit apakah data-nya shared atau sudah per-company

---

## N+1 Query Prevention

- DILARANG: loop `for...of` dengan `await query()` di dalam body loop
- Exception HANYA jika jumlah item dijamin <= 10 dan ada comment yang menjelaskan
- Untuk bulk operations, gunakan:
  - `WHERE id = ANY($1::uuid[])` untuk batch fetch
  - `INSERT ... SELECT unnest(...)` untuk batch insert
  - `UPDATE ... FROM (SELECT unnest(...)) d WHERE table.id = d.id` untuk batch update
  - Atau minimal batch dalam chunk 50 item per transaction

---

## Transaction Requirements

- Setiap operasi yang menulis ke > 1 row ATAU > 1 tabel WAJIB dalam transaction
- Bulk operations (sync, import, bulk delete) WAJIB dalam transaction atau per-batch transaction
- Pattern:
  ```typescript
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // ... semua operasi pakai client, BUKAN pool
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
  ```
- PENTING: di dalam transaction, semua query HARUS pakai `client.query()`, bukan `pool.query()`

---

## Error Message ↔ Implementation Contract

- Error message HARUS match persis dengan apa yang dicek di code
- Jika `MenuInUseError` bilang "has active recipes OR COGS calculations", maka KEDUA kondisi itu harus dicek sebelum throw
- Sebelum merge, baca ulang semua custom error message dan verifikasi implementasinya
- Pattern:
  ```typescript
  // Error message mentions 2 conditions → code MUST check both
  const hasRecipes = await repo.hasRecipeLines(id)
  const hasCogs = await repo.hasCogcCalculationLines(id)
  if (hasRecipes || hasCogs) throw new MenuInUseError()
  ```

---

## Identifier Stability

- JANGAN compare by `name` field (bisa di-rename user) — compare by `code` field
- Contoh SALAH:
  ```typescript
  if (row.category_name === 'Makanan') totalFoodCogs += cogs
  ```
- Contoh BENAR:
  ```typescript
  if (row.category_code === 'FOOD') totalFoodCogs += cogs
  ```
- Kalau perlu display name, ambil dari DB tapi compare/branch logic pakai code
- Ini berlaku untuk: category, group, status, type — semua yang punya code + name pair

---

## Dynamic Import Anti-Pattern

- DILARANG: `await (await import('...')).pool.query(...)` di dalam method
- WAJIB: static import di top of file
- Contoh SALAH:
  ```typescript
  const { rows } = await (await import('../../../config/db')).pool.query(...)
  ```
- Contoh BENAR:
  ```typescript
  import { pool } from '../../../config/db'
  // ...
  const { rows } = await pool.query(...)
  ```
- Exception: lazy initialization pattern untuk external services (S3, etc) — documented di Basic.md

---

## Supersede Pattern (untuk re-calculation)

- Kalau modul support re-calculate (COGS, reconciliation, dll):
  1. Check existing record untuk period/scope yang sama
  2. Buat record baru
  3. Set `existing.superseded_by = new.id`
  4. Void jurnal lama jika ada
- JANGAN delete record lama — history harus tersimpan
- List query WAJIB filter `superseded_by IS NULL` untuk hide old records

---

## Fiscal Period Guard

- Semua operasi yang generate jurnal WAJIB check fiscal period is open
- Pattern:
  ```typescript
  const isOpen = await pool.query(
    `SELECT id FROM fiscal_periods
     WHERE company_id = $1 AND is_open = true
       AND period_start <= $2::date AND period_end >= $3::date
     LIMIT 1`,
    [companyId, dateStart, dateEnd]
  )
  if (isOpen.rows.length === 0) throw new PeriodNotOpenError()
  ```
- Ini berlaku untuk: COGS finalize, expense categorization generate journal, manual journal entry

---

## PostgreSQL Array with Nullable Elements

- `unnest($1::uuid[])` dengan null elements bisa error atau produce unexpected results
- Untuk batch INSERT dengan nullable UUID columns, gunakan VALUES list pattern:
  ```typescript
  const valueRows: string[] = []
  const params: unknown[] = []
  let idx = 1
  for (const item of items) {
    valueRows.push(`($${idx}, $${idx+1}, ...)`)
    params.push(item.id, item.nullable_field, ...)
    idx += N
  }
  await pool.query(`INSERT INTO ... VALUES ${valueRows.join(', ')}`, params)
  ```
- Atau gunakan unnest HANYA untuk non-nullable columns

---

## UOM & Cost Calculation Contract

### Arah conversion_factor
```
conversion_factor = "berapa base unit dalam 1 unit ini"
BUKAN "berapa unit ini dalam 1 base unit"

Validasi: is_base_unit = true → conversion_factor WAJIB = 1
Enforced di: Zod schema (refine) + service layer (double guard)
```

### Cost Calculation Pattern
```typescript
// ✅ BENAR:
cost_per_unit = product.average_cost × uom.conversion_factor

// ❌ SALAH:
cost_per_unit = product.average_cost / uom.conversion_factor
```

### Default UOM Priority (untuk auto-fill di form)
Urutan fallback saat pilih ingredient:
1. UOM dengan `is_base_unit = true` (paling reliable)
2. UOM dengan `is_default_purchase_unit = true`
3. `product.default_purchase_unit` (field denormalized di products)
4. `'gram'` (hardcoded fallback)

### WIP vs Product UOM
- Product → punya banyak UOM dengan conversion table → dropdown
- WIP → satu output unit dari `wip_items.uom` → readonly/static

---

## Generated Columns

- Gunakan `GENERATED ALWAYS AS (...) STORED` untuk kalkulasi yang derivatif (percentage, line_cost, dll)
- JANGAN simpan kalkulasi di application layer kalau bisa di DB level
- Contoh:
  ```sql
  cost_percentage NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN selling_price > 0 THEN (estimated_cost / selling_price * 100) ELSE 0 END
  ) STORED,
  ```

---

## Naming Conventions

| Apa | Pattern | Contoh |
|-----|---------|--------|
| Tabel | snake_case plural | `menu_categories` |
| Kolom | snake_case | `category_name` |
| FK kolom | `{parent_singular}_id` | `category_id` |
| Index | `idx_{table}_{columns}` | `idx_menu_groups_category` |
| Unique | `uq_{table}_{columns}` atau inline UNIQUE | |
| Module folder | kebab-case | `menu-categories` |
| File | `{module}.{layer}.ts` | `menu-categories.service.ts` |
| Class | PascalCase | `MenuCategoriesService` |
| Singleton export | camelCase | `menuCategoriesService` |
| Error class | `{Entity}{Type}Error` | `MenuCategoryNotFoundError` |
| Permission module | snake_case | `menu_categories` |
| API route | kebab-case | `/api/v1/menu-categories` |

# Suryamas ERP — Infrastructure & Deployment Guide

## Server
- **Provider**: Hetzner Cloud
- **IP**: 65.108.60.217
- **OS**: Ubuntu 24.04 LTS
- **SSH**: `ssh root@65.108.60.217`
- **Hetzner Console**: https://console.hetzner.com/projects/14361746

## Stack (sudah terinstall)
| Component | Version |
|-----------|---------|
| Node.js | v22.22.2 |
| PostgreSQL | 17.9 |
| Nginx | 1.24.0 |
| PM2 | 6.0.14 |
| Certbot | 2.9.0 |
| Git | 2.43.0 |

## Database
- **Host**: 65.108.60.217 (port 5432)
- **Database**: suryamas_db
- **User**: suryamas
- **Password**: Paulus20june
- **Akses dari lokal**: Via SSH tunnel (JANGAN buka port 5432 di firewall)

### SSH Tunnel
```bash
# Jalankan setelah restart komputer (atau ketik: tunnel)
ssh -f -N -L 5433:localhost:5432 -L 5050:localhost:5050 root@65.108.60.217
```
- Port 5433 → PostgreSQL
- Port 5050 → pgAdmin

### Shortcut (sudah di ~/.zshrc)
```bash
tunnel  # otomatis buat SSH tunnel DB + pgAdmin
```

### DATABASE_URL di .env
```
DATABASE_URL=postgresql://suryamas:Paulus20june@localhost:5433/suryamas_db
```

## Firewall (Hetzner)
| Port | Protocol | Source | Keterangan |
|------|----------|-------|------------|
| 22 | TCP | Any | SSH |
| 80 | TCP | Any | HTTP |
| 443 | TCP | Any | HTTPS |
| 5432 | ❌ | CLOSED | DB via tunnel saja |
| 5050 | ❌ | CLOSED | pgAdmin via tunnel saja |

## Domain
- **DuckDNS**: sushimas.duckdns.org → 65.108.60.217

## Project Path (VPS)
- **Project root**: `/var/www/suryamas`
- **Backend**: `/var/www/suryamas/backend`
- **Frontend**: `/var/www/suryamas/frontend`
- **Backend .env**: `/var/www/suryamas/backend/.env`
- **Frontend .env.production**: di-copy dari `/root/.env.production.suryamas` saat deploy
- **PM2 process name**: `suryamas-backend`

## Storage
- **Cloudflare R2** (S3-compatible)
- Account ID: 0247835e12ab230d40216cf40c965c98
- Buckets: buktisetoran, posimportstemp, jobresults, profilepictures, bankstatementimportstemp
- **PENTING**: S3Client harus pakai `forcePathStyle: true`
- **Env vars** (di VPS `.env`): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

## Monitoring & Alerts
- **Error Logs**: Tabel `error_logs` di PostgreSQL
- **Dashboard**: http://localhost:5173/monitoring
- **Telegram Bot**: SIS Alert (@SIS_Emergency_Bot)
  - Token: 8598592104:AAE4biuIr9QdiqKgQpf5v8L3xDRQ9lO9RT4
  - Chat ID: -5202987932 (Group: Sushimas Monitoring)
  - Semua error otomatis dikirim ke Telegram (tanpa rate limit)

## Migrasi dari Supabase
- **Status**: ✅ Selesai (29 Apr 2026)
- **Supabase lama**: kxymzveitlrsyzjakzjl.supabase.co (masih aktif sebagai backup)
- Database sudah 100% identical: tables, views, functions, enums, triggers, sequences, indexes, foreign keys
- `auth.users` (Supabase) → `public.auth_users` (Hetzner) — semua FK sudah di-remap

## Permission Modules (perm_modules)
Laporan keuangan punya permission terpisah:
| Module | Keterangan |
|--------|-----------|
| journals | Jurnal |
| trial_balance | Neraca Saldo |
| income_statement | Laba Rugi |
| balance_sheet | Neraca |

## Catatan Penting
1. Sebelum dev, pastikan SSH tunnel aktif (`tunnel`)
2. Setelah ubah backend, rebuild: `cd backend && npx tsc`
3. Error dari controller pakai `handleError(res, error, req)` — SELALU pass `req`
4. Semua error otomatis persist ke `error_logs` + kirim Telegram
5. Job failures juga persist ke `error_logs` (via jobs.worker.ts)

## Auto Deploy (GitHub Actions)
- **Flow**: Push ke `main` → GitHub Actions SSH ke VPS → `/root/deploy.sh`
- **Workflow**: `.github/workflows/deploy.yml`
- **Deploy script**: `/root/deploy.sh` (`cd /var/www/suryamas`, git pull, npm install, build, pm2 restart)
- **Secrets** (di GitHub repo settings): `SSH_HOST`, `SSH_USERNAME`, `SSH_PRIVATE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- **Notifications**: Telegram notif on deploy success/failure

### Manual Deploy (jika Actions gagal)
```bash
ssh root@65.108.60.217
/root/deploy.sh
```
# Integration & Sync Patterns

Dokumen ini mendefinisikan kontrak untuk semua modul yang berinteraksi dengan sistem eksternal (POS, bank, third-party API).

---

## POS Sync Contract

### Query Rules
- SELALU filter by `company_id`, bahkan untuk pos_staging tables
- SELALU dokumentasikan apakah pos_staging table adalah shared atau per-company
- Jika tabel tidak punya `company_id`, dokumentasikan di section "POS Staging Tables — Data Ownership" di design doc modul terkait
- Contoh yang benar:
  ```sql
  -- pos_staging_menus tidak punya company_id (single-company by design)
  -- Documented di FOOD_PRODUCTION_DESIGN.md
  SELECT * FROM pos_staging_menus
  ```
- Contoh yang salah (JANGAN tanpa dokumentasi):
  ```sql
  SELECT * FROM pos_staging_menus  -- WHY no company filter? undocumented!
  ```

### Mapping External IDs ke Internal
- Jangan hardcode external ID (pos_id, flag values, dll) langsung di query SQL inline
- Taruh di konstanta terpisah atau mapping table
- Contoh SALAH:
  ```sql
  CASE psc.pos_id WHEN 2 THEN 'FOOD' WHEN 3 THEN 'BEVERAGE' ELSE 'OTHER' END
  ```
- Contoh BENAR:
  ```typescript
  // food-production/menus/menus.constants.ts
  export const POS_CATEGORY_MAP: Record<number, string> = {
    2: 'FOOD',
    3: 'BEVERAGE',
  }
  export const POS_CATEGORY_FALLBACK = 'OTHER'
  ```
- Atau buat mapping table: `pos_category_mappings(company_id, pos_category_id, menu_category_id)`
- Silent fallback ke default (misal fallback ke 'OTHER') WAJIB disertai log warning

---

## Schema Field Lifecycle

- Setiap field di Zod schema HARUS di-trace sampai ke service/repository
- Field yang ada di schema tapi tidak dipakai = dead code, HARUS dihapus atau diimplementasi
- Checklist sebelum merge:
  ```
  schema field → controller (validated) → service params → repository query
  ```
  Jika ada yang putus di tengah, fix atau hapus
- Contoh SALAH:
  ```typescript
  // schema.ts
  force: z.boolean().optional().default(false),
  // controller.ts
  void (req as SyncReq).validated  // ← field 'force' tidak dipakai!
  ```
- Contoh BENAR:
  ```typescript
  // schema.ts
  force: z.boolean().optional().default(false),
  // controller.ts
  const { body } = (req as SyncReq).validated
  await service.sync(companyId, userId, body.force)  // ← force dipakai
  ```

---

## Sync Function Requirements

Setiap sync function WAJIB memenuhi:

1. **Filter by company_id** — atau dokumentasikan kenapa tidak perlu
2. **Wrapped dalam transaction** — atau per-batch jika data besar
3. **Return result summary**: `{ inserted: number, updated: number, skipped: number }`
4. **Idempotent**: bisa dijalankan ulang tanpa efek samping (gunakan `ON CONFLICT DO NOTHING/UPDATE`)
5. **No N+1**: batch fetch semua data yang dibutuhkan di awal, proses di memory, batch write di akhir

### Pattern Sync yang Benar:
```typescript
async batchSync(companyId: string): Promise<SyncResult> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Batch fetch: semua data source dalam 1 query
    const sourceData = await client.query('SELECT ... FROM source_table')

    // 2. Batch fetch: semua existing records dalam 1 query
    const existing = await client.query('SELECT ... FROM target WHERE company_id = $1', [companyId])
    const existingMap = new Map(existing.rows.map(r => [r.external_id, r]))

    // 3. Classify: loop di memory (bukan query per item)
    const toInsert = [], toUpdate = []
    for (const item of sourceData.rows) {
      const ex = existingMap.get(item.id)
      if (ex) toUpdate.push(...)
      else toInsert.push(...)
    }

    // 4. Batch write: unnest atau VALUES list
    if (toUpdate.length) await client.query('UPDATE ... FROM unnest(...)')
    if (toInsert.length) await client.query('INSERT ... SELECT unnest(...) ON CONFLICT DO NOTHING')

    await client.query('COMMIT')
    return { inserted: toInsert.length, updated: toUpdate.length, skipped: ... }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
```

---

## Bulk Operation Result Contract

- Bulk sync/import SELALU return:
  ```typescript
  interface BulkResult {
    inserted: number
    updated: number
    skipped: number
    errors?: Array<{ id: string; message: string }>
  }
  ```
- Error per item dicatat di array `errors`, tidak throw langsung (kecuali critical/transaction-level error)
- Caller yang decide apakah partial success acceptable

---

## External ID Mapping Rules

- Jangan assume external system tidak berubah
- Semua mapping `external_id → internal_id` harus:
  - Ada di database (bisa di-update tanpa deploy), ATAU
  - Ada di config/constants file dengan comment kenapa nilai tersebut
- Silent fallback ke default WAJIB disertai log warning:
  ```typescript
  const mapped = POS_CATEGORY_MAP[posId]
  if (!mapped) {
    logWarn('Unknown POS category', { posId, fallback: POS_CATEGORY_FALLBACK })
  }
  const categoryCode = mapped ?? POS_CATEGORY_FALLBACK
  ```

---

## Bank Statement / Reconciliation Sync

### Rules
- `bank_account_id` SELALU ada di setiap bank statement
- Saat generate journal, credit account di-override berdasarkan `bank_accounts.coa_account_id`
- Override HANYA terjadi jika credit account dari purpose mapping adalah bank account (cek via Set membership)
- Fallback: jika `bank_accounts.coa_account_id` null → pakai credit dari purpose mapping (behavior lama)

### Pattern
```typescript
// Batch lookup di awal, bukan per-statement
const bankCoaMap = await repo.getBankAccountCoaMap(bankAccountIds, companyId)
const allBankCoaIds = await repo.getAllBankCoaIds(companyId)

// Override di loop (no additional query)
if (stmt.bank_account_id && allBankCoaIds.has(creditAccount.account_id)) {
  const overrideCoa = bankCoaMap.get(stmt.bank_account_id)
  if (overrideCoa) creditAccount = { ...creditAccount, account_id: overrideCoa }
}
```
# Checklist Pembuatan Modul Baru

Gunakan checklist ini setiap kali membuat modul backend baru. Semua item WAJIB dipenuhi sebelum dianggap selesai.

---

## Backend Files

- [ ] `*.types.ts` — interface untuk Entity, WithRelation variant, CreateDto, UpdateDto
- [ ] `*.errors.ts` — NotFoundError, DuplicateError, InUseError (jika punya children)
- [ ] `*.schema.ts` — zod schema: create, update, id, bulkDelete
- [ ] `*.repository.ts` — findAll, findById, search, create, update, softDelete, restore, hasChildren
- [ ] `*.service.ts` — list, search, getById, create, update, delete (dengan guard), restore
- [ ] `*.controller.ts` — list, search, getById, create, update, delete, restore, bulkDelete
- [ ] `*.routes.ts` — register PermissionService, semua endpoint, static routes sebelum /:id

---

## SQL Migration / Table Creation

- [ ] Kolom wajib: `id UUID PK`, `company_id UUID NOT NULL FK`, `created_at`, `updated_at`, `created_by`, `updated_by`
- [ ] Soft delete pair: `is_deleted BOOLEAN NOT NULL DEFAULT false` + `deleted_at TIMESTAMPTZ`
- [ ] Index wajib: `(company_id) WHERE deleted_at IS NULL`
- [ ] Unique constraint include `company_id`: `UNIQUE(company_id, code_column)`
- [ ] Seed data jika diperlukan (default categories, dll)

---

## Relasi & Delete Guard

- [ ] Jika tabel punya parent → FK ke parent, tambahkan di parent's `hasChildren()`
- [ ] Jika tabel punya children → tambahkan `hasChildren()` di repository sendiri
- [ ] Service `delete()` WAJIB panggil `hasChildren()` sebelum `softDelete()`
- [ ] Throw `InUseError` jika ada children aktif

---

## Query Consistency

- [ ] Semua `findById` filter `deleted_at IS NULL`
- [ ] Semua `findAll` filter `deleted_at IS NULL` + `company_id`
- [ ] Semua `search` filter `deleted_at IS NULL` + `company_id`
- [ ] Semua `softDelete` set `is_deleted = true` DAN `deleted_at = now()`
- [ ] Semua `restore` reset `is_deleted = false` DAN `deleted_at = NULL`
- [ ] `update` WHERE clause include `deleted_at IS NULL` (prevent update deleted record)

---

## Audit & Error Handling

- [ ] `AuditService.log()` dipanggil untuk: CREATE, UPDATE, DELETE, RESTORE
- [ ] Semua catch block: `error: unknown`
- [ ] Controller: `await handleError(res, error, req, { action, id? })`
- [ ] Postgres unique violation: `isPostgresError(err, '23505')` → throw DuplicateError

---

## Route Registration

- [ ] Import di `app.ts`
- [ ] `app.use("/api/v1/{route-name}", routes)`
- [ ] Static routes (`/search`, `/bulk/delete`, `/trash`) sebelum `/:id`
- [ ] Middleware order: `authenticate → resolveBranchContext → permission → validateSchema`

---

## Build Verification

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx tsc` (full build) → 0 errors
- [ ] Test endpoint via curl/Postman (minimal: list, create, getById)

---

## Cross-Reference Check (Paling Penting)

Sebelum declare selesai, cross-check:

| Cek | Bagaimana |
|-----|-----------|
| SQL schema vs Repository query | Semua kolom di CREATE TABLE harus match dengan kolom di INSERT/UPDATE query |
| findById vs update/delete | Jika findById filter deleted_at, maka update/delete juga harus |
| Parent service vs Child service | Jika parent punya hasChildren, child harus sudah ada di cek |
| Design doc vs Implementation | Semua tabel di design doc harus match dengan actual CREATE TABLE |
| Error import path | Pastikan import dari `errors.base` bukan `error-registry` |
