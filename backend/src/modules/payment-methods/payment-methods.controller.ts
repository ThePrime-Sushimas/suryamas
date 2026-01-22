import { Response } from 'express'
import { paymentMethodsService } from './payment-methods.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'
import { getPaginationParams } from '../../utils/pagination.util'
import { handleExportToken, handleExport } from '../../utils/export.util'

import { getParamString } from '../../utils/validation.util'
import { 
  createPaymentMethodSchema, 
  updatePaymentMethodSchema, 
  paymentMethodIdSchema,
  bulkUpdateStatusSchema,
  bulkDeleteSchema
} from './payment-methods.schema'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import { randomUUID } from 'crypto'
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './payment-methods.types'

export class PaymentMethodsController {
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
      this.logRequest('LIST', correlationId, req.user?.id, { company_id: companyId })
      
      const { offset } = getPaginationParams(req.query)
      
      if (req.pagination.limit > 1000) {
        throw new Error('Page size cannot exceed 1000')
      }

      const result = await paymentMethodsService.list(
        companyId,
        { ...req.pagination, offset }, 
        req.sort, 
        req.filterParams
      )
      
      this.logResponse('LIST', correlationId, true, Date.now() - startTime)
      sendSuccess(res, result.data, 'Payment methods retrieved', 200, result.pagination)
    } catch (error) {
      this.logResponse('LIST', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async create(req: ValidatedAuthRequest<typeof createPaymentMethodSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req as any)
      
      this.logRequest('CREATE', correlationId, req.user!.id, { 
        code: req.validated.body.code,
        name: req.validated.body.name,
        payment_type: req.validated.body.payment_type,
        company_id: companyId
      })
      
      const paymentMethod = await paymentMethodsService.create(
        {
          ...req.validated.body,
          company_id: companyId
        } as CreatePaymentMethodDto,
        req.user!.id
      )
      
      this.logResponse('CREATE', correlationId, true, Date.now() - startTime)
      sendSuccess(res, paymentMethod, 'Payment method created', 201)
    } catch (error) {
      this.logResponse('CREATE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req)
      const id = parseInt(getParamString(req.params.id))
      
      this.logRequest('GET_BY_ID', correlationId, req.user?.id, { id, company_id: companyId })
      
      const paymentMethod = await paymentMethodsService.getById(id, companyId)
      
      this.logResponse('GET_BY_ID', correlationId, true, Date.now() - startTime)
      sendSuccess(res, paymentMethod)
    } catch (error) {
      this.logResponse('GET_BY_ID', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async update(req: ValidatedAuthRequest<typeof updatePaymentMethodSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()
    
    try {
      const companyId = this.getCompanyId(req as any)
      const id = parseInt(req.validated.params.id)
      const { body } = req.validated
      
      this.logRequest('UPDATE', correlationId, req.user!.id, { id, company_id: companyId })
      
      const paymentMethod = await paymentMethodsService.update(
        id, 
        body as UpdatePaymentMethodDto, 
        req.user!.id, 
        companyId
      )
      
      this.logResponse('UPDATE', correlationId, true, Date.now() - startTime)
      sendSuccess(res, paymentMethod, 'Payment method updated')
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
      const id = parseInt(getParamString(req.params.id))
      
      this.logRequest('DELETE', correlationId, req.user.id, { id, company_id: companyId })
      
      await paymentMethodsService.delete(id, req.user.id, companyId)
      
      this.logResponse('DELETE', correlationId, true, Date.now() - startTime)
      sendSuccess(res, null, 'Payment method deleted')
    } catch (error) {
      this.logResponse('DELETE', correlationId, false, Date.now() - startTime)
      handleError(res, error)
    }
  }

  async bulkUpdateStatus(req: ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req as any)
      const { ids, is_active } = req.validated.body
      
      this.logRequest('BULK_UPDATE_STATUS', correlationId, req.user!.id, { 
        count: ids.length,
        is_active,
        company_id: companyId
      })
      
      if (ids.length > 100) {
        throw new Error('Cannot update more than 100 records at once')
      }
      
      await paymentMethodsService.bulkUpdateStatus(ids, is_active, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error) {
      handleError(res, error)
    }
  }

  async bulkDelete(req: ValidatedAuthRequest<typeof bulkDeleteSchema>, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req as any)
      const { ids } = req.validated.body
      
      this.logRequest('BULK_DELETE', correlationId, req.user!.id, { 
        count: ids.length,
        company_id: companyId
      })
      
      if (ids.length > 100) {
        throw new Error('Cannot delete more than 100 records at once')
      }
      
      await paymentMethodsService.bulkDelete(ids, req.user!.id, companyId)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error) {
      handleError(res, error)
    }
  }

  async generateExportToken(req: AuthenticatedRequest, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: AuthenticatedQueryRequest, res: Response) {
    const correlationId = this.generateCorrelationId()
    
    try {
      const companyId = this.getCompanyId(req)
      this.logRequest('EXPORT', correlationId, req.user?.id, { company_id: companyId })
      
      return handleExport(
        req, 
        res, 
        (filter) => paymentMethodsService.exportToExcel(companyId, filter), 
        'payment-methods'
      )
    } catch (error) {
      handleError(res, error)
    }
  }

  async getOptions(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const options = await paymentMethodsService.getOptions(companyId)
      sendSuccess(res, options, 'Payment method options retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const paymentMethodsController = new PaymentMethodsController()

