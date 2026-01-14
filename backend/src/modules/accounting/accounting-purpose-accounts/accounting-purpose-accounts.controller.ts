import { Response } from 'express'
import { accountingPurposeAccountsService } from './accounting-purpose-accounts.service'
import { AccountingPurposeAccountError } from './accounting-purpose-accounts.errors'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { logInfo } from '../../../config/logger'
import { getPaginationParams } from '../../../utils/pagination.util'
import { handleExportToken, handleExport } from '../../../utils/export.util'
import { 
  createAccountingPurposeAccountSchema, 
  updateAccountingPurposeAccountSchema, 
  bulkCreateAccountingPurposeAccountSchema,
  bulkRemoveAccountingPurposeAccountSchema,
  bulkUpdateStatusSchema
} from './accounting-purpose-accounts.schema'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../types/request.types'
import { randomUUID } from 'crypto'

export class AccountingPurposeAccountsController {
  private generateCorrelationId(): string {
    return randomUUID()
  }

  private getCompanyId(req: AuthenticatedRequest | AuthenticatedQueryRequest): string {
    const companyId = (req as any).context?.company_id
    if (!companyId) {
      throw new Error('Branch context required - no company access')
    }
    return companyId
  }

  private async validateCompanyAccess(userId: string, companyId: string): Promise<void> {
    if (!companyId) {
      throw new Error('No company context available')
    }
  }

  private logRequest(method: string, correlationId: string, userId?: string, extra?: any): void {
    logInfo(`${method} request started`, {
      correlation_id: correlationId,
      user_id: userId,
      ...extra
    })
  }

  private logResponse(method: string, correlationId: string, success: boolean, duration: number): void {
    logInfo(`${method} request completed`, {
      correlation_id: correlationId,
      success,
      duration_ms: duration
    })
  }

  async list(req: AuthenticatedQueryRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('LIST', correlationId, req.user?.id, { company_id: companyId })
      
      const { offset } = getPaginationParams(req.query)
      
      if (req.pagination.limit > 1000) {
        throw new Error('Page size cannot exceed 1000')
      }

      const result = await accountingPurposeAccountsService.list(
        companyId,
        { ...req.pagination, offset }, 
        req.sort, 
        req.filterParams
      )
      
      this.logResponse('LIST', correlationId, true, Date.now() - startTime)
      sendSuccess(res, result.data, 'Purpose account mappings retrieved', 200, result.pagination)
    } catch (error) {
      this.logResponse('LIST', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async create(req: ValidatedAuthRequest<typeof createAccountingPurposeAccountSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req as any)
      await this.validateCompanyAccess(req.user!.id, companyId)
      
      this.logRequest('CREATE', correlationId, req.user!.id, { 
        purpose_id: req.validated.body.purpose_id,
        account_id: req.validated.body.account_id,
        company_id: companyId
      })
      
      const purposeAccount = await accountingPurposeAccountsService.create(
        req.validated.body,
        companyId,
        req.user!.id
      )
      
      this.logResponse('CREATE', correlationId, true, Date.now() - startTime)
      logInfo('Purpose account mapping created', {
        correlation_id: correlationId,
        id: purposeAccount.id,
        user: req.user!.id
      })
      sendSuccess(res, purposeAccount, 'Purpose account mapping created', 201)
    } catch (error: any) {
      this.logResponse('CREATE', correlationId, false, Date.now() - startTime)
      if (error instanceof AccountingPurposeAccountError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        })
      }
      handleError(res, error)
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('GET_BY_ID', correlationId, req.user?.id, { 
        id: req.params.id,
        company_id: companyId
      })
      
      const purposeAccount = await accountingPurposeAccountsService.getById(req.params.id, companyId)
      
      this.logResponse('GET_BY_ID', correlationId, true, Date.now() - startTime)
      sendSuccess(res, purposeAccount)
    } catch (error) {
      this.logResponse('GET_BY_ID', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async update(req: ValidatedAuthRequest<typeof updateAccountingPurposeAccountSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req as any)
      await this.validateCompanyAccess(req.user!.id, companyId)
      
      const { body, params } = req.validated
      
      this.logRequest('UPDATE', correlationId, req.user!.id, { 
        id: params.id,
        company_id: companyId
      })
      
      const purposeAccount = await accountingPurposeAccountsService.update(
        params.id, 
        body, 
        req.user!.id, 
        companyId
      )
      
      this.logResponse('UPDATE', correlationId, true, Date.now() - startTime)
      logInfo('Purpose account mapping updated', {
        correlation_id: correlationId,
        id: params.id,
        user: req.user!.id
      })
      sendSuccess(res, purposeAccount, 'Purpose account mapping updated')
    } catch (error) {
      this.logResponse('UPDATE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('DELETE', correlationId, req.user.id, { 
        id: req.params.id,
        company_id: companyId
      })
      
      await accountingPurposeAccountsService.delete(req.params.id, req.user.id, companyId)
      
      this.logResponse('DELETE', correlationId, true, Date.now() - startTime)
      logInfo('Purpose account mapping deleted', {
        correlation_id: correlationId,
        id: req.params.id,
        user: req.user.id
      })
      sendSuccess(res, null, 'Purpose account mapping deleted')
    } catch (error) {
      this.logResponse('DELETE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async bulkCreate(req: ValidatedAuthRequest<typeof bulkCreateAccountingPurposeAccountSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req as any)
      await this.validateCompanyAccess(req.user!.id, companyId)
      
      const { purpose_id, accounts } = req.validated.body
      
      this.logRequest('BULK_CREATE', correlationId, req.user!.id, { 
        purpose_id,
        count: accounts.length,
        company_id: companyId
      })
      
      const purposeAccounts = await accountingPurposeAccountsService.bulkCreate(
        req.validated.body, 
        companyId, 
        req.user!.id
      )
      
      sendSuccess(res, purposeAccounts, 'Bulk create completed', 201)
    } catch (error) {
      handleError(res, error)
    }
  }

  async bulkRemove(req: ValidatedAuthRequest<typeof bulkRemoveAccountingPurposeAccountSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req as any)
      await this.validateCompanyAccess(req.user!.id, companyId)
      
      const { purpose_id, account_ids } = req.validated.body
      
      this.logRequest('BULK_REMOVE', correlationId, req.user!.id, { 
        purpose_id,
        count: account_ids.length,
        company_id: companyId
      })
      
      await accountingPurposeAccountsService.bulkRemove(
        req.validated.body, 
        req.user!.id, 
        companyId
      )
      
      sendSuccess(res, null, 'Bulk remove completed')
    } catch (error) {
      handleError(res, error)
    }
  }

  async bulkUpdateStatus(req: ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req as any)
      await this.validateCompanyAccess(req.user!.id, companyId)
      
      const { ids, is_active } = req.validated.body
      
      this.logRequest('BULK_UPDATE_STATUS', correlationId, req.user!.id, { 
        count: ids.length,
        is_active,
        company_id: companyId
      })
      
      if (ids.length > 100) {
        throw new Error('Cannot update more than 100 records at once')
      }
      
      await accountingPurposeAccountsService.bulkUpdateStatus(ids, is_active, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error) {
      handleError(res, error)
    }
  }

  async generateExportToken(req: AuthenticatedRequest, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req)
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('EXPORT', correlationId, req.user?.id, { company_id: companyId })
      
      return handleExport(
        req, 
        res, 
        (filter) => accountingPurposeAccountsService.exportToExcel(companyId, filter), 
        'accounting-purpose-accounts'
      )
    } catch (error) {
      handleError(res, error)
    }
  }

  async listDeleted(req: AuthenticatedQueryRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('LIST_DELETED', correlationId, req.user?.id, { company_id: companyId })
      
      const { offset } = getPaginationParams(req.query)
      
      const result = await accountingPurposeAccountsService.listDeleted(
        companyId,
        { ...req.pagination, offset }, 
        req.sort, 
        req.filterParams
      )
      
      this.logResponse('LIST_DELETED', correlationId, true, Date.now() - startTime)
      sendSuccess(res, result.data, 'Deleted purpose account mappings retrieved', 200, result.pagination)
    } catch (error) {
      this.logResponse('LIST_DELETED', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async restore(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      await this.validateCompanyAccess(req.user!.id, companyId)
      this.logRequest('RESTORE', correlationId, req.user.id, { 
        id: req.params.id,
        company_id: companyId
      })
      
      await accountingPurposeAccountsService.restore(req.params.id, req.user.id, companyId)
      
      this.logResponse('RESTORE', correlationId, true, Date.now() - startTime)
      logInfo('Purpose account mapping restored', {
        correlation_id: correlationId,
        id: req.params.id,
        user: req.user.id
      })
      sendSuccess(res, null, 'Purpose account mapping restored')
    } catch (error) {
      this.logResponse('RESTORE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }
}

export const accountingPurposeAccountsController = new AccountingPurposeAccountsController()