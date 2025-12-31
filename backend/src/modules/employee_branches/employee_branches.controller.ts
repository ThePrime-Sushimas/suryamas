import { Request, Response, NextFunction } from 'express'
import { employeeBranchesService } from './employee_branches.service'
import type { AuthenticatedRequest } from '../../types/request.types'
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

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = CreateEmployeeBranchSchema.parse(req.body)
      const result = await employeeBranchesService.create(validated)

      res.status(201).json({
        success: true,
        data: result,
        message: 'Employee branch assignment created',
      })
    } catch (error) {
      next(error)
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const validated = UpdateEmployeeBranchSchema.parse(req.body)
      const result = await employeeBranchesService.update(id, validated)

      res.json({
        success: true,
        data: result,
        message: 'Employee branch assignment updated',
      })
    } catch (error) {
      next(error)
    }
  }

  async setPrimaryBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId, branchId } = req.params
      await employeeBranchesService.setPrimaryBranch(employeeId, branchId)

      res.json({
        success: true,
        message: 'Primary branch set successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await employeeBranchesService.delete(id)

      res.json({
        success: true,
        message: 'Employee branch assignment deleted',
      })
    } catch (error) {
      next(error)
    }
  }

  async deleteByEmployeeAndBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId, branchId } = req.params
      await employeeBranchesService.deleteByEmployeeAndBranch(employeeId, branchId)

      res.json({
        success: true,
        message: 'Employee branch assignment deleted',
      })
    } catch (error) {
      next(error)
    }
  }

  async bulkDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = BulkDeleteSchema.parse(req.body)
      await employeeBranchesService.bulkDelete(validated.ids)

      res.json({
        success: true,
        message: `${validated.ids.length} employee branch assignments deleted`,
      })
    } catch (error) {
      next(error)
    }
  }
}

export const employeeBranchesController = new EmployeeBranchesController()
