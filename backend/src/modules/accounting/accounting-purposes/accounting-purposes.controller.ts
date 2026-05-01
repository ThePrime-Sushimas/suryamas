import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { accountingPurposesService } from './accounting-purposes.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { logInfo } from '../../../config/logger'
import { getPaginationParams } from '../../../utils/pagination.util'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../../utils/export.util'
import { AccountingPurposeErrors } from './accounting-purposes.errors'
import { defaultConfig } from './accounting-purposes.config'
import type {
  createAccountingPurposeSchema,
  updateAccountingPurposeSchema,
  bulkUpdateStatusSchema,
  bulkDeleteSchema,
} from './accounting-purposes.schema'

export class AccountingPurposesController {
  private getCompanyId(req: Request): string {
    const companyId = req.context?.company_id
    if (!companyId) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('company_id', 'Branch context required - no company access')
    }
    return companyId
  }

  async list(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const { offset } = getPaginationParams(req.query)

      if (req.pagination!.limit > defaultConfig.limits.pageSize) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('limit', `Page size cannot exceed ${defaultConfig.limits.pageSize}`)
      }

      const result = await accountingPurposesService.list(
        companyId,
        { ...req.pagination!, offset },
        req.sort,
        req.filterParams
      )

      sendSuccess(res, result.data, 'Accounting purposes retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_purposes' })
    }
  }

  async search(req: Request, res: Response) {
    try {
      const { q } = req.query
      const companyId = this.getCompanyId(req)
      const { offset } = getPaginationParams(req.query)

      if (q && typeof q === 'string' && q.length > 100) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('searchTerm', 'Search term too long')
      }

      const result = await accountingPurposesService.search(
        companyId,
        q as string,
        { ...req.pagination!, offset },
        req.sort,
        req.filterParams
      )

      sendSuccess(res, result.data, 'Accounting purposes retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_purposes' })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof createAccountingPurposeSchema>).validated
      const companyId = this.getCompanyId(req)

      const createData = {
        ...body,
        company_id: companyId,
        branch_id: body.branch_id || null,
      }

      const purpose = await accountingPurposesService.create(createData, req.user!.id)

      logInfo('Accounting purpose created', {
        purpose_id: purpose.id,
        purpose_code: purpose.purpose_code,
        user: req.user!.id,
      })
      sendSuccess(res, purpose, 'Accounting purpose created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_purpose' })
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const purpose = await accountingPurposesService.getById(req.params.id as string, companyId)
      sendSuccess(res, purpose)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purpose' })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { body, params } = (req as ValidatedAuthRequest<typeof updateAccountingPurposeSchema>).validated
      const companyId = this.getCompanyId(req)

      const purpose = await accountingPurposesService.update(params.id, body, req.user!.id, companyId)

      logInfo('Accounting purpose updated', { purpose_id: params.id, user: req.user!.id })
      sendSuccess(res, purpose, 'Accounting purpose updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_purpose' })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      if (!req.user?.id) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('user', 'User authentication required')
      }

      await accountingPurposesService.delete(req.params.id as string, req.user.id, companyId)

      logInfo('Accounting purpose deleted', { purpose_id: req.params.id, user: req.user.id })
      sendSuccess(res, null, 'Accounting purpose deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_purpose' })
    }
  }

  async getFilterOptions(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const options = await accountingPurposesService.getFilterOptions(companyId)
      sendSuccess(res, options)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_filter_options' })
    }
  }

  async generateExportToken(req: Request, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      return handleExport(
        req, res,
        (filter) => accountingPurposesService.exportToExcel(companyId, filter),
        'accounting-purposes'
      )
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'export_data' })
    }
  }

  async previewImport(req: Request, res: Response) {
    try {
      const maxSize = 10 * 1024 * 1024
      if (req.body && Buffer.byteLength(JSON.stringify(req.body)) > maxSize) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('fileSize', 'File too large')
      }
      return handleImportPreview(req, res, (buffer) => accountingPurposesService.previewImport(buffer))
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'preview_import' })
    }
  }

  async importData(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      return handleImport(
        req, res,
        (buffer, skip) => accountingPurposesService.importFromExcel(buffer, skip, companyId, req.user!.id)
      )
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'import_data' })
    }
  }

  async bulkUpdateStatus(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkUpdateStatusSchema>).validated
      const companyId = this.getCompanyId(req)

      if (body.ids.length > defaultConfig.limits.bulkUpdate) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('limit', `Cannot update more than ${defaultConfig.limits.bulkUpdate} records at once`)
      }

      await accountingPurposesService.bulkUpdateStatus(body.ids, body.is_active, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_update_status' })
    }
  }

  async bulkDelete(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkDeleteSchema>).validated
      const companyId = this.getCompanyId(req)

      if (body.ids.length > defaultConfig.limits.bulkDelete) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('limit', `Cannot delete more than ${defaultConfig.limits.bulkDelete} records at once`)
      }

      await accountingPurposesService.bulkDelete(body.ids, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete' })
    }
  }

  async restore(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      if (!req.user?.id) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('user', 'User authentication required')
      }

      await accountingPurposesService.restore(req.params.id as string, req.user.id, companyId)
      sendSuccess(res, null, 'Accounting purpose restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_purpose' })
    }
  }

  async bulkRestore(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkDeleteSchema>).validated
      const companyId = this.getCompanyId(req)

      await accountingPurposesService.bulkRestore(body.ids, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk restore completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_restore' })
    }
  }
}

export const accountingPurposesController = new AccountingPurposesController()
