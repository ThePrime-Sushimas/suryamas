/**
 * Bank Statement Import Controller
 * Handles HTTP requests untuk bank statement import operations
 */

import { Request, Response } from 'express'
import { BankStatementImportService } from './bank-statement-import.service'
import { BankStatementImportRepository } from './bank-statement-import.repository'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import crypto from 'crypto'
import { createReadStream } from 'fs'
import { validateUploadedFile } from './bank-statement-import.schema'
import { BankStatementImportErrors } from './bank-statement-import.errors'
import type {
  uploadBankStatementSchema,
  confirmBankStatementImportSchema,
  getImportByIdSchema,
  deleteImportSchema,
  listManualEntriesSchema,
  manualEntrySchema,
  manualBulkEntrySchema,
  hardDeleteStatementSchema,
  hardDeleteBulkStatementsSchema,
} from './bank-statement-import.schema'


export class BankStatementImportController {
  constructor(private readonly service: BankStatementImportService) {}

  /**
   * Upload and analyze bank statement file
   * POST /api/v1/bank-statement-imports/upload
   */
  upload = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        throw BankStatementImportErrors.NO_FILE_UPLOADED()
      }

      validateUploadedFile(req.file)

      const { body } = (req as ValidatedAuthRequest<typeof uploadBankStatementSchema>).validated
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)

      // Calculate file hash using streaming for better performance
      const fileHash = await this.calculateFileHash(req.file.path)

      const fileResult = {
        file_name: req.file.originalname,
        file_size: req.file.size,
        file_path: req.file.path,
        file_hash: fileHash,
        mime_type: req.file.mimetype,
      }

      const result = await this.service.analyzeFile(
        fileResult,
        body.bank_account_id,
        companyId,
        userId
      )

      sendSuccess(res, {
        import: result.import,
        analysis: result.analysis,
      }, 'File analyzed successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upload_statement' })
    }
  }

  /**
   * Calculate file hash using streaming for memory efficiency
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = createReadStream(filePath, {
        highWaterMark: 1024 * 1024, // 1MB chunks for efficiency
      })

      stream.on('data', (chunk: Buffer | string) => {
        if (Buffer.isBuffer(chunk)) {
          hash.update(chunk)
        } else {
          hash.update(Buffer.from(chunk))
        }
      })
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  /**
   * Confirm import and start async processing
   * POST /api/v1/bank-statement-imports/:id/confirm
   */
  confirm = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body: validatedBody } = (req as ValidatedAuthRequest<typeof confirmBankStatementImportSchema>).validated
      const importId = parseInt(params.id, 10)
      const { skip_duplicates = false, dry_run = false } = validatedBody
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)

      if (dry_run) {
        const dryRunResult = await this.service.dryRunImport(importId, companyId)
        sendSuccess(res, dryRunResult, 'Dry run completed', 200)
        return
      }

      const result = await this.service.confirmImport(
        importId,
        companyId,
        skip_duplicates,
        userId
      )

      sendSuccess(res, {
        import: result.import,
        job_id: result.job_id,
      }, 'Import started successfully. Check job status for progress.', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_import' })
    }
  }

  /**
   * List all imports with pagination and filters
   * GET /api/v1/bank-statement-imports
   */
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const companyId = String(req.context?.company_id)
      
      const query = (req.validated as { query: Record<string, unknown> })?.query || {} as Record<string, unknown>
      
      // Parse pagination with defaults and limits
      const page = Math.max(1, Number(query.page) || 1)
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))
      const sortField = req.sort?.field || 'created_at'
      const sortOrder = req.sort?.order || 'desc'

      const result = await this.service.listImports(
        companyId,
        { page, limit },
        { field: sortField, order: sortOrder },
        {
          bank_account_id: query.bank_account_id ? Number(query.bank_account_id) : undefined,
          status: query.status as import('./bank-statement-import.types').BankStatementImportStatus | undefined,
          date_from: query.date_from as string | undefined,
          date_to: query.date_to as string | undefined,
          search: query.search as string | undefined,
        }
      )

      sendSuccess(res, result, 'Imports retrieved successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_imports' })
    }
  }

  /**
   * Get import by ID with details
   * GET /api/v1/bank-statement-imports/:id
   */
  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof getImportByIdSchema>).validated
      const importId = parseInt(params.id, 10)
      const companyId = String(req.context?.company_id)

      const importRecord = await this.service.getImportById(importId, companyId)

      if (!importRecord) {
        return handleError(res, new Error(`Import with ID ${importId} not found`))
      }

      sendSuccess(res, importRecord, 'Import retrieved successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_import' })
    }
  }

  /**
   * Get statements for a specific import
   * GET /api/v1/bank-statement-imports/:id/statements
   */
  getStatements = async (req: Request, res: Response): Promise<void> => {
    try {
      const idParam = req.params.id
      const importId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10)
      const companyId = String(req.context?.company_id)
      
      const query = (req.validated as { query: Record<string, unknown> })?.query || {} as Record<string, unknown>
      
      // Parse pagination with defaults and limits
      const page = Math.max(1, Number(query.page) || 1)
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))

      const result = await this.service.getImportStatements(
        importId,
        companyId,
        { page, limit }
      )

      sendSuccess(res, result, 'Statements retrieved successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_statements' })
    }
  }

  /**
   * Get import summary/analytics
   * GET /api/v1/bank-statement-imports/:id/summary
   */
  getSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const idParam = req.params.id
      const importId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10)
      const companyId = String(req.context?.company_id)

      if (isNaN(importId)) {
        return handleError(res, new Error('Invalid import ID'))
      }

      const summary = await this.service.getImportSummary(importId, companyId)

      sendSuccess(res, summary, 'Summary retrieved successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_summary' })
    }
  }

  /**
   * Cancel an ongoing import
   * POST /api/v1/bank-statement-imports/:id/cancel
   */
  cancel = async (req: Request, res: Response): Promise<void> => {
    try {
      const idParam = req.params.id
      const importId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10)
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)

      if (isNaN(importId)) {
        return handleError(res, new Error('Invalid import ID'))
      }

      await this.service.cancelImport(importId, companyId, userId)

      sendSuccess(res, null, 'Import cancelled successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_import' })
    }
  }

  /**
   * Delete import (soft delete)
   * DELETE /api/v1/bank-statement-imports/:id
   */
  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof deleteImportSchema>).validated
      const importId = parseInt(params.id, 10)
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id) || ''

      await this.service.deleteImport(importId, companyId, userId)

      sendSuccess(res, null, 'Import deleted successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_import' })
    }
  }

  /**
   * Retry a failed import
   * POST /api/v1/bank-statement-imports/:id/retry
   */
  retry = async (req: Request, res: Response): Promise<void> => {
    try {
      const idParam = req.params.id
      const importId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10)
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)

      if (isNaN(importId)) {
        return handleError(res, new Error('Invalid import ID'))
      }

      const result = await this.service.retryImport(importId, companyId, userId)

      sendSuccess(res, {
        import: result.import,
        job_id: result.job_id,
      }, 'Import retry started successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'retry_import' })
    }
  }

  // ==================== MANUAL ENTRY ENDPOINTS ====================

  /**
   * List manual entries grouped by month
   * GET /api/v1/bank-statement-imports/manual?bank_account_id=5
   */
  listManualEntries = async (req: Request, res: Response): Promise<void> => {
    try {
      const { query } = (req as ValidatedAuthRequest<typeof listManualEntriesSchema>).validated
      const companyId = String(req.context?.company_id)

      const result = await this.service.listManualEntries(query.bank_account_id, companyId)

      sendSuccess(res, result, 'Manual entries retrieved', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_manual_entries' })
    }
  }

  /**
   * Create single manual bank statement entry
   * POST /api/v1/bank-statement-imports/manual
   */
  manualEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof manualEntrySchema>).validated
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)

      const result = await this.service.createManualEntry(
        body.bank_account_id,
        { transaction_date: body.transaction_date, description: body.description, debit_amount: body.debit_amount, credit_amount: body.credit_amount, reference_number: body.reference_number, balance: body.balance },
        companyId,
        userId,
      )

      sendSuccess(res, result, 'Manual entry berhasil disimpan', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'manual_entry' })
    }
  }

  /**
   * Create bulk manual bank statement entries
   * POST /api/v1/bank-statement-imports/manual/bulk
   */
  manualBulkEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof manualBulkEntrySchema>).validated
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)

      const result = await this.service.createManualBulkEntries(
        body.bank_account_id,
        body.entries,
        companyId,
        userId,
      )

      sendSuccess(res, result, `${result.inserted} manual entries berhasil disimpan`, 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'manual_bulk_entry' })
    }
  }

  // ==================== HARD DELETE ENDPOINTS ====================

  /**
   * Hard delete single bank statement
   * DELETE /api/v1/bank-statement-imports/statements/:id/hard
   */
  hardDeleteStatement = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof hardDeleteStatementSchema>).validated
      const statementId = parseInt(params.id, 10)
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)

      await this.service.hardDeleteStatement(statementId, companyId, userId)

      sendSuccess(res, null, 'Statement berhasil dihapus permanen', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'hard_delete_statement' })
    }
  }

  /**
   * Hard delete multiple bank statements
   * POST /api/v1/bank-statement-imports/statements/hard-delete
   */
  hardDeleteBulkStatements = async (req: Request, res: Response): Promise<void> => {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof hardDeleteBulkStatementsSchema>).validated
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)

      const result = await this.service.hardDeleteStatements(body.ids, companyId, userId)

      sendSuccess(res, result, `${result.deleted} statement berhasil dihapus permanen`, 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'hard_delete_bulk_statements' })
    }
  }

  // ==================== PREVIEW / EXISTING ENDPOINTS ====================

  /**
   * Preview import data (first N rows, or all rows if limit is 0)
   * GET /api/v1/bank-statement-imports/:id/preview
   * 
   * Query params:
   * - limit: Number of rows to return. Default 10. Maximum 10000 rows.
   */
  preview = async (req: Request, res: Response): Promise<void> => {
    try {
      const idParam = req.params.id
      const importId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10)
      const companyId = String(req.context?.company_id)
      const limitParam = req.query.limit 
        ? parseInt(String(req.query.limit), 10) 
        : 10

      if (isNaN(importId)) {
        return handleError(res, new Error('Invalid import ID'))
      }

      // Parse limit with boundaries (default 10, max 10000 to prevent memory issues)
      const limit = isNaN(limitParam) 
        ? 10 
        : Math.min(10000, Math.max(1, limitParam))

      const preview = await this.service.getImportPreview(
        importId,
        companyId,
        limit
      )

      sendSuccess(res, preview, 'Preview retrieved successfully', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'preview_import' })
    }
  }
}

export const bankStatementImportController = new BankStatementImportController(
  new BankStatementImportService(new BankStatementImportRepository())
)
