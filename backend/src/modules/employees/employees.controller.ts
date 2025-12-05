import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { employeesService } from './employees.service'
import { sendSuccess, sendError } from '../../utils/response.util'

export class EmployeesController {
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
}

export const employeesController = new EmployeesController()