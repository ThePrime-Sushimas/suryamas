import { Request, Response, NextFunction } from 'express'
import { employeeBranchesService } from './employee_branches.service'
import type { AuthenticatedRequest } from '../../types/request.types'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  CreateEmployeeBranchSchema,
  UpdateEmployeeBranchSchema,
  BulkDeleteSchema,
  PaginationQuerySchema,
} from './employee_branches.schema'

export class EmployeeBranchesController {
  async getMyBranches(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await employeeBranchesService.getMyBranches(req.user.id)

      res.json({
        success: true,
        data,
      })
    } catch (error) {
      next(error)
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = PaginationQuerySchema.parse(req.query)
      const grouped = req.query.grouped === 'true'
      
      if (grouped) {
        const result = await employeeBranchesService.listGrouped(query)
        res.json({
          success: true,
          data: result.data,
          pagination: result.pagination,
        })
      } else {
        const result = await employeeBranchesService.list(query)
        res.json({
          success: true,
          data: result.data,
          pagination: result.pagination,
        })
      }
    } catch (error) {
      next(error)
    }
  }

  async getByEmployeeId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId } = req.params
      const data = await employeeBranchesService.getByEmployeeId(employeeId)

      res.json({
        success: true,
        data,
      })
    } catch (error) {
      next(error)
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const data = await employeeBranchesService.getById(id)

      res.json({
        success: true,
        data,
      })
    } catch (error) {
      next(error)
    }
  }

  async getByBranchId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branchId } = req.params
      const query = PaginationQuerySchema.parse(req.query)
      const result = await employeeBranchesService.getByBranchId(branchId, query)

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      })
    } catch (error) {
      next(error)
    }
  }

  async getPrimaryBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId } = req.params
      const data = await employeeBranchesService.getPrimaryBranch(employeeId)

      res.json({
        success: true,
        data,
      })
    } catch (error) {
      next(error)
    }
  }

  async create(req: ValidatedAuthRequest<typeof CreateEmployeeBranchSchema>, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = req.validated.body
      const result = await employeeBranchesService.create(validated, req.user?.id)

      res.status(201).json({
        success: true,
        data: result,
        message: 'Employee branch assignment created',
      })
    } catch (error) {
      next(error)
    }
  }

  async update(req: ValidatedAuthRequest<typeof UpdateEmployeeBranchSchema>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { body } = req.validated
      const result = await employeeBranchesService.update(id, body, req.user?.id)

      res.json({
        success: true,
        data: result,
        message: 'Employee branch assignment updated',
      })
    } catch (error) {
      next(error)
    }
  }

  async setPrimaryBranch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId, branchId } = req.params
      await employeeBranchesService.setPrimaryBranch(employeeId, branchId, req.user?.id)

      res.json({
        success: true,
        message: 'Primary branch set successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await employeeBranchesService.delete(id, req.user?.id)

      res.json({
        success: true,
        message: 'Employee branch assignment deleted',
      })
    } catch (error) {
      next(error)
    }
  }

  async deleteByEmployeeAndBranch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId, branchId } = req.params
      await employeeBranchesService.deleteByEmployeeAndBranch(employeeId, branchId, req.user?.id)

      res.json({
        success: true,
        message: 'Employee branch assignment deleted',
      })
    } catch (error) {
      next(error)
    }
  }

  async bulkDelete(req: ValidatedAuthRequest<typeof BulkDeleteSchema>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ids } = req.validated.body
      await employeeBranchesService.bulkDelete(ids, req.user?.id)

      res.json({
        success: true,
        message: `${ids.length} employee branch assignments deleted`,
      })
    } catch (error) {
      next(error)
    }
  }
}

export const employeeBranchesController = new EmployeeBranchesController()
