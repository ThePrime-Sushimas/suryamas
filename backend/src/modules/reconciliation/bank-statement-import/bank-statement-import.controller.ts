/**
 * Bank Statement Import Controller
 * Handles HTTP requests untuk bank statement import operations
 */

import { Response } from 'express'
import { AuthRequest } from '../../../types/common.types'
import { BankStatementImportService } from './bank-statement-import.service'
import { BankStatementImportRepository } from './bank-statement-import.repository'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { withValidated } from '../../../utils/handler'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
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

type UploadBankStatementReq = ValidatedAuthRequest<typeof uploadBankStatementSchema>
type ConfirmImportReq = ValidatedAuthRequest<typeof confirmBankStatementImportSchema>
type GetImportByIdReq = ValidatedAuthRequest<typeof getImportByIdSchema>
type DeleteImportReq = ValidatedAuthRequest<typeof deleteImportSchema>
type ListImportsReq = ValidatedAuthRequest<typeof listImportsQuerySchema>
type GetImportStatementsReq = ValidatedAuthRequest<typeof getImportStatementsSchema>

// Helper functions to ensure proper types
const getCompanyId = (req: AuthRequest): string => {
  const companyId = req.context?.company_id
  if (!companyId) throw new Error('Company context required')
  return String(companyId)
}

const getUserId = (req: AuthRequest): string | undefined => {
  const userId = req.user?.id
  return userId ? String(userId) : undefined
}

export class BankStatementImportController {
  constructor(private readonly service: BankStatementImportService) {}

  /**
   * Upload and analyze bank statement file
   * POST /api/v1/bank-statement-imports/upload
   */
  upload = withValidated(async (req: UploadBankStatementReq, res: Response) => {
    try {
      validateUploadedFile(req.file)

      const { bank_account_id } = req.validated.body
      const companyId = getCompanyId(req)
      const userId = getUserId(req)

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

      // @ts-ignore - helper function ensures string type
      const result = await this.service.analyzeFile(
        fileResult,
        bank_account_id,
        companyId!,
        userId!
      )

      sendSuccess(res, {
        import: result.import,
        analysis: result.analysis,
      }, 'File analyzed successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Confirm import and start async processing
   * POST /api/v1/bank-statement-imports/:id/confirm
   */
  confirm = withValidated(async (req: ConfirmImportReq, res: Response) => {
    try {
      const importId = parseInt(req.validated.params.id, 10)
      const { skip_duplicates = false, dry_run = false } = req.validated.body
      const companyId = getCompanyId(req)
      const userId = getUserId(req)

      if (dry_run) {
        // @ts-ignore - helper function ensures string type
        const dryRunResult = await this.service.dryRunImport(importId, companyId as string)
        sendSuccess(res, dryRunResult, 'Dry run completed', 200)
        return
      }

      // @ts-ignore - helper function ensures string type
      const result = await this.service.confirmImport(
        importId,
        companyId!,
        skip_duplicates,
        userId!
      )

      sendSuccess(res, {
        import: result.import,
        job_id: result.job_id,
      }, 'Import started successfully. Check job status for progress.', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * List all imports with pagination and filters
   * GET /api/v1/bank-statement-imports
   */
  list = withValidated(async (req: ListImportsReq, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const { page, limit, bank_account_id, status, date_from, date_to, search } = req.validated.query

      // @ts-ignore - helper function ensures string type
      const result = await this.service.listImports(
        companyId as string,
        { page, limit: Math.min(limit, 100) },
        { field: 'created_at', order: 'desc' as const },
        {
          bank_account_id,
          status,
          date_from,
          date_to,
          search,
        }
      )

      sendSuccess(res, result, 'Imports retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Get import by ID with details
   * GET /api/v1/bank-statement-imports/:id
   */
  getById = withValidated(async (req: GetImportByIdReq, res: Response) => {
    try {
      const importId = parseInt(req.validated.params.id, 10)
      const companyId = getCompanyId(req)

      // @ts-ignore - helper function ensures string type
      const importRecord = await this.service.getImportById(importId, companyId as string)

      if (!importRecord) {
        return handleError(res, new Error(`Import with ID ${importId} not found`))
      }

      sendSuccess(res, importRecord, 'Import retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Get statements for a specific import
   * GET /api/v1/bank-statement-imports/:id/statements
   */
  getStatements = withValidated(async (req: GetImportStatementsReq, res: Response) => {
    try {
      const importId = parseInt(req.validated.params.id, 10)
      const companyId = getCompanyId(req)
      const { page, limit } = req.validated.query

      // @ts-ignore - helper function ensures string type
      const result = await this.service.getImportStatements(
        importId,
        companyId as string,
        { page, limit: Math.min(limit, 100) }
      )

      sendSuccess(res, result, 'Statements retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Get import summary/analytics
   * GET /api/v1/bank-statement-imports/:id/summary
   */
  getSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const importId = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10
      )
      const companyId = getCompanyId(req)

      if (isNaN(importId)) {
        return handleError(res, new Error('Invalid import ID'))
      }

      // @ts-ignore - helper function ensures string type
      const summary = await this.service.getImportSummary(importId, companyId as string)

      sendSuccess(res, summary, 'Summary retrieved successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Cancel an ongoing import
   * POST /api/v1/bank-statement-imports/:id/cancel
   */
  cancel = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const importId = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10
      )
      const companyId = getCompanyId(req)
      const userId = getUserId(req)

      if (isNaN(importId)) {
        return handleError(res, new Error('Invalid import ID'))
      }

      // @ts-ignore - helper function ensures string type
      await this.service.cancelImport(importId, companyId!, userId!)

      sendSuccess(res, null, 'Import cancelled successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Delete import (soft delete)
   * DELETE /api/v1/bank-statement-imports/:id
   */
  delete = withValidated(async (req: DeleteImportReq, res: Response) => {
    try {
      const importId = parseInt(req.validated.params.id, 10)
      const companyId = getCompanyId(req)
      const userId = getUserId(req) || ''

      // @ts-ignore - helper function ensures string type
      await this.service.deleteImport(importId, companyId as string, (userId || '') as string)

      sendSuccess(res, null, 'Import deleted successfully', 200)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Retry a failed import
   * POST /api/v1/bank-statement-imports/:id/retry
   */
  retry = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const importId = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10
      )
      const companyId = getCompanyId(req)
      const userId = getUserId(req)

      if (isNaN(importId)) {
        return handleError(res, new Error('Invalid import ID'))
      }

      // @ts-ignore - helper function ensures string type
      const result = await this.service.retryImport(importId, companyId!, userId!)

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
  preview = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const importId = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10
      )
      const companyId = getCompanyId(req)
      const limitParam = req.query.limit 
        ? parseInt(String(req.query.limit), 10) 
        : 10

      if (isNaN(importId)) {
        return handleError(res, new Error('Invalid import ID'))
      }

      // Allow limit = 0 to get all rows
      // If limit is 0, getImportPreview will return all rows
      const limit = isNaN(limitParam) ? 10 : limitParam

      // @ts-ignore - helper function ensures string type
      const preview = await this.service.getImportPreview(
        importId,
        companyId as string,
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
