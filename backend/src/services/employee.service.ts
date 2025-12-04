import { employeeRepository } from '../repositories/employee.repository'
import { Employee } from '../types/employee.types'

export class EmployeeService {
  async getProfile(userId: string): Promise<Employee> {
    const employee = await employeeRepository.findByUserId(userId)
    
    if (!employee) {
      throw new Error('Employee profile not found')
    }

    return employee
  }

  async updateProfile(userId: string, updates: Partial<Employee>): Promise<Employee> {
    // Remove protected fields
    const { id, employee_id, user_id, created_at, ...allowedUpdates } = updates

    // Validate updates if needed
    if (Object.keys(allowedUpdates).length === 0) {
      throw new Error('No valid fields to update')
    }

    const employee = await employeeRepository.update(userId, allowedUpdates)
    
    if (!employee) {
      throw new Error('Failed to update employee profile')
    }

    return employee
  }
}

export const employeeService = new EmployeeService()