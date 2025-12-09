import { employeesRepository } from './employees.repository'
import { Employee } from '../../types/employee.types'
import { PaginatedResponse, createPaginatedResponse } from '../../utils/pagination.util'

export class EmployeesService {
  async list(pagination: { page: number; limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }): Promise<PaginatedResponse<Employee>> {
    const { data, total } = await employeesRepository.findAll(pagination, sort)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async create(data: Partial<Employee>, file?: Express.Multer.File): Promise<Employee> {
    let profilePictureUrl: string | null = null
    
    if (file) {
      const fileName = `${Date.now()}-${file.originalname}`
      const { error } = await employeesRepository.uploadFile(fileName, file.buffer, file.mimetype)
      if (!error) {
        profilePictureUrl = employeesRepository.getPublicUrl(fileName)
      }
    }
    
    const employee = await employeesRepository.create({
      ...data,
      profile_picture: profilePictureUrl
    })
    
    if (!employee) {
      throw new Error('Failed to create employee')
    }

    return employee
  }

  async search(searchTerm: string, pagination: { page: number; limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: any): Promise<PaginatedResponse<Employee>> {
    const { data, total } = await employeesRepository.searchByName(searchTerm, pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async getFilterOptions() {
    return await employeesRepository.getFilterOptions()
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

    // Remove empty strings to avoid date validation errors
    const cleanedUpdates = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([_, value]) => value !== '')
    )

    if (Object.keys(cleanedUpdates).length === 0) {
      throw new Error('No valid fields to update')
    }

    const employee = await employeesRepository.update(userId, cleanedUpdates)
    
    if (!employee) {
      throw new Error('Failed to update employee profile')
    }

    return employee
  }

  async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string> {
    const fileName = `${userId}-${Date.now()}.${file.mimetype.split('/')[1]}`
    const { data, error } = await employeesRepository.uploadFile(fileName, file.buffer, file.mimetype)
    
    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`)
    }
    
    const publicUrl = employeesRepository.getPublicUrl(fileName)
    const updated = await employeesRepository.update(userId, { profile_picture: publicUrl })
    
    if (!updated) {
      throw new Error('Failed to update profile picture in database')
    }
    
    return publicUrl
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