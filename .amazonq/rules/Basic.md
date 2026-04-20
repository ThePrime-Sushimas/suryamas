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
NotFoundError
BusinessRuleError
❌ Tidak boleh throw Error biasa
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
