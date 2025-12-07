import { employeesRepository } from './employees.repository'
import { Employee } from '../../types/employee.types'

export class EmployeesService {
  async create(data: Partial<Employee>): Promise<Employee> {
    const employee = await employeesRepository.create(data)
    
    if (!employee) {
      throw new Error('Failed to create employee')
    }

    return employee
  }

  async search(searchTerm: string): Promise<Employee[]> {
    return await employeesRepository.searchByName(searchTerm)
  }

  async autocomplete(query: string): Promise<{id: string, full_name: string}[]> {
    return await employeesRepository.autocompleteName(query)
  }

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

  async delete(id: string): Promise<void> {
    await employeesRepository.delete(id)
  }
}

export const employeesService = new EmployeesService()