import { Request, Response } from 'express'
import { employeeBranchesService } from './employee_branches.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'

import { getParamString } from '../../utils/validation.util'
import type { AuthenticatedRequest } from '../../types/request.types'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  CreateEmployeeBranchSchema,
  UpdateEmployeeBranchSchema,
  BulkDeleteSchema,
  PaginationQuerySchema,
} from './employee_branches.schema'

export class EmployeeBranchesController {
  async getMyBranches(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = await employeeBranchesService.getMyBranches(req.user.id)
      sendSuccess(res, data)
    } catch (error) {
      handleError(res, error)
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = PaginationQuerySchema.parse(req.query)
      const grouped = req.query.grouped === 'true'
      
      if (grouped) {
        const result = await employeeBranchesService.listGrouped(query)
        sendSuccess(res, result.data, 'Employee branches retrieved', 200, result.pagination)
      } else {
        const result = await employeeBranchesService.list(query)
        sendSuccess(res, result.data, 'Employee branches retrieved', 200, result.pagination)
      }
    } catch (error) {
      handleError(res, error)
    }
  }

  async getByEmployeeId(req: Request, res: Response): Promise<void> {
    try {
      const employeeId = getParamString(req.params.employeeId)
      const data = await employeeBranchesService.getByEmployeeId(employeeId)
      sendSuccess(res, data)
    } catch (error) {
      handleError(res, error)
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = getParamString(req.params.id)
      const data = await employeeBranchesService.getById(id)
      sendSuccess(res, data)
    } catch (error) {
      handleError(res, error)
    }
  }

  async getByBranchId(req: Request, res: Response): Promise<void> {
    try {
      const branchId = getParamString(req.params.branchId)
      const query = PaginationQuerySchema.parse(req.query)
      const result = await employeeBranchesService.getByBranchId(branchId, query)
      sendSuccess(res, result.data, 'Employee branches retrieved', 200, result.pagination)
    } catch (error) {
      handleError(res, error)
    }
  }

  async getPrimaryBranch(req: Request, res: Response): Promise<void> {
    try {
      const employeeId = getParamString(req.params.employeeId)
      const data = await employeeBranchesService.getPrimaryBranch(employeeId)
      sendSuccess(res, data)
    } catch (error) {
      handleError(res, error)
    }
  }

  async create(req: ValidatedAuthRequest<typeof CreateEmployeeBranchSchema>, res: Response): Promise<void> {
    try {
      const validated = req.validated.body
      const result = await employeeBranchesService.create(validated, req.user?.id)
      sendSuccess(res, result, 'Employee branch assignment created', 201)
    } catch (error) {
      handleError(res, error)
    }
  }

  async update(req: ValidatedAuthRequest<typeof UpdateEmployeeBranchSchema>, res: Response): Promise<void> {
    try {
      const id = getParamString(req.params.id)
      const { body } = req.validated
      const result = await employeeBranchesService.update(id, body, req.user?.id)
      sendSuccess(res, result, 'Employee branch assignment updated')
    } catch (error) {
      handleError(res, error)
    }
  }

  async setPrimaryBranch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const employeeId = getParamString(req.params.employeeId)
      const branchId = getParamString(req.params.branchId)
      await employeeBranchesService.setPrimaryBranch(employeeId, branchId, req.user?.id)
      sendSuccess(res, null, 'Primary branch set successfully')
    } catch (error) {
      handleError(res, error)
    }
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = getParamString(req.params.id)
      await employeeBranchesService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Employee branch assignment deleted')
    } catch (error) {
      handleError(res, error)
    }
  }

  async deleteByEmployeeAndBranch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const employeeId = getParamString(req.params.employeeId)
      const branchId = getParamString(req.params.branchId)
      await employeeBranchesService.deleteByEmployeeAndBranch(employeeId, branchId, req.user?.id)
      sendSuccess(res, null, 'Employee branch assignment deleted')
    } catch (error) {
      handleError(res, error)
    }
  }

  async bulkDelete(req: ValidatedAuthRequest<typeof BulkDeleteSchema>, res: Response): Promise<void> {
    try {
      const { ids } = req.validated.body
      await employeeBranchesService.bulkDelete(ids, req.user?.id)
      sendSuccess(res, null, `${ids.length} employee branch assignments deleted`)
    } catch (error) {
      handleError(res, error)
    }
  }

  async suspend(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = getParamString(req.params.id)
      const result = await employeeBranchesService.suspend(id, req.user?.id)
      sendSuccess(res, result, 'Employee branch access suspended')
    } catch (error) {
      handleError(res, error)
    }
  }

  async activate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = getParamString(req.params.id)
      const result = await employeeBranchesService.activate(id, req.user?.id)
      sendSuccess(res, result, 'Employee branch access activated')
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const employeeBranchesController = new EmployeeBranchesController()
