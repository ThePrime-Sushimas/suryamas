import { employeesRepository } from './employees.repository'
import { Employee } from '../../types/employee.types'

export class EmployeesService {
  async getProfile(userId: string): Promise<Employee> {
    const employee = await employeesRepository.findByUserId(userId)
    
    if (!employee) {
      throw new Error('Employee profile not found')
    }

    return employee
  }

  async updateProfile(userId: string, updates: Partial<Employee>): Promise<Employee> {
    const { id, employee_id, user_id, created_at, ...allowedUpdates } = updates

    if (Object.keys(allowedUpdates).length === 0) {
      throw new Error('No valid fields to update')
    }

    const employee = await employeesRepository.update(userId, allowedUpdates)
    
    if (!employee) {
      throw new Error('Failed to update employee profile')
    }

    return employee
  }
}

export const employeesService = new EmployeesService()