# Daily Prep Orders — Design

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React 18 + TypeScript |
| UI Components | shadcn/ui + Tailwind CSS |
| Server State | TanStack Query v5 |
| Forms | react-hook-form + zod |
| Date Handling | date-fns |
| Routing | React Router v6 (sesuaikan dengan router yang dipakai project) |

---

## Struktur File

```
src/modules/daily-prep-orders/
  api/
    dpo.api.ts              ← semua API calls (axios/fetch wrappers)
    dpo.queries.ts          ← TanStack Query hooks
  components/
    DpoStatusBadge.tsx
    DpoGenerateDialog.tsx
    DpoLinesTable.tsx
    DpoConfirmDialog.tsx    ← includes lock + countdown timer logic
    DpoCancelDialog.tsx
    DpoDeleteDialog.tsx
  pages/
    DpoListPage.tsx
    DpoDetailPage.tsx
    DpoConfigPage.tsx
    DpoHolidaysPage.tsx
  types/
    dpo.types.ts
```

---

## Tipe Data

```typescript
// dpo.types.ts

export type DpoStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'

export interface DailyPrepOrderWithRelations {
  id: string
  company_id: string
  branch_id: string
  branch_name: string
  branch_code: string
  dpo_number: string
  prep_date: string
  status: DpoStatus
  source_warehouse_id: string
  source_warehouse_name: string
  target_warehouse_id: string
  target_warehouse_name: string
  weight_7d: number
  weight_30d: number
  weight_dow: number
  coverage_days: number
  holiday_factor_applied: number
  has_upcoming_holiday: boolean
  confirmed_at: string | null
  confirmed_by: string | null
  confirmed_by_name: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  lock_token: string | null
  locked_at: string | null
  notes: string | null
  line_count: number
  created_at: string
  updated_at: string
}

export interface DailyPrepOrderLineWithRelations {
  id: string
  dpo_id: string
  product_id: string
  product_code: string
  product_name: string
  uom: string
  avg_sales_7d: number
  avg_sales_30d: number
  avg_sales_dow: number
  holiday_factor: number
  coverage_days: number
  predicted_need: number
  current_ready_stock: number
  live_ready_stock: number
  current_main_stock: number
  live_main_stock: number
  suggested_qty: number
  confirmed_qty: number | null
  out_movement_id: string | null
  in_movement_id: string | null
  notes: string | null
  sort_order: number
}

export interface DailyPrepOrderDetail extends DailyPrepOrderWithRelations {
  lines: DailyPrepOrderLineWithRelations[]
}

export interface DpoForecastConfig {
  id: string
  branch_id: string
  weight_7d: number
  weight_30d: number
  weight_dow: number
  coverage_days: number
  holiday_factor: number
  lookback_days_short: number
  lookback_days_long: number
  is_active: boolean
}

export interface PublicHoliday {
  id: string
  company_id: string
  holiday_date: string
  holiday_name: string
  created_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
```

---

## API Layer (`dpo.api.ts`)

Semua fungsi return typed response. Gunakan axios instance yang sudah ada di project.

```typescript
// Endpoints yang harus diimplementasikan:

listDpos(params: DpoListParams): Promise<PaginatedResponse<DailyPrepOrderWithRelations>>
getDpoById(id: string): Promise<DailyPrepOrderDetail>
generateDpo(body: GenerateDpoBody): Promise<DailyPrepOrderDetail>
updateDpoLines(id: string, body: UpdateLinesBody): Promise<DailyPrepOrderDetail>
deleteDpoLine(id: string, lineId: string): Promise<DailyPrepOrderDetail>
acquireLock(id: string): Promise<{ lock_token: string }>
confirmDpo(id: string, body: { lock_token: string }): Promise<DailyPrepOrderDetail>
cancelDpo(id: string, body: { reason: string }): Promise<DailyPrepOrderDetail>
softDeleteDpo(id: string): Promise<void>
getForecastConfig(branchId: string): Promise<DpoForecastConfig | null>
upsertForecastConfig(body: UpsertConfigBody): Promise<DpoForecastConfig>
getHolidays(params: { from: string; to: string }): Promise<PublicHoliday[]>
upsertHoliday(body: { holiday_date: string; holiday_name: string }): Promise<PublicHoliday>
deleteHoliday(holidayId: string): Promise<void>
```

---

## Query Keys Convention

```typescript
export const dpoKeys = {
  all: ['dpo'] as const,
  lists: () => [...dpoKeys.all, 'list'] as const,
  list: (params: DpoListParams) => [...dpoKeys.lists(), params] as const,
  details: () => [...dpoKeys.all, 'detail'] as const,
  detail: (id: string) => [...dpoKeys.details(), id] as const,
  config: (branchId: string) => [...dpoKeys.all, 'config', branchId] as const,
  holidays: (year: number) => [...dpoKeys.all, 'holidays', year] as const,
}
```

---

## Sequence Diagram: Confirm DPO Flow

```
User                  DpoDetail           API
 |                       |                 |
 |-- click Konfirmasi --> |                 |
 |                       |-- POST acquire-lock -->
 |                       |<-- { lock_token } ---
 |                       | (store lock_token in useState)
 |                       | (start 5-min countdown)
 |                       | (open ConfirmDialog)
 |                       |                 |
 |-- click Ya Konfirmasi >|                 |
 |                       |-- POST confirm { lock_token } -->
 |                       |                 |
 |          [success]    |<-- DPO detail --
 |                       | invalidate query
 |                       | close dialog
 |                       | show success toast
 |                       |                 |
 |          [error: LockConflict]          |
 |                       |<-- 409 error ---
 |                       | disable confirm button
 |                       | show error in dialog
 |                       |                 |
 |          [error: InsufficientStock]     |
 |                       |<-- 400 error ---
 |                       | show product details in dialog
 |                       |                 |
 |-- countdown = 0 ----> |                 |
 |                       | disable confirm button
 |                       | show "Sesi expired" message
 |                       | show "Muat Ulang" button
 |                       |                 |
 |-- click Muat Ulang --> |                 |
 |                       |-- POST acquire-lock (retry) -->
 |                       |<-- { lock_token } ---
 |                       | reset countdown to 5 min
```

---

## Komponen: DpoConfirmDialog

State internal:
```typescript
const [lockToken, setLockToken] = useState<string | null>(null)
const [secondsLeft, setSecondsLeft] = useState(300) // 5 menit
const [isExpired, setIsExpired] = useState(false)
```

Logic:
- `acquireLockMutation.mutate()` dipanggil saat tombol "Konfirmasi DPO" diklik (bukan saat dialog dibuka)
- Countdown dimulai setelah acquire-lock sukses menggunakan `useEffect` + `setInterval`
- Saat `secondsLeft === 0`: set `isExpired = true`, clear interval
- Tombol confirm disabled jika `isExpired === true` atau `confirmMutation.isPending`
- Tombol "Muat Ulang" memanggil `acquireLockMutation.mutate()` ulang dan reset countdown

---

## Komponen: DpoLinesTable

Dirty state tracking:
```typescript
// Map dari lineId → { confirmed_qty, notes }
const [edits, setEdits] = useState<Record<string, LineEdit>>({})

const isDirty = Object.keys(edits).length > 0

// Saat save: kirim hanya lines yang ada di edits map
const linesToSave = Object.entries(edits).map(([id, edit]) => ({ id, ...edit }))
```

Stock indicator logic:
```typescript
// Tampilkan indicator jika live berbeda dari snapshot
const readyStockChanged = line.live_ready_stock !== line.current_ready_stock
const mainStockChanged = line.live_main_stock !== line.current_main_stock
```

---

## Form Validation Schemas (Zod)

```typescript
// Generate DPO
const generateSchema = z.object({
  branch_id: z.string().uuid('Pilih branch'),
  prep_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid'),
  source_warehouse_id: z.string().uuid('Pilih source warehouse'),
  target_warehouse_id: z.string().uuid('Pilih target warehouse'),
  notes: z.string().max(500).nullable().optional(),
})

// Forecast Config
const forecastConfigSchema = z.object({
  branch_id: z.string().uuid(),
  weight_7d: z.number().min(0).max(1),
  weight_30d: z.number().min(0).max(1),
  weight_dow: z.number().min(0).max(1),
  coverage_days: z.number().min(0.5).max(7),
  holiday_factor: z.number().min(1).max(3),
  lookback_days_short: z.number().int().min(3).max(14).optional(),
  lookback_days_long: z.number().int().min(14).max(90).optional(),
}).refine(
  (d) => Math.abs(d.weight_7d + d.weight_30d + d.weight_dow - 1.0) < 0.001,
  { message: 'Total bobot harus = 1.00', path: ['weight_7d'] }
)

// Cancel DPO
const cancelSchema = z.object({
  reason: z.string().min(1, 'Alasan cancel wajib diisi').max(255),
})
```

---

## Error Handling

Semua error backend sudah human-readable dalam Bahasa Indonesia.
Extract pesan error dari `error.response?.data?.message ?? error.message`.

| Backend Error | UI Treatment |
|---|---|
| "DPO sedang dikonfirmasi oleh pengguna lain" | Alert di ConfirmDialog + disable confirm button |
| "Sesi konfirmasi sudah expired" | Alert di ConfirmDialog + tampilkan Muat Ulang button |
| "Stok MAIN tidak cukup untuk {produk}" | Alert merah di ConfirmDialog dengan detail produk |
| "Forecast config untuk cabang ... belum dikonfigurasi" | Toast error + link ke /daily-prep-orders/config |
| "Tidak ada baris yang bisa di-transfer" | Toast warning |
| Semua error lain | Toast error dengan pesan dari backend |

---

## Konvensi Umum

- Semua komponen: functional component + hooks, tidak ada class component
- Format tanggal API: `YYYY-MM-DD`; tampilkan UI: `dd MMM yyyy` (date-fns)
- Format angka qty: maksimal 4 desimal, strip trailing zeros
  ```typescript
  const formatQty = (n: number) => parseFloat(n.toFixed(4)).toString()
  ```
- Jangan hardcode string status — gunakan konstanta dari `DpoStatus` type
- Setelah mutasi sukses: `queryClient.invalidateQueries({ queryKey: dpoKeys... })`
  jangan `refetch()` manual
- Gunakan `isPending` (bukan `isLoading`) untuk TanStack Query v5
