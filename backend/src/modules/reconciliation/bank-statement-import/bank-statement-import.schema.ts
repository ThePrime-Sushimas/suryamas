/**
 * Bank Statement Import Validation Schemas
 * Zod schemas untuk validasi input
 */

import { z } from 'zod'
import { IMPORT_STATUS, TRANSACTION_TYPE } from './bank-statement-import.constants'
import { BankStatementImportErrors } from './bank-statement-import.errors'

// ============================================================================
// ENUMS (derived from constants)
// ============================================================================

export const BankStatementImportStatus = IMPORT_STATUS
export const BankTransactionType = TRANSACTION_TYPE

// ============================================================================
// UPLOAD SCHEMAS
// ============================================================================

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
})

/**
 * File validation helper
 */
export const validateUploadedFile = (file: Express.Multer.File | undefined): void => {
  if (!file) {
    throw BankStatementImportErrors.NO_FILE_UPLOADED()
  }

  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw BankStatementImportErrors.INVALID_FILE_TYPE()
  }

  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    throw BankStatementImportErrors.FILE_TOO_LARGE(50)
  }

  const allowedExtensions = ['.xlsx', '.xls']
  const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'))
  
  if (!allowedExtensions.includes(fileExtension)) {
    throw BankStatementImportErrors.INVALID_FILE_TYPE()
  }
}

// ============================================================================
// CONFIRM IMPORT SCHEMAS
// ============================================================================

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
})

// ============================================================================
// IMPORT ID SCHEMAS
// ============================================================================

/**
 * Get Import By ID Schema
 */
export const getImportByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Import ID must be a valid number'),
  }),
})

/**
 * Delete Import Schema
 */
export const deleteImportSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Import ID must be a valid number'),
  }),
})

// ============================================================================
// LIST QUERY SCHEMAS
// ============================================================================

/**
 * List Imports Query Schema
 */
export const listImportsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    bank_account_id: z.coerce.number().int().positive().optional(),
    status: z.nativeEnum(IMPORT_STATUS).optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    search: z.string().optional(),
  }),
})

/**
 * List Bank Statements Query Schema
 */
export const listBankStatementsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    bank_account_id: z.coerce.number().int().positive().optional(),
    transaction_date_from: z.string().optional(),
    transaction_date_to: z.string().optional(),
    is_reconciled: z.coerce.boolean().optional(),
    transaction_type: z.nativeEnum(TRANSACTION_TYPE).optional(),
    search: z.string().optional(),
    import_id: z.coerce.number().int().positive().optional(),
  }),
})

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
})

// ============================================================================
// BANK STATEMENT ROW SCHEMAS
// ============================================================================

/**
 * Bank Statement Row Schema (for validation)
 */
export const bankStatementRowSchema = z.object({
  transaction_date: z.string(),
  transaction_time: z.string().optional(),
  reference_number: z.string().max(100).optional(),
  description: z.string().min(1, 'Description is required').max(1000),
  debit_amount: z.number().min(0).default(0),
  credit_amount: z.number().min(0).default(0),
  balance: z.number().optional(),
  transaction_type: z.nativeEnum(TRANSACTION_TYPE).optional(),
}).refine(
  (data) => data.debit_amount > 0 || data.credit_amount > 0,
  {
    message: 'Either debit or credit amount must be greater than 0',
    path: ['debit_amount', 'credit_amount'],
  }
)

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UploadBankStatementInput = z.infer<typeof uploadBankStatementSchema>
export type ConfirmImportInput = z.infer<typeof confirmBankStatementImportSchema>
export type ListImportsQueryInput = z.infer<typeof listImportsQuerySchema>
export type ListBankStatementsQueryInput = z.infer<typeof listBankStatementsQuerySchema>
export type GetImportStatementsInput = z.infer<typeof getImportStatementsSchema>