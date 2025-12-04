import { Response } from 'express'
import { AuthRequest } from '../types/common.types'
import { employeeService } from '../services/employee.service'
import { sendSuccess, sendError } from '../utils/response.util'

export class EmployeeController {
  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const employee = await employeeService.getProfile(req.user!.id)
      sendSuccess(res, employee)
    } catch (error) {
      sendError(res, (error as Error).message, 404)
    }
  }

  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const employee = await employeeService.updateProfile(req.user!.id, req.body)
      sendSuccess(res, employee, 'Profile updated successfully')
    } catch (error) {
      sendError(res, (error as Error).message, 400)
    }
  }
}

export const employeeController = new EmployeeController()