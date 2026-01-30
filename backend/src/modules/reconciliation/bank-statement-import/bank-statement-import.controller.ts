/**
 * Bank Statement Import Controller
 * Handles HTTP requests untuk bank statement import operations
 */

import { Response } from 'express'
import { BankStatementImportService } from './bank-statement-import.service'
import { BankStatementImportRepository } from './bank-statement-import.repository'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { withValidated } from '../../../utils/handler'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../types/request.types'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import crypto from 'crypto'
import fs from 'fs/promises'
import { validateUploadedFile } from './bank-statement-import.schema'
import { BankStatementImportStatus } from './bank-statement-import.types'
import {
  uploadBankStatementSchema,
  confirmBankStatementImportSchema,
  getImportByIdSchema,
  deleteImportSchema,
  listImportsQuerySchema,
  getImportStatementsSchema,
} from './bank-statement-import.schema'

export type UploadBankStatementReq = ValidatedAuthRequest<typeof uploadBankStatementSchema>
export type ConfirmImportReq = ValidatedAuthRequest<typeof confirmBankStatementImportSchema>
export type GetImportByIdReq = ValidatedAuthRequest<typeof getImportByIdSchema>
export type DeleteImportReq = ValidatedAuthRequest<typeof deleteImportSchema>
export type ListImportsReq = AuthenticatedQueryRequest
export type GetStatementsReq = AuthenticatedQueryRequest
export type GetSummaryReq = AuthenticatedQueryRequest
export type CancelReq = AuthenticatedQueryRequest
export type RetryReq = AuthenticatedQueryRequest
export type PreviewReq = AuthenticatedQueryRequest

export class BankStatementImportController {
  constructor(private readonly service: BankStatementImportService) {}

  /**
   * Upload and analyze bank statement file
   * POST /api/v1/bank-statement-imports/upload
   */
  upload = async (req: UploadBankStatementReq, res: Response): Promise<void> => {
    try {
      validateUploadedFile(req.file)

      const { bank_account_id } = req.validated.body
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id)

      const fileBuffer = await fs.readFile(req.file!.path)
      const fileHash = crypto
        .createHash('sha256')
        .update(fileBuffer)
        .digest('hex')

      const fileResult = {
        file_name: req.file!.originalname,
        file_size: req.file!.size,
        file_path: req.file!.path,
        file_hash: fileHash,
        mime_type: req.file!.mimetype,
      }

      const result = await this.service.analyzeFile(
        fileResult,
        bank_account_id,
        companyId,
        userId
      )

      sendSuccess(res, {
        import: result.import,
        analysis: result.analysis,
      }, 'File analyzed successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Confirm import and start async processing
   * POST /api/v1/bank-statement-imports/:id/confirm
   */
  confirm = async (req: ConfirmImportReq, res: Response): Promise<void> => {
    try {
      const importId = parseInt(req.validated.params.id, 10)
      const { skip_duplicates = false, dry_run = false } = req.validated.body
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
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * List all imports with pagination and filters
   * GET /api/v1/bank-statement-imports
   */
  list = async (req: ListImportsReq, res: Response): Promise<void> => {
    try {
      const companyId = String(req.context?.company_id)
      const validated = (req as any).validated?.query || req.query

      const result = await this.service.listImports(
        companyId,
        { page: Number(validated.page) || 1, limit: Math.min(Number(validated.limit) || 10, 100) },
        req.sort || { field: 'created_at', order: 'desc' },
        {
          bank_account_id: validated.bank_account_id,
          status: validated.status,
          date_from: validated.date_from,
          date_to: validated.date_to,
          search: validated.search,
        }
      )

      sendSuccess(res, result, 'Imports retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Get import by ID with details
   * GET /api/v1/bank-statement-imports/:id
   */
  getById = async (req: GetImportByIdReq, res: Response): Promise<void> => {
    try {
      const importId = parseInt(req.validated.params.id, 10)
      const companyId = String(req.context?.company_id)

      const importRecord = await this.service.getImportById(importId, companyId)

      if (!importRecord) {
        return handleError(res, new Error(`Import with ID ${importId} not found`))
      }

      sendSuccess(res, importRecord, 'Import retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Get statements for a specific import
   * GET /api/v1/bank-statement-imports/:id/statements
   */
  getStatements = async (req: GetStatementsReq, res: Response): Promise<void> => {
    try {
      const idParam = req.params.id
      const importId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10)
      const companyId = String(req.context?.company_id)
      const validated = (req as any).validated?.query || req.query

      const result = await this.service.getImportStatements(
        importId,
        companyId,
        { page: Number(validated.page) || 1, limit: Math.min(Number(validated.limit) || 10, 100) }
      )

      sendSuccess(res, result, 'Statements retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Get import summary/analytics
   * GET /api/v1/bank-statement-imports/:id/summary
   */
  getSummary = async (req: GetSummaryReq, res: Response): Promise<void> => {
    try {
      const idParam = req.params.id
      const importId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10)
      const companyId = String(req.context?.company_id)

      if (isNaN(importId)) {
        return handleError(res, new Error('Invalid import ID'))
      }

      const summary = await this.service.getImportSummary(importId, companyId)

      sendSuccess(res, summary, 'Summary retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Cancel an ongoing import
   * POST /api/v1/bank-statement-imports/:id/cancel
   */
  cancel = async (req: CancelReq, res: Response): Promise<void> => {
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
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Delete import (soft delete)
   * DELETE /api/v1/bank-statement-imports/:id
   */
  delete = async (req: DeleteImportReq, res: Response): Promise<void> => {
    try {
      const importId = parseInt(req.validated.params.id, 10)
      const companyId = String(req.context?.company_id)
      const userId = String(req.user?.id) || ''

      await this.service.deleteImport(importId, companyId, userId)

      sendSuccess(res, null, 'Import deleted successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Retry a failed import
   * POST /api/v1/bank-statement-imports/:id/retry
   */
  retry = async (req: RetryReq, res: Response): Promise<void> => {
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
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Preview import data (first N rows, or all rows if limit is 0)
   * GET /api/v1/bank-statement-imports/:id/preview
   * 
   * Query params:
   * - limit: Number of rows to return. Default 10. Use 0 to get all rows.
   */
  preview = async (req: PreviewReq, res: Response): Promise<void> => {
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

      // Allow limit = 0 to get all rows
      // If limit is 0, getImportPreview will return all rows
      const limit = isNaN(limitParam) ? 10 : limitParam

      const preview = await this.service.getImportPreview(
        importId,
        companyId,
        limit
      )

      sendSuccess(res, preview, 'Preview retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  }
}

export const bankStatementImportController = new BankStatementImportController(
  new BankStatementImportService(new BankStatementImportRepository())
)
