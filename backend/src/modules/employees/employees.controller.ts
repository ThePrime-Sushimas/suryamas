import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { employeesService } from './employees.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logInfo, logError } from '../../config/logger'

export class EmployeesController {
  async create(req: AuthRequest, res: Response) {
    try {
      const employee = await employeesService.create(req.body)
      logInfo('Employee created', { 
        employee_id: employee.employee_id,
        user: req.user?.id 
      })
      sendSuccess(res, employee, 'Employee created', 201)
    } catch (error) {
      logError('Failed to create employee', {
        error: (error as Error).message,
        body: req.body,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async search(req: AuthRequest, res: Response) {
    try {
      const { q } = req.query
      const employees = await employeesService.search(q as string)
      sendSuccess(res, employees)
    } catch (error) {
      logError('Failed to search employees', {
        error: (error as Error).message,
        query: req.query.q,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async autocomplete(req: AuthRequest, res: Response) {
    try {
      const { q } = req.query
      const employees = await employeesService.autocomplete(q as string)
      sendSuccess(res, employees)
    } catch (error) {
      logError('Failed to autocomplete employees', {
        error: (error as Error).message,
        query: req.query.q,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async getProfile(req: AuthRequest, res: Response) {
    try {
      const employee = await employeesService.getProfile(req.user!.id)
      sendSuccess(res, employee)
    } catch (error) {
      logError('Failed to get profile', {
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 404)
    }
  }

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const employee = await employeesService.updateProfile(req.user!.id, req.body)
      logInfo('Profile updated', { user: req.user?.id })
      sendSuccess(res, employee, 'Profile updated')
    } catch (error) {
      logError('Failed to update profile', {
        error: (error as Error).message,
        body: req.body,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      await employeesService.delete(req.params.id)
      logInfo('Employee deleted', { 
        id: req.params.id,
        user: req.user?.id 
      })
      sendSuccess(res, null, 'Employee deleted')
    } catch (error) {
      logError('Failed to delete employee', {
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }
}

export const employeesController = new EmployeesController()