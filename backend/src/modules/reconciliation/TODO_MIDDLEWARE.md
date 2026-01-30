# TODO - Bank Reconciliation Middleware Consistency

## Task
Sesuaikan penggunaan middleware di `bank-reconciliation` dengan module lain dalam project

## Perubahan yang Dibutuhkan

### 1. bank-reconciliation.routes.ts
- [x] Import `queryMiddleware` dari middleware
- [x] Tambahkan `queryMiddleware` di router level untuk endpoint GET
- [x] Tambah endpoint `/summary` dengan typed request
- [x] Gunakan `as AuthenticatedRequest` untuk undo endpoint
- [x] Gunakan `as ValidatedAuthRequest<typeof schema>` untuk POST endpoints

### 2. bank-reconciliation.controller.ts
- [x] Import `AuthenticatedQueryRequest`, `AuthenticatedRequest` dari types
- [x] Import `ValidatedAuthRequest` dari middleware
- [x] Update controller methods untuk menggunakan typed requests yang konsisten
- [x] Ganti `(req as any)` dengan typed request parameters

## Status
- [ ] TODO
- [ ] IN_PROGRESS
- [x] DONE

## Verifikasi
- [x] TypeScript compilation passed
- [x] Konsisten dengan pola di `branches.routes.ts`


