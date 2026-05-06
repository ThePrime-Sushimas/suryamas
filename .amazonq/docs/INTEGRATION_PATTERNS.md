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
