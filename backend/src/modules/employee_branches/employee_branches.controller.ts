import { Request, Response } from 'express'
import { employeeBranchesService } from './employee_branches.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  CreateEmployeeBranchSchema,
  UpdateEmployeeBranchSchema,
  BulkDeleteSchema,
} from './employee_branches.schema'
import { PaginationQuerySchema, employeeBranchIdSchema, employeeIdSchema, branchIdSchema } from './employee_branches.schema'

export class EmployeeBranchesController {
  async getMyBranches(req: Request, res: Response): Promise<void> {
    try {
      const data = await employeeBranchesService.getMyBranches(req.user!.id)
      sendSuccess(res, data)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_my_branches' })
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
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_employee_branches', grouped: req.query.grouped })
    }
  }

  async getByEmployeeId(req: Request, res: Response): Promise<void> {
    try {
      const { employeeId } = (req as ValidatedAuthRequest<typeof employeeIdSchema>).validated.params
      const data = await employeeBranchesService.getByEmployeeId(employeeId)
      sendSuccess(res, data)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_by_employee', employeeId: req.params.employeeId })
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = (req as ValidatedAuthRequest<typeof employeeBranchIdSchema>).validated.params
      const data = await employeeBranchesService.getById(id)
      sendSuccess(res, data)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_employee_branch', id: req.params.id })
    }
  }

  async getByBranchId(req: Request, res: Response): Promise<void> {
    try {
      const { branchId } = (req as ValidatedAuthRequest<typeof branchIdSchema>).validated.params
      const query = PaginationQuerySchema.parse(req.query)
      const result = await employeeBranchesService.getByBranchId(branchId, query)
      sendSuccess(res, result.data, 'Employee branches retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_by_branch', branchId: req.params.branchId })
    }
  }

  async getPrimaryBranch(req: Request, res: Response): Promise<void> {
    try {
      const { employeeId } = (req as ValidatedAuthRequest<typeof employeeIdSchema>).validated.params
      const data = await employeeBranchesService.getPrimaryBranch(employeeId)
      sendSuccess(res, data)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_primary_branch', employeeId: req.params.employeeId })
    }
  }

  async create(req: ValidatedAuthRequest<typeof CreateEmployeeBranchSchema>, res: Response): Promise<void> {
    try {
      const result = await employeeBranchesService.create(req.validated.body, req.user?.id)
      sendSuccess(res, result, 'Employee branch assignment created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_employee_branch' })
    }
  }

  async update(req: ValidatedAuthRequest<typeof UpdateEmployeeBranchSchema>, res: Response): Promise<void> {
    try {
      const { id } = (req as ValidatedAuthRequest<typeof employeeBranchIdSchema>).validated.params
      const { body } = req.validated
      const result = await employeeBranchesService.update(id, body, req.user?.id)
      sendSuccess(res, result, 'Employee branch assignment updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_employee_branch', id: req.params.id })
    }
  }

  async setPrimaryBranch(req: Request, res: Response): Promise<void> {
    try {
      const { employeeId } = (req as ValidatedAuthRequest<typeof employeeIdSchema>).validated.params
      const { branchId } = (req as ValidatedAuthRequest<typeof branchIdSchema>).validated.params
      await employeeBranchesService.setPrimaryBranch(employeeId, branchId, req.user?.id)
      sendSuccess(res, null, 'Primary branch set successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'set_primary_branch', employeeId: req.params.employeeId, branchId: req.params.branchId })
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = (req as ValidatedAuthRequest<typeof employeeBranchIdSchema>).validated.params
      await employeeBranchesService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Employee branch assignment deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_employee_branch', id: req.params.id })
    }
  }

  async deleteByEmployeeAndBranch(req: Request, res: Response): Promise<void> {
    try {
      const { employeeId } = (req as ValidatedAuthRequest<typeof employeeIdSchema>).validated.params
      const { branchId } = (req as ValidatedAuthRequest<typeof branchIdSchema>).validated.params
      await employeeBranchesService.deleteByEmployeeAndBranch(employeeId, branchId, req.user?.id)
      sendSuccess(res, null, 'Employee branch assignment deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_by_employee_branch', employeeId: req.params.employeeId, branchId: req.params.branchId })
    }
  }

  async bulkDelete(req: ValidatedAuthRequest<typeof BulkDeleteSchema>, res: Response): Promise<void> {
    try {
      const { ids } = req.validated.body
      await employeeBranchesService.bulkDelete(ids, req.user?.id)
      sendSuccess(res, null, `${ids.length} employee branch assignments deleted`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_employee_branches' })
    }
  }

  async suspend(req: Request, res: Response): Promise<void> {
    try {
      const { id } = (req as ValidatedAuthRequest<typeof employeeBranchIdSchema>).validated.params
      const result = await employeeBranchesService.suspend(id, req.user?.id)
      sendSuccess(res, result, 'Employee branch access suspended')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'suspend_employee_branch', id: req.params.id })
    }
  }

  async activate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = (req as ValidatedAuthRequest<typeof employeeBranchIdSchema>).validated.params
      const result = await employeeBranchesService.activate(id, req.user?.id)
      sendSuccess(res, result, 'Employee branch access activated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'activate_employee_branch', id: req.params.id })
    }
  }
}

export const employeeBranchesController = new EmployeeBranchesController()
