import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { employeesService } from './employees.service'
import { sendSuccess, sendError } from '../../utils/response.util'

export class EmployeesController {
  async create(req: AuthRequest, res: Response) {
    try {
      const employee = await employeesService.create(req.body)
      sendSuccess(res, employee, 'Employee created', 201)
    } catch (error) {
      sendError(res, (error as Error).message, 400)
    }
  }

  async search(req: AuthRequest, res: Response) {
    try {
      const { q } = req.query
      const employees = await employeesService.search(q as string)
      sendSuccess(res, employees)
    } catch (error) {
      sendError(res, (error as Error).message, 400)
    }
  }

  async autocomplete(req: AuthRequest, res: Response) {
    try {
      const { q } = req.query
      const employees = await employeesService.autocomplete(q as string)
      sendSuccess(res, employees)
    } catch (error) {
      sendError(res, (error as Error).message, 400)
    }
  }

  async getProfile(req: AuthRequest, res: Response) {
    try {
      const employee = await employeesService.getProfile(req.user!.id)
      sendSuccess(res, employee)
    } catch (error) {
      sendError(res, (error as Error).message, 404)
    }
  }

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const employee = await employeesService.updateProfile(req.user!.id, req.body)
      sendSuccess(res, employee, 'Profile updated')
    } catch (error) {
      sendError(res, (error as Error).message, 400)
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      await employeesService.delete(req.params.id)
      sendSuccess(res, null, 'Employee deleted')
    } catch (error) {
      sendError(res, (error as Error).message, 400)
    }
  }
}

export const employeesController = new EmployeesController()