import { employeesRepository } from './employees.repository'
import { Employee } from '../../types/employee.types'
import { PaginatedResponse, createPaginatedResponse } from '../../utils/pagination.util'

export class EmployeesService {
  async list(pagination: { page: number; limit: number; offset: number }): Promise<PaginatedResponse<Employee>> {
    const { data, total } = await employeesRepository.findAll(pagination)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async create(data: Partial<Employee>): Promise<Employee> {
    const employee = await employeesRepository.create(data)
    
    if (!employee) {
      throw new Error('Failed to create employee')
    }

    return employee
  }

  async search(searchTerm: string, pagination: { page: number; limit: number; offset: number }): Promise<PaginatedResponse<Employee>> {
    const { data, total } = await employeesRepository.searchByName(searchTerm, pagination)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
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

  async getById(id: string): Promise<Employee> {
    const employee = await employeesRepository.findById(id)
    
    if (!employee) {
      throw new Error('Employee not found')
    }

    return employee
  }

  async delete(id: string): Promise<void> {
    await employeesRepository.delete(id)
  }
}

export const employeesService = new EmployeesService()