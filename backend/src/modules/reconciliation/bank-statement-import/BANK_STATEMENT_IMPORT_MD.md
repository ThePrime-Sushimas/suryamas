# 📊 Bank Statement Import Module

## 📌 Ringkasan

Module ini berfungsi untuk mengimport mutasi bank dari file Excel, memproses data secara asinkron menggunakan **Job Queue**, dan menyimpannya ke tabel `bank_statements`.

---

## 🎯 Fitur Utama

1. **File Upload** - Upload file Excel mutasi bank (maks. 50MB)
2. **File Analysis** - Validasi format dan preview data
3. **Async Processing** - Processing menggunakan Job Queue (bukan sync)
4. **Bank Statement Records** - Simpan ke tabel `bank_statements`
5. **Reconciliation Ready** - Data siap untuk dicocokkan dengan POS aggregates

---

## 📁 Struktur Folder

```
bank-statement-import/
├── index.ts                              # Module exports
├── bank-statement-import.md              # Documentation (INI FILE)
├── types.ts                              # TypeScript interfaces
├── schema.ts                             # Zod validation schemas
├── errors.ts                             # Error definitions
├── constants.ts                          # Constants
│
├── bank-statement-import.service.ts      # Business logic
├── bank-statement-import.controller.ts   # HTTP handlers
├── bank-statement-import.routes.ts       # Route definitions
├── bank-statement-import.repository.ts   # Database operations
│
└── migrations/
    └── xxxx_create_bank_statements_table.sql
```

---

## 🔄 Alur Kerja

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   EXCEL UPLOAD  │ -> │    ANALYZE      │ -> │  CONFIRM & JOB  │
│                 │     │  (Synchronous)  │     │  (Async)        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                      │
                                                      v
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     REPORT      │ <- │   PROCESSING    │ <- │    WORKER       │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 📊 Database Schema

### Tabel: bank_statements

```sql
CREATE TABLE bank_statements (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL,
  bank_account_id BIGINT NOT NULL,
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_time TIME,
  reference_number VARCHAR(100),
  description TEXT,
  
  -- Amount
  debit_amount DECIMAL(15, 2) DEFAULT 0,
  credit_amount DECIMAL(15, 2) DEFAULT 0,
  balance DECIMAL(15, 2),
  
  -- Classification
  transaction_type VARCHAR(50), -- DEPOSIT, WITHDRAWAL, TRANSFER, etc.
  payment_method_id BIGINT, -- FK ke payment_methods (jika terkait)
  
  -- Reconciliation status
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMP,
  reconciliation_id BIGINT,
  
  -- Import metadata
  source_file VARCHAR(255),
  import_id BIGINT, -- FK ke bank_statement_imports
  row_number INT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  deleted_by UUID,
  
  -- Constraints
  CONSTRAINT fk_bank_account 
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);

-- Indexes
CREATE INDEX idx_bank_statements_company_date 
  ON bank_statements(company_id, transaction_date);

CREATE INDEX idx_bank_statements_bank_account 
  ON bank_statements(bank_account_id, transaction_date);

CREATE INDEX idx_bank_statements_reconciled 
  ON bank_statements(is_reconciled) WHERE is_reconciled = FALSE;

CREATE INDEX idx_bank_statements_reference 
  ON bank_statements(reference_number) WHERE reference_number IS NOT NULL;
```

### Tabel: bank_statement_imports

```sql
CREATE TABLE bank_statement_imports (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL,
  bank_account_id BIGINT NOT NULL,
  
  -- File info
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  file_hash VARCHAR(64), -- MD5/SHA256 untuk duplicate detection
  
  -- Status
  status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, ANALYZED, IMPORTING, COMPLETED, FAILED
  total_rows INT DEFAULT 0,
  processed_rows INT DEFAULT 0,
  failed_rows INT DEFAULT 0,
  
  -- Date range
  date_range_start DATE,
  date_range_end DATE,
  
  -- Error tracking
  error_message TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  created_by UUID,
  
  CONSTRAINT fk_bank_account 
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);
```

---

## 🛣️ API Endpoints

### Upload & Analyze
```
POST /api/v1/bank-statement-imports/upload
- Upload Excel file
- Analyze format & preview data
- Returns: import_id, preview, duplicate analysis
```

### Confirm Import
```
POST /api/v1/bank-statement-imports/:id/confirm
- Create job untuk async processing
- Returns: job_id
```

### Get Import Status
```
GET /api/v1/bank-statement-imports/:id
- Get import details & status
```

### List Imports
```
GET /api/v1/bank-statement-imports
- List all imports with pagination
```

### Delete Import
```
DELETE /api/v1/bank-statement-imports/:id
- Delete import (soft delete)
```

---

## 📋 TypeScript Interfaces

### Main Types (`types.ts`)

```typescript
/**
 * Bank Statement Import Status
 */
export type BankStatementImportStatus =
  | 'PENDING'
  | 'ANALYZED'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'FAILED'

/**
 * Bank Statement Transaction Type
 */
export type BankTransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER'
  | 'PAYMENT'
  | 'FEE'
  | 'INTEREST'
  | 'OTHER'

/**
 * Bank Statement Record
 */
export interface BankStatement {
  id: number
  company_id: string
  bank_account_id: number
  transaction_date: string
  transaction_time?: string
  reference_number?: string
  description?: string
  debit_amount: number
  credit_amount: number
  balance?: number
  transaction_type?: BankTransactionType
  payment_method_id?: number
  is_reconciled: boolean
  reconciled_at?: string
  reconciliation_id?: number
  source_file?: string
  import_id?: number
  row_number?: number
  created_at: string
  updated_at: string
  deleted_at?: string
}

/**
 * Bank Statement Import Record
 */
export interface BankStatementImport {
  id: number
  company_id: string
  bank_account_id: number
  file_name: string
  file_size?: number
  file_hash?: string
  status: BankStatementImportStatus
  total_rows: number
  processed_rows: number
  failed_rows: number
  date_range_start?: string
  date_range_end?: string
  error_message?: string
  created_at: string
  updated_at: string
  created_by?: string
}

/**
 * Create Import DTO
 */
export interface CreateBankStatementImportDto {
  company_id: string
  bank_account_id: number
  file_name: string
  file_size?: number
  file_hash?: string
}

/**
 * Filter Params
 */
export interface BankStatementFilterParams {
  bank_account_id?: number
  transaction_date_from?: string
  transaction_date_to?: string
  is_reconciled?: boolean
  search?: string
}

/**
 * Import Analysis Result
 */
export interface BankStatementAnalysis {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  date_range_start: string
  date_range_end: string
  preview: BankStatementPreviewRow[]
  duplicates?: BankStatementDuplicate[]
}

/**
 * Preview Row
 */
export interface BankStatementPreviewRow {
  row_number: number
  transaction_date: string
  description: string
  debit_amount: number
  credit_amount: number
  balance: number
  is_valid: boolean
  errors?: string[]
}

/**
 * Duplicate Detection
 */
export interface BankStatementDuplicate {
  reference_number: string
  transaction_date: string
  amount: number
  existing_import_id: number
}
```

---

## ✅ Validation Schemas (`schema.ts`)

```typescript
import { z } from 'zod'

// Upload schema
export const uploadBankStatementSchema = z.object({
  body: z.object({
    bank_account_id: z.number().int().positive('Bank account wajib dipilih'),
    branch_id: z.string().optional(),
  }),
  file: z.any() // Multer file
})

// Confirm import schema
export const confirmBankStatementImportSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid import ID'),
  }),
  body: z.object({
    skip_duplicates: z.boolean().optional().default(false),
    dry_run: z.boolean().optional().default(false),
  }),
})

// List query schema
export const bankStatementListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    bank_account_id: z.coerce.number().int().positive().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    is_reconciled: z.coerce.boolean().optional(),
    search: z.string().optional(),
  }),
})
```

---

## 💼 Service Methods (`service.ts`)

### `analyzeFile(file, bankAccountId, companyId, userId)`
- Parse Excel file
- Validasi format bank statement
- Detect duplicates
- Generate preview
- Returns: `{ import, analysis }`

### `confirmImport(importId, companyId, skipDuplicates, userId)`
- Create job dengan `jobsService`
- Update status ke `IMPORTING`
- Returns: `{ import, job_id }`

### `processImport(jobId, importId, companyId, skipDuplicates)`
- Worker function (called by job processor)
- Retrieve stored data
- Parse and validate rows
- Insert ke `bank_statements`
- Update progress
- Returns: processed count

### `list(companyId, pagination, sort, filter)`
- Get imports dengan pagination

### `getStatements(importId, pagination)`
- Get bank statements untuk import

### `delete(id, companyId, userId)`
- Soft delete import dan statements

---

## 🎨 Controller Methods (`controller.ts`)

### `upload(req, res)`
- Handle file upload
- Call `analyzeFile`
- Return preview

### `confirm(req, res)`
- Validate request
- Call `confirmImport`
- Return job_id

### `list(req, res)`
- Handle list query
- Return paginated imports

### `getById(req, res)`
- Get single import dengan status

### `getStatements(req, res)`
- Get statements untuk import

### `delete(req, res)`
- Handle delete request

---

## 🔧 Job Processing

### Job Configuration

```typescript
interface BankStatementImportJob {
  type: 'import'
  module: 'bank_statements'
  metadata: {
    importId: number
    bankAccountId: number
    companyId: string
    skipDuplicates: boolean
    totalRows: number
  }
  user_id: string
  company_id: string
}
```

### Job Processing Flow

```typescript
// Di jobs worker
async function processBankStatementImport(job: BankStatementImportJob) {
  const { importId, companyId, skipDuplicates } = job.metadata
  
  // 1. Retrieve stored data dari temporary storage
  const rows = await retrieveTemporaryData(importId)
  
  // 2. Parse rows
  const statements = rows.map(parseBankStatementRow)
  
  // 3. Filter duplicates jika diperlukan
  if (skipDuplicates) {
    const existing = await checkExistingStatements(statements)
    statements = filterDuplicates(statements, existing)
  }
  
  // 4. Bulk insert dengan batch processing
  const batchSize = 1000
  for (let i = 0; i < statements.length; i += batchSize) {
    const batch = statements.slice(i, i + batchSize)
    await bankStatementsRepository.bulkInsert(batch)
    
    // Update progress
    await updateImportProgress(importId, i + batch.length)
  }
  
  // 5. Complete
  await completeImport(importId)
  
  return { processed: statements.length }
}
```

---

## 📊 Excel Column Mapping

### Standard Bank Statement Format

| Excel Column | Database Field | Required |
|--------------|----------------|----------|
| Tanggal | transaction_date | ✅ |
| Waktu | transaction_time | ❌ |
| Referensi | reference_number | ❌ |
| Keterangan | description | ✅ |
| Debit | debit_amount | ✅* |
| Kredit | credit_amount | ✅* |
| Saldo | balance | ❌ |
| Tipe | transaction_type | ❌ |

*Minimal salah satu (debit/kredit)

### Contoh File Format

```
| Tanggal    | Referensi  | Keterangan              | Debit     | Kredit    | Saldo       |
|------------|------------|-------------------------|-----------|-----------|-------------|
| 2024-01-15 | TRX001     | Setoran Tunai           | 0         | 5,000,000 | 15,000,000  |
| 2024-01-15 | TRX002     | Biaya Admin             | 5,000     | 0         | 14,995,000  |
```

---

## 🚨 Error Codes

| Code | Message | Solution |
|------|---------|----------|
| BS001 | File too large | Maks. 50MB |
| BS002 | Invalid file type | Upload Excel (.xlsx/.xls) |
| BS003 | Missing required columns | Check column format |
| BS004 | Invalid date format | Use YYYY-MM-DD |
| BS005 | Invalid amount format | Use numeric values |
| BS006 | Duplicate transaction | Skip atau override |
| BS007 | Bank account not found | Pilih bank account yang valid |

---

## 🔒 Keamanan

1. **File Validation**
   - Tipe file: hanya Excel (.xlsx, .xls)
   - Maks ukuran: 50MB
   - Virus scan (opsional)

2. **Duplicate Detection**
   - Hash file untuk prevent re-upload
   - Check reference_number + date + amount

3. **Access Control**
   - Company isolation
   - Branch context validation

---

## 📈 Monitoring & Logging

### Log Levels

```typescript
logInfo('BankStatementImport: File analyzed', { 
  import_id, 
  rows: total_rows,
  duplicates: duplicate_count 
})

logWarn('BankStatementImport: Duplicate detected', {
  reference_number,
  existing_import_id
})

logError('BankStatementImport: Processing failed', {
  import_id,
  error: error.message
})
```

### Progress Tracking

```typescript
// Update import progress
await bankStatementImportsRepository.updateProgress(
  importId, 
  processedRows, 
  totalRows
)
```

---

## 🧪 Testing

### Unit Tests

```typescript
describe('BankStatementImportService', () => {
  describe('analyzeFile()', () => {
    it('should parse valid Excel file', async () => {
      // Test parsing
    })
    
    it('should detect duplicates', async () => {
      // Test duplicate detection
    })
    
    it('should reject invalid format', async () => {
      // Test validation
    })
  })
  
  describe('processImport()', () => {
    it('should process all rows', async () => {
      // Test batch processing
    })
    
    it('should handle skip_duplicates', async () => {
      // Test duplicate filtering
    })
  })
})
```

---

## 📚 Referensi

- Module serupa: `pos-imports`
- Job system: `jobs.service.ts`
- Upload middleware: `upload.middleware.ts`
- Excel parsing: `xlsx` library

---

**Last Updated:** 2024  
**Version:** 1.0  
**Author:** Backend Team

