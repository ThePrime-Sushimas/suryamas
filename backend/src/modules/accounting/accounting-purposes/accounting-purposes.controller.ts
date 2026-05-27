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
import { getAccessibleCompanyIds, getWriteScope } from '../../../utils/branch-access.util'
import type {
  createAccountingPurposeSchema,
  updateAccountingPurposeSchema,
  bulkUpdateStatusSchema,
  bulkDeleteSchema,
} from './accounting-purposes.schema'

export class AccountingPurposesController {
  async list(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const { offset } = getPaginationParams(req.query)

      if (req.pagination!.limit > defaultConfig.limits.pageSize) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('limit', `Page size cannot exceed ${defaultConfig.limits.pageSize}`)
      }

      const filter = { ...req.filterParams, ...(req.query.q && { q: req.query.q as string }) }

      const result = await accountingPurposesService.list(
        companyIds,
        { ...req.pagination!, offset },
        req.sort,
        filter
      )

      sendSuccess(res, result.data, 'Accounting purposes retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_purposes' })
    }
  }

  async search(req: Request, res: Response) {
    try {
      const { q } = req.query
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const { offset } = getPaginationParams(req.query)

      if (q && typeof q === 'string' && q.length > 100) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('searchTerm', 'Search term too long')
      }

      const result = await accountingPurposesService.search(
        companyIds,
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
      const { companyId } = await getWriteScope(req)

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
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const purpose = await accountingPurposesService.getById(req.params.id as string, companyIds)
      sendSuccess(res, purpose)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purpose' })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { body, params } = (req as ValidatedAuthRequest<typeof updateAccountingPurposeSchema>).validated
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')

      const purpose = await accountingPurposesService.update(params.id, body, req.user!.id, companyIds)

      logInfo('Accounting purpose updated', { purpose_id: params.id, user: req.user!.id })
      sendSuccess(res, purpose, 'Accounting purpose updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_purpose' })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      if (!req.user?.id) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('user', 'User authentication required')
      }

      await accountingPurposesService.delete(req.params.id as string, req.user.id, companyIds)

      logInfo('Accounting purpose deleted', { purpose_id: req.params.id, user: req.user.id })
      sendSuccess(res, null, 'Accounting purpose deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_purpose' })
    }
  }

  async getFilterOptions(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const options = await accountingPurposesService.getFilterOptions(companyIds)
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
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      return handleExport(
        req, res,
        (filter) => accountingPurposesService.exportToExcel(companyIds, filter),
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
      const { companyId } = await getWriteScope(req)
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
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')

      if (body.ids.length > defaultConfig.limits.bulkUpdate) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('limit', `Cannot update more than ${defaultConfig.limits.bulkUpdate} records at once`)
      }

      await accountingPurposesService.bulkUpdateStatus(body.ids, body.is_active, req.user!.id, companyIds)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_update_status' })
    }
  }

  async bulkDelete(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkDeleteSchema>).validated
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')

      if (body.ids.length > defaultConfig.limits.bulkDelete) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('limit', `Cannot delete more than ${defaultConfig.limits.bulkDelete} records at once`)
      }

      await accountingPurposesService.bulkDelete(body.ids, req.user!.id, companyIds)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete' })
    }
  }

  async restore(req: Request, res: Response) {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      if (!req.user?.id) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('user', 'User authentication required')
      }

      await accountingPurposesService.restore(req.params.id as string, req.user.id, companyIds)
      sendSuccess(res, null, 'Accounting purpose restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_purpose' })
    }
  }

  async bulkRestore(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkDeleteSchema>).validated
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')

      await accountingPurposesService.bulkRestore(body.ids, req.user!.id, companyIds)
      sendSuccess(res, null, 'Bulk restore completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_restore' })
    }
  }
}

export const accountingPurposesController = new AccountingPurposesController()
