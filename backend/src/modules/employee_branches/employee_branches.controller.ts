import { Request, Response } from 'express'
import { employeeBranchesService } from './employee_branches.service'
import { logError } from '../../config/logger'

export class EmployeeBranchesController {
  async list(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10

      const result = await employeeBranchesService.list({ page, limit })
      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error: any) {
      logError('List employee branches failed', { error: error.message })
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async getByEmployeeId(req: Request, res: Response) {
    try {
      const { employeeId } = req.params
      const data = await employeeBranchesService.getByEmployeeId(employeeId)
      res.json({ success: true, data })
    } catch (error: any) {
      logError('Get employee branches failed', { error: error.message })
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const data = await employeeBranchesService.getById(id)
      res.json({ success: true, data })
    } catch (error: any) {
      logError('Get employee branch failed', { error: error.message })
      res.status(404).json({ success: false, error: error.message })
    }
  }

  async getByBranchId(req: Request, res: Response) {
    try {
      const { branchId } = req.params
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10

      const result = await employeeBranchesService.getByBranchId(branchId, { page, limit })
      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error: any) {
      logError('Get branch employees failed', { error: error.message })
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async getPrimaryBranch(req: Request, res: Response) {
    try {
      const { employeeId } = req.params
      const data = await employeeBranchesService.getPrimaryBranch(employeeId)
      res.json({ success: true, data })
    } catch (error: any) {
      logError('Get primary branch failed', { error: error.message })
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { employee_id, branch_id, is_primary } = req.body

      const result = await employeeBranchesService.create({
        employee_id,
        branch_id,
        is_primary,
      })

      res.status(201).json({ success: true, data: result, message: 'Employee branch created' })
    } catch (error: any) {
      logError('Create employee branch failed', { error: error.message })
      res.status(400).json({ success: false, error: error.message })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { is_primary } = req.body

      const result = await employeeBranchesService.update(id, { is_primary })
      res.json({ success: true, data: result, message: 'Employee branch updated' })
    } catch (error: any) {
      logError('Update employee branch failed', { error: error.message })
      res.status(400).json({ success: false, error: error.message })
    }
  }

  async setPrimaryBranch(req: Request, res: Response) {
    try {
      const { employeeId, branchId } = req.params

      await employeeBranchesService.setPrimaryBranch(employeeId, branchId)
      res.json({ success: true, message: 'Primary branch set' })
    } catch (error: any) {
      logError('Set primary branch failed', { error: error.message })
      res.status(400).json({ success: false, error: error.message })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      await employeeBranchesService.delete(id)
      res.json({ success: true, message: 'Employee branch deleted' })
    } catch (error: any) {
      logError('Delete employee branch failed', { error: error.message })
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async deleteByEmployeeAndBranch(req: Request, res: Response) {
    try {
      const { employeeId, branchId } = req.params

      await employeeBranchesService.deleteByEmployeeAndBranch(employeeId, branchId)
      res.json({ success: true, message: 'Employee branch deleted' })
    } catch (error: any) {
      logError('Delete employee branch failed', { error: error.message })
      res.status(500).json({ success: false, error: error.message })
    }
  }

  async bulkDelete(req: Request, res: Response) {
    try {
      const { ids } = req.body

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ids array is required' })
      }

      await employeeBranchesService.bulkDelete(ids)
      res.json({ success: true, message: 'Employee branches deleted' })
    } catch (error: any) {
      logError('Bulk delete employee branches failed', { error: error.message })
      res.status(500).json({ success: false, error: error.message })
    }
  }
}

export const employeeBranchesController = new EmployeeBranchesController()
