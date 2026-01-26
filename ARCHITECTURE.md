# Dokumentasi Arsitektur Project Sushimas ERP

## 📁 Struktur Folder Project

```
suryamas/
├── backend/                    # Backend API (Node.js + TypeScript + Express)
│   ├── src/
│   │   ├── app.ts              # Entry point aplikasi Express
│   │   ├── server.ts           # Server startup & job worker initialization
│   │   ├── config/             # Konfigurasi aplikasi
│   │   │   ├── banks.config.ts
│   │   │   ├── logger.ts       # Logging configuration
│   │   │   ├── openapi.ts      # OpenAPI document generation
│   │   │   └── supabase.ts     # Supabase client configuration
│   │   ├── middleware/         # Express middleware
│   │   │   ├── auth.middleware.ts          # JWT authentication
│   │   │   ├── branch-context.middleware.ts # Branch context resolver
│   │   │   ├── error.middleware.ts         # Error handling
│   │   │   ├── permission.middleware.ts    # RBAC permission checks
│   │   │   ├── query.middleware.ts         # Pagination & sorting
│   │   │   ├── rateLimiter.middleware.ts   # Rate limiting
│   │   │   ├── request-logger.middleware.ts
│   │   │   ├── upload.middleware.ts        # File upload handling
│   │   │   └── validation.middleware.ts    # Schema validation
│   │   ├── modules/            # Feature modules (Modular Architecture)
│   │   │   ├── accounting/     # Accounting module
│   │   │   ├── auth/           # Authentication
│   │   │   ├── bank-accounts/  # Bank accounts management
│   │   │   ├── banks/          # Banks master data
│   │   │   ├── branches/       # Branch management
│   │   │   ├── categories/     # Product categories
│   │   │   ├── companies/      # Company management
│   │   │   ├── employees/      # Employee management
│   │   │   ├── employee_branches/ # Employee-branch assignments
│   │   │   ├── jobs/           # Background job queue system
│   │   │   ├── metric-units/   # Metric units (UOM)
│   │   │   ├── monitoring/     # System monitoring
│   │   │   ├── payment-methods/ # Payment methods
│   │   │   ├── payment-terms/  # Payment terms
│   │   │   ├── permissions/    # RBAC permissions
│   │   │   ├── pos-imports/    # POS data import system
│   │   │   ├── pricelists/     # Price lists
│   │   │   ├── product-uoms/   # Product UOMs
│   │   │   ├── products/       # Product management
│   │   │   ├── sub-categories/ # Sub-categories
│   │   │   ├── supplier-products/ # Supplier products
│   │   │   ├── suppliers/      # Supplier management
│   │   │   └── users/          # User management
│   │   ├── services/           # Shared services
│   │   │   ├── audit.service.ts        # Audit logging
│   │   │   ├── export.service.ts       # Excel export
│   │   │   ├── import.service.ts       # Excel import
│   │   │   ├── permission.service.ts   # Permission management
│   │   │   ├── products.export.service.ts
│   │   │   └── products.import.service.ts
│   │   ├── types/              # TypeScript types
│   │   │   ├── common.types.ts
│   │   │   └── request.types.ts
│   │   └── utils/              # Utility functions
│   │       ├── error-handler.util.ts
│   │       ├── handler.ts
│   │       ├── pagination.util.ts
│   │       ├── permissions.util.ts
│   │       ├── response.util.ts
│   │       └── validation.util.ts
│   └── logs/                   # Application logs
│
└── frontend/                   # Frontend (React + TypeScript + Vite)
    └── src/
        ├── features/           # Feature-based components
        │   ├── accounting/
        │   ├── auth/
        │   ├── banks/
        │   ├── branches/
        │   ├── employees/
        │   ├── jobs/
        │   ├── pos-aggregates/
        │   ├── pos-imports/
        │   ├── pos-transactions/
        │   ├── products/
        │   └── ...
        ├── components/         # Shared components
        ├── contexts/           # React contexts
        ├── hooks/              # Custom hooks
        ├── pages/              # Page components
        ├── services/           # API services
        └── utils/              # Frontend utilities
```

---

## 🏗️ Arsitektur Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (Frontend)                                 │
│  React + TypeScript + Vite + TailwindCSS                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                        │
│  Express.js + Helmet + CORS + Rate Limiter                                   │
│  • Request logging                                                           │
│  • Input validation                                                          │
│  • Authentication (JWT)                                                      │
│  • Permission checks (RBAC)                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │   REST API        │ │   OpenAPI Docs    │ │   Job Queue       │
        │   Endpoints       │ │   /docs           │ │   System          │
        └───────────────────┘ └───────────────────┘ └───────────────────┘
                    │                 │                 │
                    ▼                 │                 ▼
        ┌───────────────────────────────────────────────────────────────┐
        │                     DATABASE (Supabase)                         │
        │  • PostgreSQL                                                    │
        │  • Authentication (Supabase Auth)                               │
        │  • Storage (File uploads)                                       │
        │  • Row Level Security (RLS)                                     │
        └───────────────────────────────────────────────────────────────┘
```

---

## 🔐 Authentication & Authorization Flow

```
User Login
    │
    ▼
┌─────────────────┐
│ Login Request   │ ◄── POST /api/v1/auth/login
│ (email/pass)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate creds  │ ◄── Supabase Auth
└────────┬────────┘
         │
    Success │ Failure
         ▼           ▼
┌─────────────┐  ┌─────────────┐
│ JWT Token   │  │ Error 401   │
│ generated   │  └─────────────┘
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                  Subsequent API Requests                      │
│  Headers: Authorization: Bearer <jwt_token>                  │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  auth.middleware.ts                                          │
│  1. Extract token from Authorization header                  │
│  2. Verify token with Supabase Auth                          │
│  3. Check employee resign status (with 30min cache)         │
│  4. Attach user & employee data to request                   │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  permission.middleware.ts                                    │
│  1. Check preloaded permissions matrix                       │
│  2. Verify action permission (view/insert/update/delete)     │
│  3. Return 403 if denied                                     │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Controller Handler                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 👥 Role-Based Access Control (RBAC)

### Permission Structure
```
Modules:
├── employees        (Employee Management)
├── products         (Product Management)
├── categories       (Category Management)
├── chart_of_accounts (Chart of Accounts)
├── accounting_purposes (Accounting Purposes)
├── pos_imports      (POS Imports)
├── jobs             (Job Queue)
└── journals         (Journal Entries)

Actions per Module:
├── view     - Can view/list records
├── insert   - Can create new records
├── update   - Can modify existing records
├── delete   - Can delete records
├── approve  - Can approve journals
└── release  - Can post/release journals
```

### Permission Check Flow
```
Request ──► authenticate() ──► resolveBranchContext()
                                   │
                                   ▼
                           canView('employees')
                                   │
                                   ▼
                           req.permissions['employees']['view']?
                                   │
                      Yes ────────┴───────┐ No
                       │                 │
                       ▼                 ▼
                 Controller           403 Forbidden
                   Handler
```

---

## 📦 Modules Detail

### 1. Authentication Module (`auth/`)
**File:** `backend/src/modules/auth/`

**Fungsi:**
- Login dengan email/password
- Logout
- Refresh token
- Password reset

**Routes:**
```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/reset-password
```

**Flow:**
```
User Login
    │
    ▼
Supabase Auth.authSignInWithPassword()
    │
    ▼
Generate JWT response
    │
    ▼
User stores token in localStorage/cookie
```

---

### 2. Employees Module (`employees/`)
**File:** `backend/src/modules/employees/`

**Fungsi:**
- CRUD employee
- Export/Import employee data (Excel)
- Profile management
- Bulk operations (update active status, delete, restore)

**Routes:**
```
GET    /api/v1/employees              # List employees
GET    /api/v1/employees/search       # Search employees
GET    /api/v1/employees/profile      # Get own profile
PUT    /api/v1/employees/profile      # Update profile
POST   /api/v1/employees/export/job   # Create export job
POST   /api/v1/employees/import/job   # Create import job
POST   /api/v1/employees/bulk/delete  # Bulk delete
```

**Data Model:**
```
employees
├── employee_id          (Format: "EMP-YYYY-NNNN")
├── user_id              (Supabase auth ID)
├── full_name
├── job_position
├── branch_id
├── join_date
├── resign_date
├── status_employee
└── profile_picture
```

---

### 3. Products Module (`products/`)
**File:** `backend/src/modules/products/`

**Fungsi:**
- CRUD product
- Product categories & sub-categories
- Product UOM (Unit of Measure)
- Export/Import products

**Routes:**
```
GET    /api/v1/products               # List products
GET    /api/v1/products/search        # Search products
POST   /api/v1/products               # Create product
PUT    /api/v1/products/:id           # Update product
DELETE /api/v1/products/:id           # Delete product
POST   /api/v1/products/export/job    # Export products
POST   /api/v1/products/import/job    # Import products
```

**Data Model:**
```
products
├── product_code
├── product_name
├── category_id
├── sub_category_id
├── metric_unit_id
├── price
├── is_active
└── ...

product_uoms
├── product_id
├── uom_id
├── conversion_factor
└── is_default

categories
├── name
├── parent_id (untuk sub-categories)
└── ...
```

---

### 4. POS Imports Module (`pos-imports/`)
**File:** `backend/src/modules/pos-imports/`

**Fungsi:**
- Upload file Excel POS (sales data)
- Parse dan validasi data
- Deteksi duplicate transactions
- Simpan data sales transactions

**Sub-modules:**
- `pos-imports/` - Main POS import
- `pos-import-lines/` - Detail lines per import
- `pos-aggregates/` - Aggregated transactions
- `pos-transactions/` - POS transactions

**Routes:**
```
POST   /api/v1/pos-imports/upload         # Upload & analyze Excel
GET    /api/v1/pos-imports/:id            # Get import details
GET    /api/v1/pos-imports/:id/lines      # Get import lines
POST   /api/v1/pos-imports/:id/confirm    # Confirm import
DELETE /api/v1/pos-imports/:id            # Delete import

GET    /api/v1/aggregated-transactions    # List aggregated transactions
POST   /api/v1/aggregated-transactions    # Create aggregated transaction
GET    /api/v1/pos-transactions           # List POS transactions
```

**Flow POS Import:**
```
Upload Excel File
        │
        ▼
    Parse Excel
    (XLSX.read)
        │
        ▼
Validate Required Columns
(Bill Number, Sales Number, Sales Date)
        │
        ▼
Validate Rows
(tipe data, format tanggal)
        │
        ▼
Check Duplicates
(bill_number + sales_number + sales_date)
        │
        ▼
Extract Date Range
        │
        ▼
Create pos_import Record
(status: ANALYZED)
        │
        ▼
User Review Analysis
        │
        ▼
Confirm Import
        │
        ▼
Create Background Job
(type: import, module: pos_transactions)
        │
        ▼
Process Import (Job Processor)
        │
        ▼
Insert to pos_import_lines
        │
        ▼
Create aggregated_transactions
```

**Excel Column Mapping:**
```typescript
const EXCEL_COLUMN_MAP = {
  '#': 'row_number',
  'Sales Number': 'sales_number',
  'Bill Number': 'bill_number',
  'Sales Date': 'sales_date',
  'Branch': 'branch',
  'Payment Method': 'payment_method',
  'Menu': 'menu',
  'Qty': 'qty',
  'Price': 'price',
  'Discount': 'discount',
  'Total': 'total',
  'Nett Sales': 'nett_sales',
  // ... 40+ columns
}
```

---

### 5. Jobs Module (`jobs/`)
**File:** `backend/src/modules/jobs/`

**Fungsi:**
- Background job queue system
- Async processing (export/import)
- Job status tracking
- Retry mechanism

**Routes:**
```
GET    /api/v1/jobs                     # List jobs
GET    /api/v1/jobs/recent              # User's recent jobs
GET    /api/v1/jobs/:id                 # Get job details
DELETE /api/v1/jobs/:id                 # Cancel job
POST   /api/v1/jobs/clear               # Clear completed jobs
```

**Job Flow:**
```
API Request
    │
    ▼
jobsService.createJob()
    │
    ▼
jobsRepository.create()
(status: pending)
    │
    ▼
Return job_id to client
    │
    ▼
Job Worker Polling
(every 5 seconds)
    │
    ▼
jobWorker.pollAndProcessPendingJobs()
    │
    ▼
Find pending jobs
    │
    ▼
jobWorker.processJob(jobId)
    │
    ▼
Find & Execute Processor
    │
    ▼
Processor完成任务
    │
    ▼
jobsService.completeJob()
(status: completed)
    │
    ▼
Upload result file to Supabase Storage
    │
    ▼
Generate signed URL
    │
    ▼
Client polls for job status
and downloads result
```

**Job Processors:**
```typescript
// processors/
├── employees.export.ts      // Export employees to Excel
├── employees.import.ts      // Import employees from Excel
├── products.export.ts       // Export products to Excel
├── products.import.ts       // Import products from Excel
├── pos-aggregates.processor.ts       // Process aggregated transactions
├── pos-aggregates.job-processor.ts   // Job wrapper for pos-aggregates
├── pos-journals.processor.ts         // Generate journal entries
├── pos-journals.job-processor.ts     // Job wrapper for journals
├── pos-transactions.export.ts        // Export POS transactions
└── pos-transactions.import.ts        // Import POS transactions
```

**Job Configuration:**
```typescript
const JOB_QUEUE_CONFIG = {
  maxConcurrentJobs: 3,        // Max concurrent jobs
  jobTimeout: 600000,          // 10 minutes per job
  cleanupInterval: 300000,     // Cleanup every 5 minutes
  resultExpiration: 86400000,  // 24 hours
  pollingInterval: 5000        // Poll every 5 seconds
}
```

---

### 6. Accounting Module (`accounting/`)
**File:** `backend/src/modules/accounting/`

**Sub-modules:**
- `chart-of-accounts/` - COA management
- `accounting-purposes/` - Journal purposes (SAL-INV, etc.)
- `accounting-purpose-accounts/` - Purpose to COA mapping
- `fiscal-periods/` - Accounting periods
- `journals/` - Journal entries

**Routes:**
```
GET    /api/v1/chart-of-accounts           # List COA
POST   /api/v1/chart-of-accounts           # Create COA

GET    /api/v1/accounting-purposes         # List purposes
POST   /api/v1/accounting-purposes         # Create purpose

GET    /api/v1/accounting/fiscal-periods   # List periods

GET    /api/v1/accounting/journals         # List journals
POST   /api/v1/accounting/journals         # Create journal
POST   /api/v1/accounting/journals/:id/submit   # Submit
POST   /api/v1/accounting/journals/:id/approve  # Approve
POST   /api/v1/accounting/journals/:id/post     # Post
```

---

## 📋 Penjelasan accounting_purposes dan accounting_purpose_accounts

### Apa itu Accounting Purposes?

**Accounting Purpose** adalah definisi **jenis transaksi bisnis** yang menentukan bagaimana journal entry harus dibuat.

**Tipe yang tersedia:**
```typescript
type AppliedToType = 
| 'PURCHASE'    // Transaksi pembelian
| 'SALES'       // Transaksi penjualan
| 'INVENTORY'   // Transaksi inventory
| 'EXPENSE'     // Pengeluaran
| 'CASH'        // Transaksi kas
| 'BANK'        // Transaksi bank
| 'ASSET'       // Aset tetap
| 'TAX'         // Pajak
| 'GENERAL'     // Umum
| 'OPENING'     // Saldo awal
| 'RECEIVABLE'  // Piutang
| 'PAYABLE'     // Utang
| 'PAYROLL'     // Gaji
| 'FINANCING'   // Pembiayaan
```

**Contoh Purpose:**
| purpose_code | purpose_name | applied_to |
|--------------|--------------|------------|
| SAL-INV | Sales Invoice | SALES |
| PUR-INV | Purchase Invoice | PURCHASE |
| SAL-CSH | Sales Cash | SALES |
| EXP-OPR | Operating Expense | EXPENSE |

---

### Apa itu Accounting Purpose Accounts?

**Accounting Purpose Accounts** adalah **mapping/konfigurasi** yang menghubungkan:
- **Accounting Purpose** → **Chart of Accounts (COA)**
- Menentukan **sisi debit/credit** untuk setiap akun

**Struktur Data:**
```typescript
interface AccountingPurposeAccount {
  purpose_id: string      // Reference ke accounting_purposes
  account_id: string      // Reference ke chart_of_accounts
  side: 'DEBIT' | 'CREDIT' // Sisi jurnal
  is_required: boolean    // Apakah wajib ada di jurnal
  is_auto: boolean        // Apakah otomatis digunakan saat generate jurnal
  priority: number        // Urutan prioritas (untuk multiple accounts)
}
```

**Contoh Konfigurasi untuk SAL-INV (Sales Invoice):**

| purpose_code | account_code | account_name | side | is_auto | priority |
|--------------|--------------|--------------|------|---------|----------|
| SAL-INV | 4-1000 | Kas/Bank | DEBIT | true | 1 |
| SAL-INV | 4-1001 | Kartu Kredit | DEBIT | true | 2 |
| SAL-INV | 4-1002 | Debit Card | DEBIT | true | 3 |
| SAL-INV | 4-1100 | Pendapatan Penjualan | CREDIT | true | 1 |

---

### 🔄 Hubungan dengan Aggregated Transactions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ALUR AUTO-JOURNAL GENERATION                              │
└─────────────────────────────────────────────────────────────────────────────┘

aggregated_transactions
        │
        │ (status: COMPLETED, journal_id: NULL)
        ▼
┌──────────────────┐
│ Trigger Job      │
│ generate_journals│
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. Cari payment_method_id dari aggregated_transaction                        │
│    → Cari di tabel payment_methods                                           │
│    → Ambil coa_account_id dari payment_method                                │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 2. Tentukan Accounting Purpose (misal: SAL-INV untuk Sales)                  │
│    → Based on source_type or transaction type                                │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 3. Cari Accounting Purpose Accounts untuk SAL-INV                            │
│    → Query accounting_purpose_accounts                                       │
│    → WHERE purpose_id = (SELECT id FROM accounting_purposes                 │
│                          WHERE purpose_code = 'SAL-INV')                     │
│    → WHERE is_auto = true                                                    │
│    → WHERE is_active = true                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 4. Build Journal Lines                                                        │
│                                                                              │
│    DEBIT lines (dari accounting_purpose_accounts dengan side='DEBIT'):       │
│    ├── Ambil coa_account_id dari payment_methods                             │
│    │   (TIDAK dari accounting_purpose_accounts!)                             │
│    └── Total debit = SUM(net_amount)                                         │
│                                                                              │
│    CREDIT lines (dari accounting_purpose_accounts dengan side='CREDIT'):     │
│    ├── Cari di accounting_purpose_accounts                                   │
│    │   WHERE purpose_code = 'SAL-INV' AND side = 'CREDIT' AND is_auto = true│
│    └── Total credit = SUM(net_amount)                                        │
│                                                                              │
│    ✓ Balance: DEBIT = CREDIT                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 5. Insert journal_headers + journal_lines                                    │
│                                                                              │
│    journal_headers:                                                          │
│    ├── journal_number: RCP-BRANCHNAME-YYYY-MM-DD                            │
│    ├── journal_type: SALES                                                   │
│    ├── journal_date: Transaction date                                        │
│    ├── total_amount: SUM(net_amount)                                         │
│    └── status: POSTED (auto-post untuk auto-generated journals)              │
│                                                                              │
│    journal_lines:                                                            │
│    ├── Line 1: account_id=payment_coa, debit=net_amount, credit=0           │
│    ├── Line 2: account_id=sales_revenue_coa, debit=0, credit=net_amount     │
│    └── ... (multiple lines jika multiple payment methods)                    │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 6. Update aggregated_transactions                                            │
│                                                                              │
│    UPDATE aggregated_transactions                                            │
│    SET journal_id = <journal_header_id>,                                     │
│        status = 'COMPLETED'                                                  │
│    WHERE id = <transaction_id>                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### 📊 Contoh Data

**Tabel: accounting_purposes**
| id | purpose_code | purpose_name | applied_to |
|----|--------------|--------------|------------|
| uuid-1 | SAL-INV | Sales Invoice | SALES |
| uuid-2 | PUR-INV | Purchase Invoice | PURCHASE |
| uuid-3 | SAL-CSH | Sales Cash | SALES |

**Tabel: accounting_purpose_accounts**
| id | purpose_id | account_id | side | is_required | is_auto | priority |
|----|------------|------------|------|-------------|---------|----------|
| uuid-a1 | uuid-1 | acc-kas | DEBIT | true | true | 1 |
| uuid-a2 | uuid-1 | acc-kredit | DEBIT | true | true | 2 |
| uuid-a3 | uuid-1 | acc-pendapatan | CREDIT | true | true | 1 |
| uuid-a4 | uuid-2 | acc-hutang | CREDIT | true | true | 1 |
| uuid-a5 | uuid-2 | acc-belanja | DEBIT | true | true | 1 |

**Tabel: payment_methods**
| id | name | code | coa_account_id |
|----|------|------|----------------|
| 1 | Cash | CSH | acc-kas |
| 2 | Credit Card | CRD | acc-kredit |
| 3 | Debit Card | DBT | acc-debit |

**Flow saat generate journal untuk POS sales:**
```
Aggregated Transaction:
├── payment_method_id: 1 (Cash)
├── net_amount: 100000
└── source_type: POS_SALES

Step 1: Ambil COA dari payment_methods
        → coa_account_id = acc-kas (karena payment_method_id = 1)

Step 2: Cari accounting purpose (SAL-INV untuk SALES)
        → purpose_id = uuid-1

Step 3: Cari accounting purpose accounts untuk SAL-INV
        → acc-pendapatan (CREDIT, is_auto=true)

Step 4: Build journal lines:
        ├── Line 1: acc-kas, DEBIT, 100000
        └── Line 2: acc-pendapatan, CREDIT, 100000
```

---

### 📝 Journal Workflow (Manual Journals)
```
Create Journal (DRAFT)
        │
        ▼
Submit Journal (status: PENDING_APPROVAL)
        │
        ▼
Approve Journal (status: APPROVED)
        │
        ▼
Post Journal (status: POSTED) ──► Update ledger
```

**Catatan:** Journals yang digenerate otomatis dari POS/aggregated transactions langsung berstatus **POSTED** (tidak perlu approve).

---

### 8. Cara Mengecek Saldo Rekening Bank

Untuk mengetahui saldo rekening bank, Anda perlu memahami relasi antara **bank_accounts** dengan **chart_of_accounts** dan **journal_lines**.

### 8.1 Relasi Antar Tabel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RELASI BANK ACCOUNTS DENGAN AKUNTANSI                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│   bank_accounts     │
├─────────────────────┤
│ id                  │
│ bank_id             │
│ account_name        │
│ account_number      │
│ owner_type          │
│ owner_id            │
│ coa_account_id ─────┼────────────────────────────────┐
└─────────────────────┘                                │
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      chart_of_accounts                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ id                                                               (PK)       │
│ account_code                                                     (e.g., 1-1000)│
│ account_name                                                     (e.g., Bank BCA)│
│ account_type                                                     (ASSET, etc.)│
│ normal_balance                                                   (DEBIT/CREDIT)│
└─────────────────────────────────────────────────────────────────────────────┘
                                                       ▲
                                                       │
               ┌───────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     journal_lines                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ id                                                               (PK)       │
│ journal_header_id                                               (FK)        │
│ account_id ───────────────────────────────────────────────────► (FK)        │
│ debit_amount                                                    (e.g., 100000)│
│ credit_amount                                                   (e.g., 0)      │
│ journal_date                                                                │
│ description                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Cara Mengetahui Saldo Bank

**Langkah 1: Dapatkan Bank Account beserta COA**
```http
GET /api/v1/bank-accounts/:id
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "bank_id": 1,
    "account_name": "BCA Utama",
    "account_number": "1234567890",
    "coa_account_id": "uuid-coa-1",
    "coa_account": {
      "id": "uuid-coa-1",
      "account_code": "1-1000",
      "account_name": "Bank BCA",
      "account_type": "ASSET"
    }
  }
}
```

**Langkah 2: Ambil Journal Lines untuk COA tersebut**
```http
GET /api/v1/accounting/journal-lines/by-account/{coa_account_id}
```

**Query Parameters:**
- `status`: POSTED_ONLY (default untuk reporting)
- `date_from`: Filter tanggal mulai
- `date_to`: Filter tanggal akhir

**Langkah 3: Hitung Saldo**

Saldo dihitung dengan rumus:
```typescript
const total_debit = lines.reduce((sum, line) => sum + line.debit_amount, 0)
const total_credit = lines.reduce((sum, line) => sum + line.credit_amount, 0)
const balance = total_debit - total_credit
```

**Contoh:**
```
Journal Lines untuk Bank BCA (account_code: 1-1000):

| journal_date | description          | debit    | credit   |
|--------------|----------------------|----------|----------|
| 2024-01-01   | Saldo Awal           | 10,000,000| 0        |
| 2024-01-05   | Penjualan Tunai      | 5,000,000 | 0        |
| 2024-01-10   | Pembayaran Supplier  | 0        | 3,000,000|
| 2024-01-15   | Pendapatan Lain      | 2,000,000 | 0        |

Total Debit:  17,000,000
Total Credit:  3,000,000
────────────────────────────
SALDO:        14,000,000
```

### 8.3 Routes untuk Mengecek Saldo

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/api/v1/bank-accounts` | List bank accounts dengan COA |
| GET | `/api/v1/bank-accounts/:id` | Detail bank account |
| GET | `/api/v1/accounting/journal-lines/by-account/:accountId` | Get journal lines by COA |
| GET | `/api/v1/accounting/journal-lines` | List all journal lines |

### 8.4 Endpoint untuk Trial Balance / General Ledger

```http
GET /api/v1/accounting/journal-lines?account_id={coa_account_id}&status=POSTED_ONLY
```

**Response:**
```json
{
  "data": [...],
  "summary": {
    "total_debit": 17000000,
    "total_credit": 3000000,
    "balance": 14000000,
    "line_count": 4
  }
}
```

### 8.5 Konsep Penting

**Normal Balance:**
- **ASSET** (termasuk Bank): Normal balance = **DEBIT**
  - Jika balance positif → Saldo normal (debit > credit)
  - Jika balance negatif → overdraft
- **LIABILITY** (termasuk Hutang Bank): Normal balance = **CREDIT**
- **EQUITY**: Normal balance = **CREDIT**
- **REVENUE**: Normal balance = **CREDIT**
- **EXPENSE**: Normal balance = **DEBIT**

**Interpretasi Saldo Bank:**
```
Account: Bank BCA (ASSET, normal_balance: DEBIT)

balance = 14,000,000 (positif)
→ interpretasi: Saldo positif, rekening memiliki dana

balance = -5,000,000 (negatif)
→ interpretasi: Overdraft / saldo minus
```

---

### 9. Payment Methods Module (`payment-methods/`)

**File:** `backend/src/modules/payment-methods/`

**Fungsi:**
Payment Methods adalah konfigurasi **metode pembayaran** yang digunakan dalam transaksi (POS, sales, purchase). Fungsi utamanya adalah:

1. **Menyimpan COA untuk Jurnal** - Setiap payment method memiliki `coa_account_id` yang akan digunakan sebagai akun DEBIT saat generate journal entry
2. **Link ke Bank Account** - Payment method bisa linked ke bank account tertentu
3. **Klasifikasi Jenis Pembayaran** - Tipe pembayaran (Cash, Card, Bank, etc.)

**Payment Types:**
```typescript
type PaymentType =
  | 'BANK'        // Transfer bank
  | 'CARD'        // Kartu kredit/debit
  | 'CASH'        // Tunai
  | 'COMPLIMENT'  // Gratis/compliment
  | 'MEMBER_DEPOSIT' // Deposit member
  | 'OTHER_COST'  // Biaya lain
```

**Data Model:**
```typescript
interface PaymentMethod {
  id: number
  company_id: string
  code: string              // e.g., 'CSH', 'CRD', 'BCA'
  name: string              // e.g., 'Cash', 'Credit Card', 'BCA Transfer'
  payment_type: PaymentType
  bank_account_id: number | null  // Link ke bank_accounts
  coa_account_id: string | null   // Link ke chart_of_accounts (untuk DEBIT)
  is_active: boolean
  is_default: boolean       // Apakah payment method default
  requires_bank_account: boolean
  sort_order: number
}
```

**Contoh Data:**
| id | code | name | payment_type | coa_account_id | bank_account_id |
|----|------|------|--------------|----------------|-----------------|
| 1 | CSH | Cash | CASH | uuid-coa-kas | null |
| 2 | CRD | Credit Card | CARD | uuid-coa-kredit | null |
| 3 | BCA | BCA Transfer | BANK | uuid-coa-bca | 1 |
| 4 | DEBT | Debit Card | CARD | uuid-coa-debit | null |

**Relasi dengan Module Lain:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PAYMENT METHODS DALAM EKOSISTEM                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│   payment_methods   │
├─────────────────────┤
│ id                  │
│ coa_account_id ─────┼────────────────────────────────┐
│ bank_account_id ────┼─────────────────────────────┐  │
└─────────────────────┘                             │  │
                                                      │  │
              ┌─────────────────────────────────────┘  │
              │                                          │
              ▼                                          ▼
┌─────────────────────────┐              ┌─────────────────────────┐
│   chart_of_accounts     │              │     bank_accounts       │
│ (untuk DEBIT di jurnal) │              │ (link untuk transfer)   │
└─────────────────────────┘              └─────────────────────────┘
              ▲                                          ▲
              │                                          │
              │         ┌───────────────────────────────┘
              │         │
              ▼         │
┌─────────────────────────────────────────────────────────────────────────────┐
│                    journal_lines (saat generate POS journal)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  aggregated_transactions                                                   │
│  ├── payment_method_id = 3 (BCA Transfer)                                 │
│  └── net_amount = 100000                                                  │
│                                                                           │
│  SAAT GENERATE JOURNAL:                                                   │
│  ├── DEBIT: chart_of_accounts dari payment_methods.coa_account_id         │
│  │         → coa_account_id = uuid-coa-bca                                │
│  │         → journal_lines: debit_amount = 100000                         │
│  │                                                                         │
│  └── CREDIT: dari accounting_purpose_accounts                             │
│            → purpose_code = 'SAL-INV', side = 'CREDIT', is_auto = true    │
│            → journal_lines: credit_amount = 100000                         │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Routes:**
```
GET    /api/v1/payment-methods           # List payment methods
GET    /api/v1/payment-methods/options   # Options untuk dropdown
POST   /api/v1/payment-methods           # Create payment method
GET    /api/v1/payment-methods/:id       # Get detail
PUT    /api/v1/payment-methods/:id       # Update
DELETE /api/v1/payment-methods/:id       # Delete
POST   /api/v1/payment-methods/bulk/status  # Bulk update status
```

**Konfigurasi Penting:**
- **coa_account_id** digunakan untuk menentukan akun DEBIT saat transaksi dengan payment method tersebut
- **bank_account_id** digunakan untuk tracking rekening tujuan transfer
- **is_default** - Hanya satu payment method yang bisa default per company
- **requires_bank_account** - Jika true, wajib pilih bank_account

**Contoh Penggunaan:**
```
Scenario: POS Sales dengan payment method "BCA Transfer"

1. Customer bayar Rp 100.000 via BCA Transfer
2. Di aggregated_transactions:
   - payment_method_id = 3 (BCA Transfer)
   - net_amount = 100000

3. Saat generate journal (SAL-INV purpose):
   - DEBIT (line 1):
     payment_methods.coa_account_id = uuid-coa-bca
     → Bank BCA account di journal_lines
     debit_amount = 100000
   
   - CREDIT (line 2):
     accounting_purpose_accounts.side = 'CREDIT'
     → Pendapatan Penjualan account
     credit_amount = 100000

4. Result:
   Journal Entry:
   | Account         | Debit    | Credit   |
   |-----------------|----------|----------|
   | Bank BCA        | 100,000  |          |
   | Pendapatan Sales|          | 100,000  |
```

---

### 7. Branches Module (`branches/`)
**File:** `backend/src/modules/branches/`

**Fungsi:**
- CRUD branches
- Parent-child branch hierarchy
- Branch employees assignment

**Routes:**
```
GET    /api/v1/branches               # List branches
POST   /api/v1/branches               # Create branch
PUT    /api/v1/branches/:id           # Update branch
DELETE /api/v1/branches/:id           # Delete branch

GET    /api/v1/employee-branches      # Employee-branch assignments
POST   /api/v1/employee-branches      # Assign employee to branch
DELETE /api/v1/employee-branches/:id  # Remove assignment
```

**Branch Context Middleware:**
```
Every API Request
        │
        ▼
branch-context.middleware.ts
        │
        ├── Get branch_id from query/params
        │
        ├── Validate branch exists & active
        │
        └── Attach branch to request
            (req.branchContext)
        │
        ▼
Filter data by branch
(supabase query dengan branch_id filter)
```

---

## 🔄 Data Flow Diagrams

### Import Data Flow (POS Imports)
```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────►│  Upload  │────►│  Parse   │────►│ Validate │
│          │     │  Excel   │     │  Excel   │     │  Data    │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                                                        ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │◄────│ Download │◄────│ Job      │◄────│ Insert   │
│          │     │  Result  │     │ Worker   │     │  Lines   │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                                                        ▼
                                               ┌──────────────┐
                                               │ Create       │
                                               │ aggregated_  │
                                               │ transactions │
                                               └──────────────┘
```

### Export Data Flow (Employees/Products)
```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────►│ Create   │────►│  Fetch   │────►│ Generate │
│          │     │  Job     │     │  Data    │     │  Excel   │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                                                        ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │◄────│ Download │◄────│ Upload   │◄────│ Complete │
│          │     │  Result  │     │ to       │     │  Job     │
└──────────┘     └──────────┘     │ Storage  │     └──────────┘
                                  └──────────┘
```

### Journal Generation Flow
```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Trigger │────►│  Fetch   │────►│  Group   │────►│ Lookup   │
│  Job     │     │  TXs     │     │  by Date │     │  COA     │
└──────────┘     └──────────┘     │  & Branch│     └──────────┘
                                  └────┬─────┘
                                       │
                                       ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Update  │◄────│ Insert   │◄────│ Create   │◄────│ Create   │
│  TXs     │     │  Lines   │     │  Header  │     │  Lines   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

---

## 🛠️ Middleware Stack

| Middleware | Fungsi |
|------------|--------|
| `helmet()` | HTTP security headers |
| `cors()` | Cross-origin resource sharing |
| `express.json()` | JSON body parser |
| `requestLogger` | Log semua requests |
| `authenticate` | Verify JWT token |
| `resolveBranchContext` | Resolve branch dari request |
| `canView/canInsert/...` | Permission checks |
| `queryMiddleware` | Pagination & sorting |
| `validateSchema` | Request validation (Zod) |
| `upload` | File upload (Multer) |
| `rateLimiter` | Rate limiting |
| `errorHandler` | Centralized error handling |

---

## 📊 Database Schema Highlights

### Core Tables
```sql
-- Users (Supabase Auth)
auth.users (id, email, created_at)

-- Employees
employees (id, user_id, employee_id, full_name, branch_id, ...)

-- Products
products (id, product_code, product_name, category_id, ...)
categories (id, name, parent_id)
product_uoms (id, product_id, uom_id, conversion_factor)

-- POS Imports
pos_imports (id, file_name, total_rows, status, ...)
pos_import_lines (id, pos_import_id, sales_number, bill_number, ...)

-- Aggregated Transactions
aggregated_transactions (id, branch_name, transaction_date, 
                        payment_method_id, net_amount, journal_id, ...)

-- Accounting
journal_headers (id, journal_number, journal_date, total_amount, status, ...)
journal_lines (id, journal_header_id, account_id, debit_amount, credit_amount, ...)
chart_of_accounts (id, account_code, account_name, account_type, ...)
accounting_purposes (id, purpose_code, purpose_name, ...)
accounting_purpose_accounts (id, purpose_id, account_id, side, ...)

-- Jobs
jobs (id, user_id, company_id, type, module, status, progress, ...)
```

---

## 🚀 Startup Flow

```
server.ts
    │
    ├── load environment variables (dotenv)
    │
    ├── create Express app
    │   ├── register all route modules
    │   ├── setup Swagger UI
    │   └── register error handler
    │
    ├── start HTTP server
    │   └── app.listen(PORT)
    │
    ├── initialize job worker
    │   ├── registerAllProcessors()
    │   ├── jobWorker.startPolling()
    │   └── jobWorker.startCleanup()
    │
    └── setup graceful shutdown handlers
        ├── SIGTERM
        └── SIGINT
```

---

## 📝 Key Features

1. **Modular Architecture** - Setiap feature memiliki module独立的
2. **Background Job Queue** - Export/import berjalan async
3. **Role-Based Access Control** - Permission per action
4. **Branch Context** - Data filtering berdasarkan branch
5. **OpenAPI Documentation** - Auto-generated API docs
6. **Chunked Processing** -处理大量数据 dengan chunk
7. **Retry Mechanism** - Exponential backoff untuk failed operations
8. **Progress Tracking** - Real-time job progress
9. **Audit Logging** - Track perubahan data
10. **File Storage** - Supabase Storage untuk file uploads

---

## 🔗 Useful Links

- **API Docs:** `http://localhost:3000/docs`
- **OpenAPI JSON:** `http://localhost:3000/openapi.json`
- **Health Check:** `http://localhost:3000/health`

---

*Generated: 2025-01-24*
*Project: Sushimas ERP*

