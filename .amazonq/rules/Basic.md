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