---
type: module
slug: companies
status: active
domain: "[[20-DOMAINS/Auth/_Index|Auth]]"
backend_path: backend/src/modules/companies
api_base: /api/v1/companies
permission_module: companies
depends_on:
  - employees (via created_by/updated_by FK → auth_users)
used_by:
  - branches
  - fiscal_periods
  - purchase_invoices
  - general_invoices
  - suppliers
  - products
  - all multi-tenant modules
related_tables:
  - companies
  - branches (child)
  - auth_users (audit trail)
last_updated: 2026-06-09
---

# M-Companies

## Purpose

Mengelola data **perusahaan/entitas legal** dalam sistem multi-tenant Suryamas ERP. Setiap `company_id` menjadi filter wajib di semua query (tenant isolation).

Companies adalah modul **root** — semua data operasional (cabang, akun, transaksi) berada di dalam konteks satu company.

## Layer Map

```
Routes → Controller → Service → Repository
  Schema    handleError      Audit        SQL queries
```

### Files

| File | Purpose |
|------|---------|
| `companies.routes.ts` | 10 endpoints: CRUD, search, bulk ops, export/import (job-based + legacy), filter-options |
| `companies.controller.ts` | 13 handlers — thin, pass to service, catch with `handleError` + context `{ action }` |
| `companies.service.ts` | Business logic: duplicate check (code/NPWP), trimming, audit trail, Excel import/export |
| `companies.repository.ts` | SQL queries: findAll, findById, findByCode, findByNpwp, bulkUpdateStatus, bulkDelete, exportData |
| `companies.schema.ts` | Zod validation (via `@/lib/openapi`): create, update, id, bulkUpdateStatus, bulkDelete |
| `companies.errors.ts` | 17 custom error classes + `CompanyErrors` factory |
| `companies.types.ts` | `Company`, `CreateCompanyDTO`, `UpdateCompanyDTO`, `CompanyFilterParams` |
| `companies.config.ts` | Constants: company types, statuses, export limits |
| `companies.openapi.ts` | OpenAPI spec |

## API Endpoints

### Query order: static routes before `/:id`

```
GET    /                          → list (paginated, sortable, filterable)
GET    /search                    → search by term (paginated)
GET    /filter-options            → enum values for UI dropdowns
POST   /                          → create company
GET    /:id                       → get by ID
PUT    /:id                       → update company
DELETE /:id                       → delete company

# Bulk operations
POST   /bulk/status               → bulk update status
POST   /bulk/delete               → bulk delete

# Export (two modes)
POST   /export/job                → async export via background job
GET    /export/token              → legacy: generate export token
GET    /export                    → legacy: download Excel

# Import (two modes)
POST   /import/job                → async import via background job
POST   /import/preview            → legacy: preview Excel rows
POST   /import                    → legacy: execute import
```

**Note:** `/:id` harus dibaca setelah `/search`, `/filter-options`, `/bulk/*`, `/export/*`, `/import/*` — routing Express akan match rute statis lebih dulu jika didaftarkan sebelum.

## Key Business Rules

### Multi-tenant
- Semua query menggunakan `WHERE company_id = $N` (tapi Companies sendiri tidak punya FK ke dirinya sendiri)
- Tidak ada `getReadScope`/`getWriteScope` di controller karena company adalah root entity

### Soft Delete
- Table memiliki `is_deleted`, `deleted_at` (boolean + timestamp)
- `findById` → `deleted_at IS NULL`
- `delete` → set `is_deleted = true`, `deleted_at = now()`

### Audit Trail
- `created_by` / `updated_by` → `REFERENCES auth_users(id)` ✅ (diperbaiki 2026-06-09)
- `AuditService.log` pada CREATE, UPDATE, DELETE, BULK_UPDATE_STATUS, BULK_DELETE

### Duplicate Checks
- `company_code` — unique constraint + explicit `findByCode` check
- `npwp` — unique constraint + explicit `findByNpwp` check
- Error yang dilempar: `CompanyCodeAlreadyExistsError` (409) / `NPWPAlreadyExistsError` (409)

### Validation
- Schema validation via Zod: `company_code` required, `company_name` required
- Company type: `'PT' | 'CV' | 'Firma' | 'Koperasi' | 'Yayasan'` (default: 'PT')
- Status: `'active' | 'inactive' | 'suspended' | 'closed'` (default: 'active')
- UUID validation for bulk operation IDs

### Import/Export
- Export: max 10,000 rows (`CompanyConfig.EXPORT.MAX_ROWS`)
- Import: required fields `company_code`, `company_name`; optional skip duplicates
- Async job-based processing untuk operasi besar (rate limit: 5 requests/menit)

## Error Classes (registered in `error-registry.ts`)

| Error | Status | Keterangan |
|-------|--------|------------|
| `CompanyNotFoundError` | 404 | Company tidak ditemukan |
| `CompanyCodeNotFoundError` | 404 | Code tidak ditemukan |
| `CompanyCodeAlreadyExistsError` | 409 | Duplicate company code |
| `NPWPAlreadyExistsError` | 409 | Duplicate NPWP |
| `CompanyEmailAlreadyExistsError` | 409 | Duplicate email |
| `InvalidCompanyTypeError` | 400 | Tipe tidak valid |
| `InvalidCompanyStatusError` | 400 | Status tidak valid |
| `InvalidCompanyEmailError` | 400 | Format email salah |
| `InvalidCompanyPhoneError` | 400 | Format telepon salah |
| `InvalidCompanyURLError` | 400 | Format URL salah |
| `RequiredFieldError` | 400 | Field wajib kosong |
| `CompanyInactiveError` | 422 | Company non-aktif |
| `CannotDeleteDefaultCompanyError` | 422 | Tidak bisa hapus default company |
| `CannotDeactivateCompanyWithBranchesError` | 422 | Tidak bisa non-aktifkan company yang punya cabang aktif |
| `CompanyCreateFailedError` | 500 | Gagal create (DB error) |
| `CompanyUpdateFailedError` | 500 | Gagal update |
| `CompanyDeleteFailedError` | 500 | Gagal delete |

## Known Gotchas / Pitfalls

### 1. Migration FK Fix (2026-06-09)
Modul ini dulunya menggunakan `created_by` / `updated_by` → `REFERENCES employees(id)`. **Sudah diperbaiki** menjadi `REFERENCES auth_users(id)` bersama suppliers dan pricelists. Jika ada error `payment_method_alerts_created_by_fkey` — ini sudah teratasi.

### 2. Tidak pakai `getReadScope()` / `getWriteScope()`
Karena companies adalah root entity, controller langsung menggunakan `req.user!.id` tanpa filter company scope. Ini berbeda dari modul child seperti branches atau products.

### 3. Bulk Operations tanpa `hasChildren()` guard
`bulkDelete` dan `bulkUpdateStatus` tidak mengecek apakah ada cabang aktif yang bergantung pada company ini. Jika ada cabang, seharusnya throw `CannotDeactivateCompanyWithBranchesError`. Saat ini error itu didefinisikan tapi **tidak digunakan** di service `delete()`.

### 4. Legacy Export/Import vs Job-Based
Ada dua mekanisme export/import yang berjalan paralel:
- **Legacy** (`GET /export`, `POST /import`) — synchronous, rate-limited
- **Job-based** (`POST /export/job`, `POST /import/job`) — async via background worker
Job-based adalah yang recommended untuk production.

### 5. No `resolveBranchContext` for reads
Rute perusahaan tidak memerlukan konteks cabang karena company adalah entitas global. Tapi middleware `resolveBranchContext` tetap dipasang di `router.use()` — tidak bermasalah karena hanya mengisi `req.context`.

## Related

- **Domain:** [[20-DOMAINS/Auth/_Index|Auth]]
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
- **Branches:** [[M-branches/_Overview|M-Branches]] (child entity)