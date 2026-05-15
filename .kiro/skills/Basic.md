---
trigger: always_on
---
📜 Backend Engineering Standards — Suryamas ERP (Unified)
🎯 Tujuan

Dokumen ini menjadi single source of truth untuk:

Arsitektur backend
Coding standards
Performance & security rules
Enforcement rules untuk AI & developer

Semua code baru WAJIB mengikuti dokumen ini.

🏗️ 1. Module Structure (MANDATORY)

Setiap module di src/modules/*:

- *.routes.ts
- *.controller.ts
- *.service.ts
- *.repository.ts
- *.schema.ts
- *.errors.ts
- *.types.ts
Rules:
Semua layer wajib ada (tidak boleh skip)
Tidak boleh cross-layer access (controller → repository ❌)
🚦 2. Routing Layer
Responsibilities:
Define endpoint
Attach middleware
Call controller
Middleware Order (WAJIB — tidak boleh diubah):
authenticate → resolveBranchContext → permission → validateSchema
Rules:
Gunakan:
auth.middleware
branch-context.middleware
permission.middleware
validation.middleware
Permission:
canView, canInsert, canUpdate, canDelete
Schema HARUS dipasang di routes (entry point validation)
Pattern:
router.get(
  '/',
  canView(MODULE),
  validateSchema(schema),
  (req, res) => controller.method(req as any, res)
)
🎮 3. Controller Layer
Responsibilities:
Handle request & response
Extract req.validated
Call service
Rules:
❌ Tidak boleh ada business logic
✅ Wajib:
withValidated
sendSuccess
handleError
Singleton:
export const controller = new Controller()
🛠️ 4. Service Layer (CORE LOGIC)
Responsibilities:
Business logic
Orchestration
Transaction handling
Rules:
✅ Audit Log WAJIB untuk:
CREATE
UPDATE
DELETE
LOGIN / LOGOUT
PERMISSION CHANGE
❌ Tidak boleh query langsung ke DB
Gunakan repository
Audit Log Minimal:
user_id
action
entity
entity_id
before
after
timestamp
🗄️ 5. Repository Layer
Responsibilities:
Single source of truth untuk DB access
Rules:
❌ Tidak boleh business logic
❌ Tidak boleh N+1 query
✅ Wajib:
Filter company_id
deleted_at IS NULL
Gunakan:
CTE / JOIN
batching / parallel query
🧪 6. Schema Layer (Validation)
Rules:
Gunakan:
import { z } from '@/lib/openapi'
Semua request WAJIB tervalidasi
Gunakan:
.coerce (query param)
.refine (business validation)
❌ 7. Error Handling
Rules:
Gunakan custom error:
- NotFoundError, BusinessRuleError, ConflictError, dll.
- ❌ Tidak boleh throw Error biasa
- ✅ WAJIB: Daftarkan error class baru di `src/config/error-registry.ts` untuk pemetaan status code & module tracking.
- ✅ WAJIB: Gunakan `await handleError(res, error, req, context)` di controller.
- ✅ WAJIB: Pass `context` (objek metadata) untuk mempermudah debugging di monitoring dashboard.
📋 8. Global Standards
Code Quality
TypeScript strict
❌ Dilarang any
Naming harus jelas & konsisten
Data Format
Backend: ISO / YYYY-MM-DD
Frontend: dd-MMM-yyyy
Pagination
WAJIB untuk list API
Logging
Gunakan centralized logger
Log minimal:
request masuk
error
query penting
⚡ 9. Performance Rules
WAJIB:
❌ No N+1 Query
✅ JOIN / batching
✅ Indexing kolom penting
✅ Pagination
🔐 10. Security Rules

Semua endpoint harus:

✅ Authenticated
✅ Authorized
✅ Validated
✅ Sanitized
🧩 11. Middleware Standard
List:
auth.middleware
branch-context.middleware
validation.middleware
permission.middleware

Tidak boleh membuat middleware custom tanpa justifikasi jelas.

📊 12. Monitoring & Observability
Gunakan centralized logger
Integrasi monitoring service
Semua error harus tercatat
🧠 13. AI Enforcement Rules

AI WAJIB:

Mengikuti struktur module
Tidak menggunakan any
Tidak membuat N+1 query
Selalu pakai schema validation
Selalu pakai permission middleware
Selalu tambahkan audit log untuk mutasi data

Jika melanggar → dianggap INVALID CODE

🖥️ 14. Frontend Coupling Rules (Important)
Format tanggal display: dd-MMM-yyyy
State filter: Zustand
Hindari over-fetching
Gunakan global pagination
🔥 Perbedaan penting dari versi lama (ini yang krusial)

Ini bukan sekadar merge — ada beberapa upgrade penting:

1. Tidak ada duplikasi rules
Middleware → disatukan
Audit log → disatukan
Validation → dipaksa di routes
2. Konsistensi Zod
Dipastikan pakai @/lib/openapi (bukan raw zod)
3. Enforcement lebih keras
Ada section AI Enforcement Rules
Jelas mana yang WAJIB vs optional
4. Clean separation
Controller = thin
Service = brain
Repository = data only


🎨 Frontend Development Guidelines (frontend/FRONTEND_STANDARDS.md)
markdown
# Frontend Development Guidelines - Suryamas ERP
Dokumen ini mendefinisikan standar pengembangan UI/UX dan arsitektur frontend untuk memastikan aplikasi tetap premium, responsif, dan mudah dipelihara.
## 🏗️ Feature-Based Structure
Kita menggunakan struktur berbasis **Features** di `src/features/*`. Setiap fitur harus mandiri:
- `api/`: Custom hooks (React Query) untuk fetching data.
- `components/`: Komponen UI khusus untuk fitur tersebut.
- `store/`: State management menggunakan Zustand.
- `pages/`: Halaman utama fitur.
- `types/`: Definisi interface TypeScript.
- `index.ts`: Public API untuk fitur (export yang dibutuhkan fitur lain).
---
## 📡 1. Data Fetching (`api/*.ts`)
Kita menggunakan **TanStack Query (React Query)** untuk manajemen server-state.
### Aturan:
- **Query Keys**: Selalu definisikan objek `queryKeys` untuk konsistensi invalidasi data.
- **Hook Pattern**: Bungkus `useQuery` atau `useMutation` dalam custom hooks.
- **Error Handling**: Gunakan `toast` untuk memberitahukan error ke user.
- **Invalidation**: Lakukan `qc.invalidateQueries` pada `onSuccess` saat melakukan mutasi (POST/PUT/DELETE).
### Contoh:
```typescript
export const useCashFlowDaily = (params: QueryParams) =>
  useQuery({
    queryKey: ['cash-flow', 'daily', params],
    queryFn: () => api.get('/cash-flow/daily', { params }).then(res => res.data.data),
    enabled: !!params.bank_account_id
  });
🧠 2. State Management (store/*.ts)
Gunakan Zustand untuk global state atau state yang perlu bertahan saat navigasi (seperti Filter).

Aturan:
Pemisahan Store: Buat store kecil yang spesifik (misal: useAuthStore, useFilterStore).
Persistensi: Gunakan middleware persist jika data harus bertahan setelah refresh (seperti Token/Branch ID).
🎨 3. UI & Styling
Aplikasi ini harus terasa Premium dan Modern.

Aturan:
Design System: Gunakan komponen dari Shadcn UI sebagai basis.
Consistency: Jangan membuat warna atau spacing ad-hoc. Gunakan utility classes dari Tailwind.
Dark Mode: Pastikan semua komponen support dark mode menggunakan class dark:.
Micro-animations: Gunakan Framer Motion untuk transisi halaman atau hover effect yang halus.
No Placeholders: Gunakan data asli atau generated images yang terlihat profesional.
🛠️ 4. Global Standards & Utilities
Format Tanggal:
Backend mengirim: YYYY-MM-DD atau ISO.
Frontend menampilkan: dd-MMM-yyyy (Contoh: 20-Apr-2026). Gunakan formatDate utility.
Pagination: Wajib menggunakan komponen pagination global untuk semua list API yang besar.
Modal Konfirmasi: Gunakan pola global ConfirmModal sebelum aksi destruktif (Delete).
Form Validation: Gunakan React Hook Form + Zod untuk semua input form.
📋 5. AI Enforcement Rules
AI WAJIB:

Menggunakan TypeScript secara ketat (No any).
Mengikuti struktur folder src/features.
Selalu menambahkan state loading (skeleton/spinner) saat fetching data.
Menambahkan dokumentasi JSDoc pada hooks atau utilitas yang kompleks.
Memastikan responsivitas (Mobile-first approach).


🔍 15. Search + Pagination Pattern (MANDATORY)

Search SELALU dijalankan duluan, pagination diterapkan pada hasil search.

### Flow
1. User ketik search query
2. Backend menerima `(query, page, limit)` — `WHERE` clause filter duluan, BARU `LIMIT/OFFSET` diterapkan pada hasil filter
3. Frontend reset ke page 1 setiap kali search atau filter berubah
4. `total` dari backend = jumlah row yang sudah difilter (BUKAN total seluruh tabel)
5. Pagination UI dihitung berdasarkan `total` yang sudah difilter

### Backend SQL Pattern (WAJIB)
```sql
-- ✅ BENAR: Filter dulu, baru paginate
SELECT * FROM table
WHERE name ILIKE '%query%'   -- filter first
ORDER BY name
LIMIT $limit OFFSET $offset  -- paginate the filtered result

-- COUNT juga WAJIB pakai WHERE yang sama
SELECT COUNT(*)::int AS total FROM table
WHERE name ILIKE '%query%'   -- filtered count
```

❌ DILARANG:
- Paginate dulu baru filter di memory
- Pakai total row count seluruh tabel saat search aktif
- Cache `total` dari request sebelumnya saat search/filter berubah

### Frontend State Rules (WAJIB)
- `debouncedSearch` atau `filter` berubah → reset page ke 1, fetch ulang
- Page berubah (user klik pagination) → fetch dengan search/filter yang sedang aktif, JANGAN fetch tanpa filter
- `total` dari response SELALU dipakai untuk hitung `totalPages`, BUKAN hardcode atau cache lama
- Store `fetchList()` WAJIB baca `filter`/`search` dari current state (`get()`) — bukan dari parameter saja

### Query Middleware
- `q` param di-exclude dari `filterParams` oleh query middleware
- Untuk search text, gunakan key `search` (bukan `q`) agar lolos ke `filterParams`
- ATAU baca `req.query.q` secara manual di controller dan inject ke filter

📚 16. Project Context (WAJIB BACA)

Sebelum mengerjakan task apapun, AI WAJIB membaca:
- `.amazonq/docs/INFRASTRUCTURE.md` — server, DB, tunnel, firewall, storage, monitoring, Telegram
- `.amazonq/docs/DEV_STATUS.md` — progress, pending fixes, backlog, coding conventions

🔑 16. Lessons Learned (WAJIB IKUTI)

Dari pengalaman development sebelumnya, berikut aturan tambahan:

### Backend
1. `handleError(res, error, req, context)` — SELALU `await` karena bersifat async. Pass `req` untuk info user/route, dan `context` untuk metadata spesifik (ID, query, dll).
2. ~~Jika TypeScript error saat pass `req` ke `handleError` karena custom type (Query/Body), gunakan `req as any`.~~ **DEPRECATED** — Gunakan Express global augmentation (`src/types/express.d.ts`). Controller langsung pass `req` tanpa cast.
3. Jangan throw generic `new Error()` — pakai custom error class dari `*.errors.ts` dan daftarkan di `ERROR_REGISTRY`.
4. Schema validation: cross-validate compare periods, UUID regex untuk `branch_ids`
5. Setelah ubah `.ts`, WAJIB rebuild: `cd backend && npx tsc`
6. `company_id` dari branch context (`req.context.company_id`), BUKAN dari query param
7. Lazy Initialization: Gunakan pattern getter (misal `getS3()`) untuk service eksternal agar env vars ter-load dengan benar (menghindari error saat cold start).
8. S3Client (Cloudflare R2) WAJIB pakai `forcePathStyle: true`
9. **Express global augmentation** (`src/types/express.d.ts`): Extend `Express.Request` dengan `user`, `validated`, `sort`, `filterParams`, `queryFilter`, `context`, `permissions`. DILARANG cast `req as any` / `req as unknown as Request` di controller.
10. **DTO audit fields**: `CreateXxxDto` / `UpdateXxxDto` WAJIB include `created_by` / `updated_by` agar service tidak perlu unsafe cast.
11. **Repository type safety**: Gunakan `toRecord<T>()` helper untuk bulk insert. DILARANG `as any` untuk row mapping.
12. **Postgres error check**: Gunakan `isPostgresError(error, code)` dari `src/utils/postgres-error.util.ts` untuk cek error code PostgreSQL (misal `'23505'` unique violation). DILARANG cast `(error as { code?: string }).code`.

### Frontend
1. Jangan hardcode labels — pakai data dari DB/COA hierarchy
2. Jangan `Math.abs` untuk kalkulasi — pakai helper per account type (`debit - credit` vs `credit - debit`)
3. Jangan mutable variable di render (`let rowNum`) — hitung `rowIndex` di function sebelum render
4. `colSpan` pakai konstanta (`totalCols`), bukan angka hardcode
5. `fmt(0)` di total row pakai `showZero = true` supaya tampil `0,00` bukan `-`
6. Tailwind JIT: JANGAN dynamic class (`bg-${color}-500`), pakai object mapping literal
7. CSV export: pakai `escapeCsv()` dari `src/utils/csv.utils.ts`
8. Error message 500 di frontend: tampilkan pesan generik, bukan detail teknis
9. Akun tanpa parent di-group ke bucket `__ungrouped__` dengan label "Lainnya"
10. Permission module harus terpisah per fitur (jangan gabung ke `journals`)
11. **Error extraction**: Semua store WAJIB pakai `parseApiError()` dari `@/lib/errorParser`. DILARANG inline `error instanceof Error ? error.message : '...'`.

### Database & Migrasi
1. Akses DB dari lokal: via SSH tunnel (`tunnel` command), JANGAN buka port 5432 di firewall
2. `DATABASE_URL` pakai `localhost:5433` (tunnel), bukan IP langsung
3. Setelah migrasi, WAJIB compare: tables, views, functions, enums, triggers, sequences, indexes, FK
4. `auth.users` (Supabase) → `public.auth_users` (Hetzner) — semua FK sudah di-remap
