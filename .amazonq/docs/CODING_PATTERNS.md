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
