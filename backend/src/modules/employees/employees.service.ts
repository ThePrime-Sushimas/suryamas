import { employeesRepository } from './employees.repository'
import { Employee } from '../../types/employee.types'
import { PaginatedResponse, createPaginatedResponse } from '../../utils/pagination.util'
import { ExportService } from '../../services/export.service'
import { ImportService } from '../../services/import.service'

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

  async bulkUpdateActive(ids: string[], isActive: boolean): Promise<void> {
    await employeesRepository.bulkUpdateActive(ids, isActive)
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await employeesRepository.bulkDelete(ids)
  }

  async exportToExcel(filter?: any): Promise<Buffer> {
    const data = await employeesRepository.exportData(filter)
    const columns = [
      { header: 'Employee ID', key: 'employee_id', width: 15 },
      { header: 'Full Name', key: 'full_name', width: 25 },
      { header: 'Job Position', key: 'job_position', width: 20 },
      { header: 'Branch Name', key: 'branch_name', width: 20 },
      { header: 'Parent Branch', key: 'parent_branch_name', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Mobile Phone', key: 'mobile_phone', width: 15 },
      { header: 'NIK', key: 'nik', width: 20 },
      { header: 'Birth Date', key: 'birth_date', width: 15 },
      { header: 'Birth Place', key: 'birth_place', width: 20 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'Gender', key: 'gender', width: 12 },
      { header: 'Religion', key: 'religion', width: 15 },
      { header: 'Marital Status', key: 'marital_status', width: 15 },
      { header: 'Address', key: 'citizen_id_address', width: 40 },
      { header: 'Join Date', key: 'join_date', width: 15 },
      { header: 'Resign Date', key: 'resign_date', width: 15 },
      { header: 'Sign Date', key: 'sign_date', width: 15 },
      { header: 'End Date', key: 'end_date', width: 15 },
      { header: 'Status Employee', key: 'status_employee', width: 15 },
      { header: 'Active', key: 'is_active', width: 10 },
      { header: 'PTKP Status', key: 'ptkp_status', width: 15 },
      { header: 'Bank Name', key: 'bank_name', width: 20 },
      { header: 'Bank Account', key: 'bank_account', width: 20 },
      { header: 'Bank Account Holder', key: 'bank_account_holder', width: 25 },
      { header: 'Profile Picture', key: 'profile_picture', width: 50 },
      { header: 'Created At', key: 'created_at', width: 20 },
    ]
    return await ExportService.generateExcel(data, columns)
  }

  async previewImport(buffer: Buffer): Promise<any[]> {
    return await ImportService.parseExcel(buffer)
  }

  async importFromExcel(buffer: Buffer, skipDuplicates: boolean): Promise<any> {
    const rows = await ImportService.parseExcel(buffer)
    const requiredFields = ['employee_id', 'full_name']
    
    return await ImportService.processImport(
      rows,
      requiredFields,
      async (row) => {
        await employeesRepository.create({
          employee_id: row.employee_id,
          full_name: row.full_name,
          job_position: row.job_position,
          branch_name: row.branch_name,
          parent_branch_name: row.parent_branch_name,
          email: row.email,
          mobile_phone: row.mobile_phone,
          nik: row.nik,
          birth_date: row.birth_date,
          birth_place: row.birth_place,
          age: row.age,
          gender: row.gender,
          religion: row.religion,
          marital_status: row.marital_status,
          citizen_id_address: row.citizen_id_address,
          join_date: row.join_date,
          resign_date: row.resign_date,
          sign_date: row.sign_date,
          end_date: row.end_date,
          status_employee: row.status_employee,
          is_active: row.active === 'true' || row.active === true || row.is_active === 'true' || row.is_active === true,
          ptkp_status: row.ptkp_status,
          bank_name: row.bank_name,
          bank_account: row.bank_account,
          bank_account_holder: row.bank_account_holder,
        })
      },
      skipDuplicates
    )
  }
}

export const employeesService = new EmployeesService()