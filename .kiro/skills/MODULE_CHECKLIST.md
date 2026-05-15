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
