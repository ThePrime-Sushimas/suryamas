import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { accountingPurposeAccountsService } from './accounting-purpose-accounts.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { logInfo } from '../../../config/logger'
import { getPaginationParams } from '../../../utils/pagination.util'
import { handleExportToken, handleExport } from '../../../utils/export.util'
import type {
  createAccountingPurposeAccountSchema,
  updateAccountingPurposeAccountSchema,
  bulkCreateAccountingPurposeAccountSchema,
  bulkRemoveAccountingPurposeAccountSchema,
  bulkUpdateStatusSchema,
} from './accounting-purpose-accounts.schema'

export class AccountingPurposeAccountsController {
  private getCompanyId(req: Request): string {
    const companyId = req.context?.company_id
    if (!companyId) throw new Error('Branch context required - no company access')
    return companyId
  }

  async list(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const { offset } = getPaginationParams(req.query)

      if (req.pagination!.limit > 1000) {
        throw new Error('Page size cannot exceed 1000')
      }

      const result = await accountingPurposeAccountsService.list(
        companyId, { ...req.pagination!, offset }, req.sort, req.filterParams
      )
      sendSuccess(res, result.data, 'Purpose account mappings retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_purpose_accounts' })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof createAccountingPurposeAccountSchema>).validated
      const companyId = this.getCompanyId(req)

      const purposeAccount = await accountingPurposeAccountsService.create(body, companyId, req.user!.id)
      sendSuccess(res, purposeAccount, 'Purpose account mapping created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_purpose_account' })
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const purposeAccount = await accountingPurposeAccountsService.getById(req.params.id as string, companyId)
      sendSuccess(res, purposeAccount)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_purpose_account' })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { body, params } = (req as ValidatedAuthRequest<typeof updateAccountingPurposeAccountSchema>).validated
      const companyId = this.getCompanyId(req)

      const purposeAccount = await accountingPurposeAccountsService.update(params.id, body, req.user!.id, companyId)

      logInfo('Purpose account mapping updated', { id: params.id, user: req.user!.id })
      sendSuccess(res, purposeAccount, 'Purpose account mapping updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_purpose_account' })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      await accountingPurposeAccountsService.delete(req.params.id as string, req.user!.id, companyId)

      logInfo('Purpose account mapping deleted', { id: req.params.id, user: req.user!.id })
      sendSuccess(res, null, 'Purpose account mapping deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_purpose_account' })
    }
  }

  async bulkCreate(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkCreateAccountingPurposeAccountSchema>).validated
      const companyId = this.getCompanyId(req)

      const purposeAccounts = await accountingPurposeAccountsService.bulkCreate(body, companyId, req.user!.id)
      sendSuccess(res, purposeAccounts, 'Bulk create completed', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_create_purpose_accounts' })
    }
  }

  async bulkRemove(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkRemoveAccountingPurposeAccountSchema>).validated
      const companyId = this.getCompanyId(req)

      await accountingPurposeAccountsService.bulkRemove(body, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk remove completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_remove_purpose_accounts' })
    }
  }

  async bulkUpdateStatus(req: Request, res: Response) {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof bulkUpdateStatusSchema>).validated
      const companyId = this.getCompanyId(req)

      if (body.ids.length > 100) {
        throw new Error('Cannot update more than 100 records at once')
      }

      await accountingPurposeAccountsService.bulkUpdateStatus(body.ids, body.is_active, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_update_status_purpose_accounts' })
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
        (filter) => accountingPurposeAccountsService.exportToExcel(companyId, filter),
        'accounting-purpose-accounts'
      )
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'export_purpose_accounts' })
    }
  }

  async listDeleted(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const { offset } = getPaginationParams(req.query)

      const result = await accountingPurposeAccountsService.listDeleted(
        companyId, { ...req.pagination!, offset }, req.sort, req.filterParams
      )
      sendSuccess(res, result.data, 'Deleted purpose account mappings retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_deleted_purpose_accounts' })
    }
  }

  async restore(req: Request, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      await accountingPurposeAccountsService.restore(req.params.id as string, req.user!.id, companyId)

      logInfo('Purpose account mapping restored', { id: req.params.id, user: req.user!.id })
      sendSuccess(res, null, 'Purpose account mapping restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_purpose_account' })
    }
  }
}

export const accountingPurposeAccountsController = new AccountingPurposeAccountsController()
