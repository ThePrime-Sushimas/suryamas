import { Response } from 'express'
import { journalHeadersService } from './journal-headers.service'
import { sendSuccess } from '../../../../utils/response.util'
import { handleError } from '../../../../utils/error-handler.util'
import { getPaginationParams } from '../../../../utils/pagination.util'
import { requireEmployee, getEmployeeId } from '../../../../utils/employee.util'

import { getParamString } from '../../../../utils/validation.util'
import { ValidatedAuthRequest } from '../../../../middleware/validation.middleware'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../../types/request.types'
import { 
  createJournalSchema, 
  updateJournalSchema, 
  rejectJournalSchema,
  reverseJournalSchema
} from './journal-headers.schema'

export class JournalHeadersController {
  
  private getCompanyId(req: AuthenticatedRequest): string {
    const companyId = (req as any).context?.company_id
    if (!companyId) {
      throw new Error('Branch context required - no company access')
    }
    return companyId
  }

  async list(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const { offset } = getPaginationParams(req.query)
      
      const result = await journalHeadersService.list(
        companyId,
        { ...req.pagination, offset },
        req.sort as any,
        { ...req.filterParams, company_id: companyId }
      )
      
      sendSuccess(res, result.data, 'Journals retrieved', 200, result.pagination)
    } catch (error) {
      handleError(res, error)
    }
  }

  async listWithLines(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const { offset } = getPaginationParams(req.query)
      
      const result = await journalHeadersService.listWithLines(
        companyId,
        { ...req.pagination, offset },
        req.sort as any,
        { ...req.filterParams, company_id: companyId }
      )
      
      sendSuccess(res, result.data, 'Journals with lines retrieved', 200, result.pagination)
    } catch (error) {
      handleError(res, error)
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const journal = await journalHeadersService.getById(getParamString(req.params.id), companyId)
      sendSuccess(res, journal)
    } catch (error) {
      handleError(res, error)
    }
  }

  async create(req: ValidatedAuthRequest<typeof createJournalSchema>, res: Response) {
    try {
      requireEmployee(req as any)
      const companyId = this.getCompanyId(req as any)
      const employeeId = getEmployeeId(req as any)
      
      // Priority: context branch_id > body branch_id > null
      const branchId = (req as any).context?.branch_id || req.validated.body.branch_id || null
      
      const journal = await journalHeadersService.create({
        ...req.validated.body,
        company_id: companyId,
        branch_id: branchId
      }, employeeId)
      
      sendSuccess(res, journal, 'Journal created', 201)
    } catch (error) {
      handleError(res, error)
    }
  }

  async update(req: ValidatedAuthRequest<typeof updateJournalSchema>, res: Response) {
    try {
      requireEmployee(req as any)
      const companyId = this.getCompanyId(req as any)
      const employeeId = getEmployeeId(req as any)
      
      const journal = await journalHeadersService.update(
        req.validated.params.id,
        req.validated.body,
        employeeId,
        companyId
      )
      
      sendSuccess(res, journal, 'Journal updated')
    } catch (error) {
      handleError(res, error)
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      requireEmployee(req)
      const companyId = this.getCompanyId(req)
      const employeeId = getEmployeeId(req)
      
      await journalHeadersService.delete(getParamString(req.params.id), employeeId, companyId)
      sendSuccess(res, null, 'Journal deleted')
    } catch (error) {
      handleError(res, error)
    }
  }

  async submit(req: AuthenticatedRequest, res: Response) {
    try {
      requireEmployee(req)
      const companyId = this.getCompanyId(req)
      const employeeId = getEmployeeId(req)
      
      await journalHeadersService.submit(getParamString(req.params.id), employeeId, companyId)
      sendSuccess(res, null, 'Journal submitted for approval')
    } catch (error) {
      handleError(res, error)
    }
  }

  async approve(req: AuthenticatedRequest, res: Response) {
    try {
      requireEmployee(req)
      const companyId = this.getCompanyId(req)
      const employeeId = getEmployeeId(req)
      
      await journalHeadersService.approve(getParamString(req.params.id), employeeId, companyId)
      sendSuccess(res, null, 'Journal approved')
    } catch (error) {
      handleError(res, error)
    }
  }

  async reject(req: ValidatedAuthRequest<typeof rejectJournalSchema>, res: Response) {
    try {
      requireEmployee(req as any)
      const companyId = this.getCompanyId(req as any)
      const employeeId = getEmployeeId(req as any)
      
      await journalHeadersService.reject(
        req.validated.params.id,
        req.validated.body.rejection_reason,
        employeeId,
        companyId
      )
      
      sendSuccess(res, null, 'Journal rejected')
    } catch (error) {
      handleError(res, error)
    }
  }

  async post(req: AuthenticatedRequest, res: Response) {
    try {
      requireEmployee(req)
      const companyId = this.getCompanyId(req)
      const employeeId = getEmployeeId(req)
      
      await journalHeadersService.post(getParamString(req.params.id), employeeId, companyId)
      sendSuccess(res, null, 'Journal posted to ledger')
    } catch (error) {
      handleError(res, error)
    }
  }

  async reverse(req: ValidatedAuthRequest<typeof reverseJournalSchema>, res: Response) {
    try {
      requireEmployee(req as any)
      const companyId = this.getCompanyId(req as any)
      const employeeId = getEmployeeId(req as any)
      
      const reversal = await journalHeadersService.reverse(
        req.validated.params.id,
        req.validated.body.reversal_reason,
        employeeId,
        companyId
      )
      
      sendSuccess(res, reversal, 'Journal reversed')
    } catch (error) {
      handleError(res, error)
    }
  }

  async restore(req: AuthenticatedRequest, res: Response) {
    try {
      requireEmployee(req)
      const companyId = this.getCompanyId(req)
      const employeeId = getEmployeeId(req)
      
      await journalHeadersService.restore(getParamString(req.params.id), employeeId, companyId)
      sendSuccess(res, null, 'Journal restored')
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const journalHeadersController = new JournalHeadersController()
