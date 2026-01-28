# 🚀 Bank Statement Import Module - Implementation Guide

## 📋 Table of Contents

1. [Project Setup](#project-setup)
2. [Database Migrations](#database-migrations)
3. [TypeScript Types & Interfaces](#typescript-types--interfaces)
4. [Validation Schemas](#validation-schemas)
5. [Repository Layer](#repository-layer)
6. [Service Layer](#service-layer)
7. [Controller Layer](#controller-layer)
8. [Routes Configuration](#routes-configuration)
9. [Job Processing](#job-processing)
10. [Error Handling](#error-handling)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Checklist](#deployment-checklist)

---

## 1. Project Setup

### 1.1 Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "xlsx": "^0.18.5",
    "multer": "^1.4.5-lts.1",
    "crypto": "^1.0.1",
    "zod": "^3.22.4",
    "@types/multer": "^1.4.11"
  }
}
```

### 1.2 Folder Structure

```
src/modules/bank-statement-import/
├── index.ts
├── types.ts
├── schema.ts
├── errors.ts
├── constants.ts
├── bank-statement-import.service.ts
├── bank-statement-import.controller.ts
├── bank-statement-import.routes.ts
├── bank-statement-import.repository.ts
├── utils/
│   ├── excel-parser.ts
│   ├── duplicate-detector.ts
│   └── validators.ts
└── __tests__/
    ├── service.test.ts
    ├── controller.test.ts
    └── repository.test.ts
```

---

## 2. Database Migrations

### 2.1 Create Bank Statements Table

**File:** `migrations/YYYYMMDDHHMMSS_create_bank_statements_table.sql`

```sql
-- Create bank_statements table
CREATE TABLE IF NOT EXISTS bank_statements (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL,
  bank_account_id BIGINT NOT NULL,
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_time TIME,
  reference_number VARCHAR(100),
  description TEXT NOT NULL,
  
  -- Amount (store in cents/smallest unit)
  debit_amount DECIMAL(15, 2) DEFAULT 0 NOT NULL,
  credit_amount DECIMAL(15, 2) DEFAULT 0 NOT NULL,
  balance DECIMAL(15, 2),
  
  -- Classification
  transaction_type VARCHAR(50),
  payment_method_id BIGINT,
  
  -- Reconciliation status
  is_reconciled BOOLEAN DEFAULT FALSE NOT NULL,
  reconciled_at TIMESTAMPTZ,
  reconciliation_id BIGINT,
  
  -- Import metadata
  source_file VARCHAR(255),
  import_id BIGINT,
  row_number INT,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  deleted_by UUID,
  
  -- Constraints
  CONSTRAINT chk_amount_not_both_zero 
    CHECK (debit_amount > 0 OR credit_amount > 0),
  CONSTRAINT fk_bank_account 
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_bank_statements_company_date 
  ON bank_statements(company_id, transaction_date DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_bank_statements_bank_account 
  ON bank_statements(bank_account_id, transaction_date DESC) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_bank_statements_reconciled 
  ON bank_statements(bank_account_id, is_reconciled) 
  WHERE is_reconciled = FALSE AND deleted_at IS NULL;

CREATE INDEX idx_bank_statements_reference 
  ON bank_statements(reference_number) 
  WHERE reference_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_bank_statements_import 
  ON bank_statements(import_id) 
  WHERE import_id IS NOT NULL AND deleted_at IS NULL;

-- Add comment
COMMENT ON TABLE bank_statements IS 'Stores imported bank statement transactions';
```

### 2.2 Create Bank Statement Imports Table

**File:** `migrations/YYYYMMDDHHMMSS_create_bank_statement_imports_table.sql`

```sql
-- Create bank_statement_imports table
CREATE TABLE IF NOT EXISTS bank_statement_imports (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL,
  bank_account_id BIGINT NOT NULL,
  
  -- File info
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  file_hash VARCHAR(64) UNIQUE, -- For duplicate file detection
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
  total_rows INT DEFAULT 0 NOT NULL,
  processed_rows INT DEFAULT 0 NOT NULL,
  failed_rows INT DEFAULT 0 NOT NULL,
  
  -- Date range from file data
  date_range_start DATE,
  date_range_end DATE,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Job reference
  job_id BIGINT,
  
  -- Analysis result (stored for confirmation)
  analysis_data JSONB,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  
  CONSTRAINT fk_bank_account 
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE,
  CONSTRAINT chk_status_valid 
    CHECK (status IN ('PENDING', 'ANALYZED', 'IMPORTING', 'COMPLETED', 'FAILED'))
);

-- Indexes
CREATE INDEX idx_bank_statement_imports_company 
  ON bank_statement_imports(company_id, created_at DESC);

CREATE INDEX idx_bank_statement_imports_bank_account 
  ON bank_statement_imports(bank_account_id, created_at DESC);

CREATE INDEX idx_bank_statement_imports_status 
  ON bank_statement_imports(status) 
  WHERE status IN ('PENDING', 'IMPORTING');

CREATE UNIQUE INDEX idx_bank_statement_imports_file_hash 
  ON bank_statement_imports(file_hash, company_id) 
  WHERE file_hash IS NOT NULL;

-- Add comment
COMMENT ON TABLE bank_statement_imports IS 'Tracks bank statement file imports';
```

---

## 3. TypeScript Types & Interfaces

### 3.1 types.ts

```typescript
/**
 * Bank Statement Import Module Types
 */

// ==================== ENUMS ====================

export enum BankStatementImportStatus {
  PENDING = 'PENDING',
  ANALYZED = 'ANALYZED',
  IMPORTING = 'IMPORTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum BankTransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  PAYMENT = 'PAYMENT',
  FEE = 'FEE',
  INTEREST = 'INTEREST',
  OTHER = 'OTHER'
}

// ==================== DATABASE MODELS ====================

/**
 * Bank Statement Record (from database)
 */
export interface BankStatement {
  id: number
  company_id: string
  bank_account_id: number
  
  // Transaction details
  transaction_date: string // ISO date string
  transaction_time?: string
  reference_number?: string
  description: string
  
  // Amounts
  debit_amount: number
  credit_amount: number
  balance?: number
  
  // Classification
  transaction_type?: BankTransactionType
  payment_method_id?: number
  
  // Reconciliation
  is_reconciled: boolean
  reconciled_at?: string
  reconciliation_id?: number
  
  // Import metadata
  source_file?: string
  import_id?: number
  row_number?: number
  
  // Audit
  created_at: string
  updated_at?: string
  deleted_at?: string
  created_by?: string
  updated_by?: string
  deleted_by?: string
}

/**
 * Bank Statement Import Record (from database)
 */
export interface BankStatementImport {
  id: number
  company_id: string
  bank_account_id: number
  
  // File info
  file_name: string
  file_size?: number
  file_hash?: string
  
  // Status
  status: BankStatementImportStatus
  total_rows: number
  processed_rows: number
  failed_rows: number
  
  // Date range
  date_range_start?: string
  date_range_end?: string
  
  // Errors
  error_message?: string
  error_details?: Record<string, any>
  
  // Job reference
  job_id?: number
  
  // Stored analysis
  analysis_data?: BankStatementAnalysis
  
  // Audit
  created_at: string
  updated_at?: string
  created_by?: string
}

// ==================== DTOs ====================

/**
 * Create Bank Statement Import DTO
 */
export interface CreateBankStatementImportDto {
  company_id: string
  bank_account_id: number
  file_name: string
  file_size?: number
  file_hash?: string
  created_by?: string
}

/**
 * Update Bank Statement Import DTO
 */
export interface UpdateBankStatementImportDto {
  status?: BankStatementImportStatus
  total_rows?: number
  processed_rows?: number
  failed_rows?: number
  date_range_start?: string
  date_range_end?: string
  error_message?: string
  error_details?: Record<string, any>
  job_id?: number
  analysis_data?: BankStatementAnalysis
  updated_at?: string
}

/**
 * Create Bank Statement DTO
 */
export interface CreateBankStatementDto {
  company_id: string
  bank_account_id: number
  transaction_date: string
  transaction_time?: string
  reference_number?: string
  description: string
  debit_amount: number
  credit_amount: number
  balance?: number
  transaction_type?: BankTransactionType
  source_file?: string
  import_id?: number
  row_number?: number
  created_by?: string
}

// ==================== ANALYSIS TYPES ====================

/**
 * Excel File Analysis Result
 */
export interface BankStatementAnalysis {
  total_rows: number
  valid_rows: number
  invalid_rows: number
  date_range_start?: string
  date_range_end?: string
  preview: BankStatementPreviewRow[]
  duplicates: BankStatementDuplicate[]
  warnings: string[]
  column_mapping: ExcelColumnMapping
}

/**
 * Preview Row (for UI display)
 */
export interface BankStatementPreviewRow {
  row_number: number
  transaction_date: string
  transaction_time?: string
  reference_number?: string
  description: string
  debit_amount: number
  credit_amount: number
  balance?: number
  is_valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Duplicate Detection Result
 */
export interface BankStatementDuplicate {
  reference_number?: string
  transaction_date: string
  debit_amount: number
  credit_amount: number
  description: string
  existing_statement_id?: number
  existing_import_id?: number
  match_score: number // 0-100, higher = more likely duplicate
}

/**
 * Excel Column Mapping
 */
export interface ExcelColumnMapping {
  transaction_date: string // Column name in Excel
  transaction_time?: string
  reference_number?: string
  description: string
  debit_amount: string
  credit_amount: string
  balance?: string
}

// ==================== FILTER & QUERY TYPES ====================

/**
 * Filter params for bank statements
 */
export interface BankStatementFilterParams {
  bank_account_id?: number
  transaction_date_from?: string
  transaction_date_to?: string
  is_reconciled?: boolean
  transaction_type?: BankTransactionType
  search?: string // Search in description or reference_number
  import_id?: number
}

/**
 * Filter params for imports
 */
export interface BankStatementImportFilterParams {
  bank_account_id?: number
  status?: BankStatementImportStatus
  date_from?: string
  date_to?: string
}

/**
 * Pagination params
 */
export interface PaginationParams {
  page: number
  limit: number
}

/**
 * Sort params
 */
export interface SortParams {
  field: string
  order: 'ASC' | 'DESC'
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

// ==================== JOB TYPES ====================

/**
 * Bank Statement Import Job Metadata
 */
export interface BankStatementImportJobMetadata {
  import_id: number
  bank_account_id: number
  company_id: string
  skip_duplicates: boolean
  total_rows: number
  file_name: string
}

/**
 * Job Progress Update
 */
export interface JobProgressUpdate {
  processed_rows: number
  total_rows: number
  percentage: number
  current_status: string
}

// ==================== PARSED ROW TYPE ====================

/**
 * Parsed row from Excel (before validation)
 */
export interface ParsedBankStatementRow {
  row_number: number
  transaction_date?: string | Date
  transaction_time?: string
  reference_number?: string
  description?: string
  debit_amount?: string | number
  credit_amount?: string | number
  balance?: string | number
  raw_data: Record<string, any>
}

/**
 * Validated row (ready for insert)
 */
export interface ValidatedBankStatementRow extends CreateBankStatementDto {
  row_number: number
}

// ==================== ERROR TYPES ====================

/**
 * Row validation error
 */
export interface RowValidationError {
  row_number: number
  field: string
  message: string
  received_value: any
}

/**
 * Import error details
 */
export interface ImportErrorDetails {
  stage: 'UPLOAD' | 'ANALYSIS' | 'PROCESSING' | 'COMPLETION'
  error_code: string
  errors: RowValidationError[]
  timestamp: string
}

// ==================== UTILITY TYPES ====================

/**
 * File upload result
 */
export interface FileUploadResult {
  file_name: string
  file_size: number
  file_path: string
  file_hash: string
  mime_type: string
}

/**
 * Duplicate check params
 */
export interface DuplicateCheckParams {
  company_id: string
  bank_account_id: number
  statements: Array<{
    transaction_date: string
    reference_number?: string
    debit_amount: number
    credit_amount: number
    description: string
  }>
}

export type { };
```

---

## 4. Validation Schemas

### 4.1 schema.ts

```typescript
import { z } from 'zod';
import { BankStatementImportStatus, BankTransactionType } from './types';

/**
 * Upload Bank Statement Schema
 */
export const uploadBankStatementSchema = z.object({
  body: z.object({
    bank_account_id: z.coerce
      .number()
      .int()
      .positive('Bank account ID must be a positive integer'),
  }),
});

/**
 * Confirm Import Schema
 */
export const confirmBankStatementImportSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Import ID must be a valid number'),
  }),
  body: z.object({
    skip_duplicates: z.boolean().optional().default(false),
    dry_run: z.boolean().optional().default(false),
  }),
});

/**
 * Get Import By ID Schema
 */
export const getImportByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Import ID must be a valid number'),
  }),
});

/**
 * Delete Import Schema
 */
export const deleteImportSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Import ID must be a valid number'),
  }),
});

/**
 * List Imports Query Schema
 */
export const listImportsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    bank_account_id: z.coerce.number().int().positive().optional(),
    status: z.nativeEnum(BankStatementImportStatus).optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }),
});

/**
 * List Bank Statements Query Schema
 */
export const listBankStatementsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    bank_account_id: z.coerce.number().int().positive().optional(),
    transaction_date_from: z.string().date().optional(),
    transaction_date_to: z.string().date().optional(),
    is_reconciled: z.coerce.boolean().optional(),
    transaction_type: z.nativeEnum(BankTransactionType).optional(),
    search: z.string().optional(),
    import_id: z.coerce.number().int().positive().optional(),
  }),
});

/**
 * Get Import Statements Schema
 */
export const getImportStatementsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Import ID must be a valid number'),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
});

/**
 * Bank Statement Row Schema (for validation)
 */
export const bankStatementRowSchema = z.object({
  transaction_date: z.string().date('Invalid date format (use YYYY-MM-DD)'),
  transaction_time: z.string().time().optional(),
  reference_number: z.string().max(100).optional(),
  description: z.string().min(1, 'Description is required').max(1000),
  debit_amount: z.number().min(0).default(0),
  credit_amount: z.number().min(0).default(0),
  balance: z.number().optional(),
  transaction_type: z.nativeEnum(BankTransactionType).optional(),
}).refine(
  (data) => data.debit_amount > 0 || data.credit_amount > 0,
  {
    message: 'Either debit or credit amount must be greater than 0',
    path: ['debit_amount', 'credit_amount'],
  }
);

/**
 * File validation
 */
export const validateUploadedFile = (file: Express.Multer.File | undefined): void => {
  if (!file) {
    throw new Error('No file uploaded');
  }

  // Check file type
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed');
  }

  // Check file size (50MB max)
  const maxSize = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > maxSize) {
    throw new Error('File size exceeds maximum allowed size (50MB)');
  }

  // Check file extension
  const allowedExtensions = ['.xlsx', '.xls'];
  const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    throw new Error('Invalid file extension. Only .xlsx and .xls files are allowed');
  }
};

export type UploadBankStatementInput = z.infer<typeof uploadBankStatementSchema>;
export type ConfirmImportInput = z.infer<typeof confirmBankStatementImportSchema>;
export type ListImportsQueryInput = z.infer<typeof listImportsQuerySchema>;
export type ListBankStatementsQueryInput = z.infer<typeof listBankStatementsQuerySchema>;
```

---

## 5. Repository Layer

### 5.1 bank-statement-import.repository.ts

```typescript
import { Pool, PoolClient } from 'pg';
import {
  BankStatementImport,
  BankStatement,
  CreateBankStatementImportDto,
  UpdateBankStatementImportDto,
  CreateBankStatementDto,
  BankStatementFilterParams,
  BankStatementImportFilterParams,
  PaginationParams,
  SortParams,
  PaginatedResponse,
} from './types';

export class BankStatementImportRepository {
  constructor(private readonly pool: Pool) {}

  // ==================== IMPORTS ====================

  /**
   * Create a new bank statement import record
   */
  async createImport(
    dto: CreateBankStatementImportDto,
    client?: PoolClient
  ): Promise<BankStatementImport> {
    const db = client || this.pool;

    const query = `
      INSERT INTO bank_statement_imports (
        company_id, bank_account_id, file_name, file_size, file_hash, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      dto.company_id,
      dto.bank_account_id,
      dto.file_name,
      dto.file_size || null,
      dto.file_hash || null,
      dto.created_by || null,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update bank statement import
   */
  async updateImport(
    id: number,
    dto: UpdateBankStatementImportDto,
    client?: PoolClient
  ): Promise<BankStatementImport> {
    const db = client || this.pool;

    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (dto.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(dto.status);
    }
    if (dto.total_rows !== undefined) {
      fields.push(`total_rows = $${paramCount++}`);
      values.push(dto.total_rows);
    }
    if (dto.processed_rows !== undefined) {
      fields.push(`processed_rows = $${paramCount++}`);
      values.push(dto.processed_rows);
    }
    if (dto.failed_rows !== undefined) {
      fields.push(`failed_rows = $${paramCount++}`);
      values.push(dto.failed_rows);
    }
    if (dto.date_range_start !== undefined) {
      fields.push(`date_range_start = $${paramCount++}`);
      values.push(dto.date_range_start);
    }
    if (dto.date_range_end !== undefined) {
      fields.push(`date_range_end = $${paramCount++}`);
      values.push(dto.date_range_end);
    }
    if (dto.error_message !== undefined) {
      fields.push(`error_message = $${paramCount++}`);
      values.push(dto.error_message);
    }
    if (dto.error_details !== undefined) {
      fields.push(`error_details = $${paramCount++}`);
      values.push(JSON.stringify(dto.error_details));
    }
    if (dto.job_id !== undefined) {
      fields.push(`job_id = $${paramCount++}`);
      values.push(dto.job_id);
    }
    if (dto.analysis_data !== undefined) {
      fields.push(`analysis_data = $${paramCount++}`);
      values.push(JSON.stringify(dto.analysis_data));
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE bank_statement_imports
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error(`Import with ID ${id} not found`);
    }

    return result.rows[0];
  }

  /**
   * Get import by ID
   */
  async getImportById(
    id: number,
    companyId: string
  ): Promise<BankStatementImport | null> {
    const query = `
      SELECT * FROM bank_statement_imports
      WHERE id = $1 AND company_id = $2
    `;

    const result = await this.pool.query(query, [id, companyId]);
    return result.rows[0] || null;
  }

  /**
   * Check if file hash exists (duplicate file detection)
   */
  async checkFileHashExists(
    fileHash: string,
    companyId: string
  ): Promise<BankStatementImport | null> {
    const query = `
      SELECT * FROM bank_statement_imports
      WHERE file_hash = $1 AND company_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [fileHash, companyId]);
    return result.rows[0] || null;
  }

  /**
   * List imports with filters and pagination
   */
  async listImports(
    companyId: string,
    pagination: PaginationParams,
    sort: SortParams,
    filter?: BankStatementImportFilterParams
  ): Promise<PaginatedResponse<BankStatementImport>> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['company_id = $1'];
    const values: any[] = [companyId];
    let paramCount = 2;

    if (filter?.bank_account_id) {
      conditions.push(`bank_account_id = $${paramCount++}`);
      values.push(filter.bank_account_id);
    }

    if (filter?.status) {
      conditions.push(`status = $${paramCount++}`);
      values.push(filter.status);
    }

    if (filter?.date_from) {
      conditions.push(`created_at >= $${paramCount++}`);
      values.push(filter.date_from);
    }

    if (filter?.date_to) {
      conditions.push(`created_at <= $${paramCount++}`);
      values.push(filter.date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${sort.field} ${sort.order}`;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM bank_statement_imports
      ${whereClause}
    `;

    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get data
    const dataQuery = `
      SELECT *
      FROM bank_statement_imports
      ${whereClause}
      ${orderClause}
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `;

    values.push(limit, offset);
    const dataResult = await this.pool.query(dataQuery, values);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Delete import (soft delete)
   */
  async deleteImport(
    id: number,
    companyId: string,
    userId: string
  ): Promise<void> {
    const query = `
      UPDATE bank_statement_imports
      SET deleted_at = NOW(), deleted_by = $3
      WHERE id = $1 AND company_id = $2
    `;

    await this.pool.query(query, [id, companyId, userId]);
  }

  // ==================== BANK STATEMENTS ====================

  /**
   * Bulk insert bank statements
   */
  async bulkInsertStatements(
    statements: CreateBankStatementDto[],
    client?: PoolClient
  ): Promise<number> {
    if (statements.length === 0) return 0;

    const db = client || this.pool;

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramCount = 1;

    statements.forEach((stmt) => {
      const placeholder = `(
        $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++},
        $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++},
        $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++},
        $${paramCount++}
      )`;
      
      placeholders.push(placeholder);
      
      values.push(
        stmt.company_id,
        stmt.bank_account_id,
        stmt.transaction_date,
        stmt.transaction_time || null,
        stmt.reference_number || null,
        stmt.description,
        stmt.debit_amount,
        stmt.credit_amount,
        stmt.balance || null,
        stmt.transaction_type || null,
        stmt.source_file || null,
        stmt.import_id || null,
        stmt.row_number || null
      );
    });

    const query = `
      INSERT INTO bank_statements (
        company_id, bank_account_id, transaction_date, transaction_time,
        reference_number, description, debit_amount, credit_amount,
        balance, transaction_type, source_file, import_id, row_number
      ) VALUES ${placeholders.join(', ')}
    `;

    const result = await db.query(query, values);
    return result.rowCount || 0;
  }

  /**
   * Check for existing statements (duplicate detection)
   */
  async checkExistingStatements(params: {
    company_id: string;
    bank_account_id: number;
    statements: Array<{
      transaction_date: string;
      reference_number?: string;
      debit_amount: number;
      credit_amount: number;
      description: string;
    }>;
  }): Promise<BankStatement[]> {
    if (params.statements.length === 0) return [];

    const conditions: string[] = [];
    
    params.statements.forEach((stmt, index) => {
      const cond = `(
        transaction_date = '${stmt.transaction_date}' 
        AND debit_amount = ${stmt.debit_amount}
        AND credit_amount = ${stmt.credit_amount}
        ${stmt.reference_number ? `AND reference_number = '${stmt.reference_number}'` : ''}
      )`;
      conditions.push(cond);
    });

    const query = `
      SELECT *
      FROM bank_statements
      WHERE company_id = $1 
        AND bank_account_id = $2
        AND deleted_at IS NULL
        AND (${conditions.join(' OR ')})
    `;

    const result = await this.pool.query(query, [
      params.company_id,
      params.bank_account_id,
    ]);

    return result.rows;
  }

  /**
   * List bank statements
   */
  async listStatements(
    companyId: string,
    pagination: PaginationParams,
    sort: SortParams,
    filter?: BankStatementFilterParams
  ): Promise<PaginatedResponse<BankStatement>> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['company_id = $1', 'deleted_at IS NULL'];
    const values: any[] = [companyId];
    let paramCount = 2;

    if (filter?.bank_account_id) {
      conditions.push(`bank_account_id = $${paramCount++}`);
      values.push(filter.bank_account_id);
    }

    if (filter?.transaction_date_from) {
      conditions.push(`transaction_date >= $${paramCount++}`);
      values.push(filter.transaction_date_from);
    }

    if (filter?.transaction_date_to) {
      conditions.push(`transaction_date <= $${paramCount++}`);
      values.push(filter.transaction_date_to);
    }

    if (filter?.is_reconciled !== undefined) {
      conditions.push(`is_reconciled = $${paramCount++}`);
      values.push(filter.is_reconciled);
    }

    if (filter?.transaction_type) {
      conditions.push(`transaction_type = $${paramCount++}`);
      values.push(filter.transaction_type);
    }

    if (filter?.import_id) {
      conditions.push(`import_id = $${paramCount++}`);
      values.push(filter.import_id);
    }

    if (filter?.search) {
      conditions.push(`(
        description ILIKE $${paramCount} OR 
        reference_number ILIKE $${paramCount}
      )`);
      values.push(`%${filter.search}%`);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const orderClause = `ORDER BY ${sort.field} ${sort.order}`;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM bank_statements
      ${whereClause}
    `;

    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get data
    const dataQuery = `
      SELECT *
      FROM bank_statements
      ${whereClause}
      ${orderClause}
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `;

    values.push(limit, offset);
    const dataResult = await this.pool.query(dataQuery, values);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Delete statements by import_id
   */
  async deleteStatementsByImportId(
    importId: number,
    companyId: string,
    userId: string,
    client?: PoolClient
  ): Promise<number> {
    const db = client || this.pool;

    const query = `
      UPDATE bank_statements
      SET deleted_at = NOW(), deleted_by = $3
      WHERE import_id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    const result = await db.query(query, [importId, companyId, userId]);
    return result.rowCount || 0;
  }
}
```

---

## 6. Service Layer

### 6.1 utils/excel-parser.ts

```typescript
import * as XLSX from 'xlsx';
import {
  ParsedBankStatementRow,
  ExcelColumnMapping,
  BankStatementAnalysis,
} from '../types';

/**
 * Excel Parser Utility
 */
export class ExcelParser {
  private readonly REQUIRED_COLUMNS = [
    'transaction_date',
    'description',
  ];

  private readonly AMOUNT_COLUMNS = ['debit_amount', 'credit_amount'];

  /**
   * Detect column mapping from Excel headers
   */
  detectColumnMapping(headers: string[]): ExcelColumnMapping {
    const mapping: Partial<ExcelColumnMapping> = {};

    // Normalize headers (lowercase, trim)
    const normalizedHeaders = headers.map((h) => 
      h?.toLowerCase().trim().replace(/\s+/g, '_')
    );

    // Common column name variations
    const columnVariations: Record<string, string[]> = {
      transaction_date: ['tanggal', 'date', 'tgl', 'transaction_date', 'trx_date'],
      transaction_time: ['waktu', 'time', 'jam', 'transaction_time'],
      reference_number: ['referensi', 'reference', 'ref', 'no_ref', 'ref_number'],
      description: ['keterangan', 'description', 'desc', 'keterangan', 'memo'],
      debit_amount: ['debit', 'debet', 'keluar', 'withdrawal'],
      credit_amount: ['kredit', 'credit', 'masuk', 'deposit'],
      balance: ['saldo', 'balance', 'bal'],
    };

    // Match columns
    Object.entries(columnVariations).forEach(([key, variations]) => {
      const matchIndex = normalizedHeaders.findIndex((h) =>
        variations.some((v) => h?.includes(v))
      );

      if (matchIndex !== -1) {
        mapping[key as keyof ExcelColumnMapping] = headers[matchIndex];
      }
    });

    // Validate required columns
    if (!mapping.transaction_date) {
      throw new Error('Column "Tanggal" (transaction_date) not found');
    }
    if (!mapping.description) {
      throw new Error('Column "Keterangan" (description) not found');
    }
    if (!mapping.debit_amount && !mapping.credit_amount) {
      throw new Error('At least one amount column (Debit or Kredit) required');
    }

    return mapping as ExcelColumnMapping;
  }

  /**
   * Parse Excel file to array of rows
   */
  parseExcelFile(
    filePath: string
  ): { rows: ParsedBankStatementRow[]; mapping: ExcelColumnMapping } {
    // Read workbook
    const workbook = XLSX.readFile(filePath);
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null,
    });

    if (rawData.length === 0) {
      throw new Error('Excel file is empty');
    }

    // Detect column mapping
    const headers = Object.keys(rawData[0]);
    const mapping = this.detectColumnMapping(headers);

    // Parse rows
    const rows: ParsedBankStatementRow[] = rawData.map((row, index) => ({
      row_number: index + 2, // Excel row number (1-indexed + header row)
      transaction_date: this.extractValue(row, mapping.transaction_date),
      transaction_time: mapping.transaction_time 
        ? this.extractValue(row, mapping.transaction_time)
        : undefined,
      reference_number: mapping.reference_number
        ? this.extractValue(row, mapping.reference_number)
        : undefined,
      description: this.extractValue(row, mapping.description),
      debit_amount: mapping.debit_amount
        ? this.extractValue(row, mapping.debit_amount)
        : 0,
      credit_amount: mapping.credit_amount
        ? this.extractValue(row, mapping.credit_amount)
        : 0,
      balance: mapping.balance
        ? this.extractValue(row, mapping.balance)
        : undefined,
      raw_data: row,
    }));

    return { rows, mapping };
  }

  /**
   * Extract and clean value from row
   */
  private extractValue(row: any, columnName?: string): any {
    if (!columnName) return null;
    
    let value = row[columnName];
    
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Clean string values
    if (typeof value === 'string') {
      value = value.trim();
      
      // Empty string after trim
      if (value === '') return null;
      
      // Remove thousand separators and convert to number if numeric
      if (/^[\d,.\s]+$/.test(value)) {
        value = value.replace(/[,\s]/g, '');
        const numValue = parseFloat(value);
        return isNaN(numValue) ? value : numValue;
      }
    }

    return value;
  }

  /**
   * Parse date from various formats
   */
  parseDate(value: any): Date | null {
    if (!value) return null;

    // Already a Date object
    if (value instanceof Date) return value;

    // String date
    if (typeof value === 'string') {
      // Try ISO format first
      const isoDate = new Date(value);
      if (!isNaN(isoDate.getTime())) return isoDate;

      // Try DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (dmyMatch) {
        const [, day, month, year] = dmyMatch;
        return new Date(`${year}-${month}-${day}`);
      }
    }

    // Excel serial date number
    if (typeof value === 'number') {
      return XLSX.SSF.parse_date_code(value);
    }

    return null;
  }

  /**
   * Parse amount (handle various number formats)
   */
  parseAmount(value: any): number {
    if (value === null || value === undefined) return 0;

    if (typeof value === 'number') return value;

    if (typeof value === 'string') {
      // Remove currency symbols, thousand separators
      const cleaned = value.replace(/[Rp$€£¥,\s]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }

    return 0;
  }
}
```

### 6.2 utils/duplicate-detector.ts

```typescript
import {
  BankStatement,
  BankStatementDuplicate,
  ParsedBankStatementRow,
} from '../types';

/**
 * Duplicate Detection Utility
 */
export class DuplicateDetector {
  /**
   * Calculate match score between two transactions
   */
  private calculateMatchScore(
    row: ParsedBankStatementRow,
    existing: BankStatement
  ): number {
    let score = 0;

    // Date match (30 points)
    if (row.transaction_date === existing.transaction_date) {
      score += 30;
    }

    // Amount match (40 points)
    const rowDebit = typeof row.debit_amount === 'number' 
      ? row.debit_amount 
      : parseFloat(String(row.debit_amount || 0));
    const rowCredit = typeof row.credit_amount === 'number'
      ? row.credit_amount
      : parseFloat(String(row.credit_amount || 0));

    if (rowDebit === existing.debit_amount && rowCredit === existing.credit_amount) {
      score += 40;
    }

    // Reference number match (20 points)
    if (row.reference_number && row.reference_number === existing.reference_number) {
      score += 20;
    }

    // Description similarity (10 points)
    if (row.description && existing.description) {
      const similarity = this.calculateStringSimilarity(
        String(row.description).toLowerCase(),
        existing.description.toLowerCase()
      );
      score += similarity * 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Detect duplicates between new rows and existing statements
   */
  detectDuplicates(
    rows: ParsedBankStatementRow[],
    existingStatements: BankStatement[],
    threshold: number = 80
  ): BankStatementDuplicate[] {
    const duplicates: BankStatementDuplicate[] = [];

    rows.forEach((row) => {
      existingStatements.forEach((existing) => {
        const matchScore = this.calculateMatchScore(row, existing);

        if (matchScore >= threshold) {
          duplicates.push({
            reference_number: row.reference_number || undefined,
            transaction_date: String(row.transaction_date),
            debit_amount: typeof row.debit_amount === 'number'
              ? row.debit_amount
              : parseFloat(String(row.debit_amount || 0)),
            credit_amount: typeof row.credit_amount === 'number'
              ? row.credit_amount
              : parseFloat(String(row.credit_amount || 0)),
            description: String(row.description || ''),
            existing_statement_id: existing.id,
            existing_import_id: existing.import_id,
            match_score: matchScore,
          });
        }
      });
    });

    // Remove duplicate entries (same row matched multiple times)
    const uniqueDuplicates = duplicates.filter((dup, index, self) =>
      index === self.findIndex((d) =>
        d.transaction_date === dup.transaction_date &&
        d.debit_amount === dup.debit_amount &&
        d.credit_amount === dup.credit_amount &&
        d.reference_number === dup.reference_number
      )
    );

    return uniqueDuplicates;
  }
}
```

### 6.3 utils/validators.ts

```typescript
import {
  ParsedBankStatementRow,
  ValidatedBankStatementRow,
  RowValidationError,
  BankStatementPreviewRow,
} from '../types';
import { ExcelParser } from './excel-parser';
import { bankStatementRowSchema } from '../schema';

/**
 * Row Validator Utility
 */
export class RowValidator {
  constructor(private readonly excelParser: ExcelParser) {}

  /**
   * Validate and transform parsed rows
   */
  validateRows(
    rows: ParsedBankStatementRow[],
    companyId: string,
    bankAccountId: number,
    importId: number
  ): {
    validRows: ValidatedBankStatementRow[];
    invalidRows: BankStatementPreviewRow[];
    errors: RowValidationError[];
  } {
    const validRows: ValidatedBankStatementRow[] = [];
    const invalidRows: BankStatementPreviewRow[] = [];
    const errors: RowValidationError[] = [];

    rows.forEach((row) => {
      try {
        const validated = this.validateRow(row, companyId, bankAccountId, importId);
        validRows.push(validated);
      } catch (error: any) {
        const rowErrors = this.extractValidationErrors(error, row.row_number);
        errors.push(...rowErrors);

        invalidRows.push(this.createPreviewRow(row, false, rowErrors));
      }
    });

    return { validRows, invalidRows, errors };
  }

  /**
   * Validate single row
   */
  private validateRow(
    row: ParsedBankStatementRow,
    companyId: string,
    bankAccountId: number,
    importId: number
  ): ValidatedBankStatementRow {
    // Parse date
    const transactionDate = this.excelParser.parseDate(row.transaction_date);
    if (!transactionDate) {
      throw new Error('Invalid transaction date');
    }

    // Parse amounts
    const debitAmount = this.excelParser.parseAmount(row.debit_amount);
    const creditAmount = this.excelParser.parseAmount(row.credit_amount);
    const balance = row.balance ? this.excelParser.parseAmount(row.balance) : undefined;

    // Create DTO
    const dto = {
      transaction_date: transactionDate.toISOString().split('T')[0],
      transaction_time: row.transaction_time || undefined,
      reference_number: row.reference_number || undefined,
      description: String(row.description || '').trim(),
      debit_amount: debitAmount,
      credit_amount: creditAmount,
      balance,
    };

    // Validate with Zod schema
    const validated = bankStatementRowSchema.parse(dto);

    // Return with additional fields
    return {
      ...validated,
      company_id: companyId,
      bank_account_id: bankAccountId,
      import_id: importId,
      row_number: row.row_number,
    };
  }

  /**
   * Extract validation errors from thrown error
   */
  private extractValidationErrors(
    error: any,
    rowNumber: number
  ): RowValidationError[] {
    const errors: RowValidationError[] = [];

    if (error.errors && Array.isArray(error.errors)) {
      // Zod validation errors
      error.errors.forEach((err: any) => {
        errors.push({
          row_number: rowNumber,
          field: err.path.join('.'),
          message: err.message,
          received_value: err.received,
        });
      });
    } else {
      // Generic error
      errors.push({
        row_number: rowNumber,
        field: 'general',
        message: error.message || 'Unknown error',
        received_value: null,
      });
    }

    return errors;
  }

  /**
   * Create preview row for UI display
   */
  createPreviewRow(
    row: ParsedBankStatementRow,
    isValid: boolean,
    errors: RowValidationError[] = []
  ): BankStatementPreviewRow {
    return {
      row_number: row.row_number,
      transaction_date: String(row.transaction_date || ''),
      transaction_time: row.transaction_time,
      reference_number: row.reference_number,
      description: String(row.description || ''),
      debit_amount: this.excelParser.parseAmount(row.debit_amount),
      credit_amount: this.excelParser.parseAmount(row.credit_amount),
      balance: row.balance ? this.excelParser.parseAmount(row.balance) : undefined,
      is_valid: isValid,
      errors: errors.map((e) => e.message),
      warnings: [],
    };
  }

  /**
   * Generate preview rows (first N rows + sample of invalid rows)
   */
  generatePreview(
    rows: ParsedBankStatementRow[],
    maxPreviewRows: number = 10
  ): BankStatementPreviewRow[] {
    const preview: BankStatementPreviewRow[] = [];

    // Add first N rows
    const firstRows = rows.slice(0, maxPreviewRows);
    firstRows.forEach((row) => {
      preview.push(this.createPreviewRow(row, true));
    });

    return preview;
  }
}
```

### 6.4 bank-statement-import.service.ts (Part 1)

```typescript
import crypto from 'crypto';
import fs from 'fs/promises';
import {
  BankStatementImport,
  BankStatement,
  CreateBankStatementImportDto,
  UpdateBankStatementImportDto,
  BankStatementAnalysis,
  BankStatementImportStatus,
  BankStatementFilterParams,
  BankStatementImportFilterParams,
  PaginationParams,
  SortParams,
  PaginatedResponse,
  FileUploadResult,
} from './types';
import { BankStatementImportRepository } from './bank-statement-import.repository';
import { ExcelParser } from './utils/excel-parser';
import { DuplicateDetector } from './utils/duplicate-detector';
import { RowValidator } from './utils/validators';
import { JobsService } from '../jobs/jobs.service';
import { Logger } from '../../utils/logger';

export class BankStatementImportService {
  private readonly excelParser: ExcelParser;
  private readonly duplicateDetector: DuplicateDetector;
  private readonly rowValidator: RowValidator;

  constructor(
    private readonly repository: BankStatementImportRepository,
    private readonly jobsService: JobsService,
    private readonly logger: Logger
  ) {
    this.excelParser = new ExcelParser();
    this.duplicateDetector = new DuplicateDetector();
    this.rowValidator = new RowValidator(this.excelParser);
  }

  /**
   * Analyze uploaded file
   */
  async analyzeFile(
    fileResult: FileUploadResult,
    bankAccountId: number,
    companyId: string,
    userId: string
  ): Promise<{
    import: BankStatementImport;
    analysis: BankStatementAnalysis;
  }> {
    this.logger.info('BankStatementImport: Starting file analysis', {
      file_name: fileResult.file_name,
      bank_account_id: bankAccountId,
      company_id: companyId,
    });

    try {
      // Check for duplicate file
      const existingImport = await this.repository.checkFileHashExists(
        fileResult.file_hash,
        companyId
      );

      if (existingImport) {
        throw new Error(
          `File already imported (Import ID: ${existingImport.id})`
        );
      }

      // Parse Excel file
      const { rows, mapping } = this.excelParser.parseExcelFile(
        fileResult.file_path
      );

      if (rows.length === 0) {
        throw new Error('No data rows found in Excel file');
      }

      // Create import record
      const createDto: CreateBankStatementImportDto = {
        company_id: companyId,
        bank_account_id: bankAccountId,
        file_name: fileResult.file_name,
        file_size: fileResult.file_size,
        file_hash: fileResult.file_hash,
        created_by: userId,
      };

      const importRecord = await this.repository.createImport(createDto);

      // Validate rows for preview
      const { validRows, invalidRows, errors } = this.rowValidator.validateRows(
        rows,
        companyId,
        bankAccountId,
        importRecord.id
      );

      // Generate preview (first 10 valid rows)
      const preview = this.rowValidator.generatePreview(rows, 10);

      // Check for duplicates
      const existingStatements = await this.repository.checkExistingStatements({
        company_id: companyId,
        bank_account_id: bankAccountId,
        statements: validRows.map((r) => ({
          transaction_date: r.transaction_date,
          reference_number: r.reference_number,
          debit_amount: r.debit_amount,
          credit_amount: r.credit_amount,
          description: r.description,
        })),
      });

      const duplicates = this.duplicateDetector.detectDuplicates(
        rows,
        existingStatements,
        80 // 80% match threshold
      );

      // Calculate date range
      const dates = validRows.map((r) => new Date(r.transaction_date));
      const dateRangeStart = dates.length > 0
        ? new Date(Math.min(...dates.map((d) => d.getTime())))
        : undefined;
      const dateRangeEnd = dates.length > 0
        ? new Date(Math.max(...dates.map((d) => d.getTime())))
        : undefined;

      // Create analysis result
      const analysis: BankStatementAnalysis = {
        total_rows: rows.length,
        valid_rows: validRows.length,
        invalid_rows: invalidRows.length,
        date_range_start: dateRangeStart?.toISOString().split('T')[0],
        date_range_end: dateRangeEnd?.toISOString().split('T')[0],
        preview,
        duplicates,
        warnings: [],
        column_mapping: mapping,
      };

      // Add warnings
      if (duplicates.length > 0) {
        analysis.warnings.push(
          `Found ${duplicates.length} potential duplicate(s)`
        );
      }
      if (invalidRows.length > 0) {
        analysis.warnings.push(
          `Found ${invalidRows.length} invalid row(s)`
        );
      }

      // Update import record with analysis
      await this.repository.updateImport(importRecord.id, {
        status: BankStatementImportStatus.ANALYZED,
        total_rows: rows.length,
        date_range_start: dateRangeStart?.toISOString().split('T')[0],
        date_range_end: dateRangeEnd?.toISOString().split('T')[0],
        analysis_data: analysis,
      });

      // Store temporary data for later processing
      await this.storeTemporaryData(importRecord.id, rows);

      this.logger.info('BankStatementImport: File analysis completed', {
        import_id: importRecord.id,
        total_rows: rows.length,
        valid_rows: validRows.length,
        duplicates: duplicates.length,
      });

      return {
        import: { ...importRecord, analysis_data: analysis },
        analysis,
      };
    } catch (error: any) {
      this.logger.error('BankStatementImport: File analysis failed', {
        error: error.message,
        file_name: fileResult.file_name,
      });

      throw error;
    }
  }

  /**
   * Confirm import and create job
   */
  async confirmImport(
    importId: number,
    companyId: string,
    skipDuplicates: boolean,
    userId: string
  ): Promise<{
    import: BankStatementImport;
    job_id: number;
  }> {
    this.logger.info('BankStatementImport: Confirming import', {
      import_id: importId,
      skip_duplicates: skipDuplicates,
    });

    // Get import record
    const importRecord = await this.repository.getImportById(importId, companyId);

    if (!importRecord) {
      throw new Error('Import not found');
    }

    if (importRecord.status !== BankStatementImportStatus.ANALYZED) {
      throw new Error('Import must be in ANALYZED status to confirm');
    }

    // Create job
    const job = await this.jobsService.createJob({
      type: 'import',
      module: 'bank_statements',
      metadata: {
        importId,
        bankAccountId: importRecord.bank_account_id,
        companyId,
        skipDuplicates,
        totalRows: importRecord.total_rows,
      },
      user_id: userId,
      company_id: companyId,
    });

    // Update import status
    const updatedImport = await this.repository.updateImport(importId, {
      status: BankStatementImportStatus.IMPORTING,
      job_id: job.id,
    });

    this.logger.info('BankStatementImport: Job created', {
      import_id: importId,
      job_id: job.id,
    });

    return {
      import: updatedImport,
      job_id: job.id,
    };
  }

  // ... (continued in Part 2)
```

Let me continue with the service file and remaining components...

Would you like me to:
1. Complete the service implementation (Part 2)?
2. Continue with the controller, routes, and remaining files?
3. Add more detailed examples or specific sections?

Let me know and I'll continue with the implementation guide!