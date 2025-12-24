import { employeesRepository } from './employees.repository'
import { Employee } from './employees.types'
import { PaginatedResponse, createPaginatedResponse } from '../../utils/pagination.util'
import { ExportService } from '../../services/export.service'
import { ImportService } from '../../services/import.service'
import { AuditService } from '../../services/audit.service'
import { calculateAge, calculateYearsOfService } from '../../utils/age.util'
import { generateEmployeeId, getNextSequenceNumber } from '../../utils/employeeId.util'

export class EmployeesService {
  async list(pagination: { page: number; limit: number }): Promise<PaginatedResponse<Employee>> {
    const { data, total } = await employeesRepository.findAll(pagination)
    const dataWithAge = data.map(emp => ({ ...emp, age: calculateAge(emp.birth_date), years_of_service: calculateYearsOfService(emp.join_date, emp.resign_date) }))
    return createPaginatedResponse(dataWithAge, total, pagination.page, pagination.limit)
  }

  async getUnassigned(pagination: { page: number; limit: number }): Promise<PaginatedResponse<Employee>> {
    const { data, total } = await employeesRepository.findUnassigned(pagination)
    const dataWithAge = data.map(emp => ({ ...emp, age: calculateAge(emp.birth_date), years_of_service: calculateYearsOfService(emp.join_date, emp.resign_date) }))
    return createPaginatedResponse(dataWithAge, total, pagination.page, pagination.limit)
  }

  async create(data: Partial<Employee>, file?: Express.Multer.File, userId?: string): Promise<Employee> {
    let profilePictureUrl: string | null = null
    
    if (file) {
      const fileName = `${Date.now()}-${file.originalname}`
      try {
        await employeesRepository.uploadFile(fileName, file.buffer, file.mimetype)
        profilePictureUrl = employeesRepository.getPublicUrl(fileName)
      } catch (err) {
        // Continue without profile picture if upload fails
      }
    }
    
    // Auto-generate employee_id if not provided
    let employeeId = data.employee_id
    if (!employeeId && data.brand_name && data.join_date && data.job_position) {
      const lastEmployeeId = await employeesRepository.getLastEmployeeId()
      const nextSequence = getNextSequenceNumber(lastEmployeeId)
      employeeId = generateEmployeeId(
        data.brand_name,
        data.join_date,
        data.job_position,
        nextSequence
      )
    }
    
    const employee = await employeesRepository.create({
      ...data,
      employee_id: employeeId,
      profile_picture: profilePictureUrl
    })
    
    if (!employee) {
      throw new Error('Failed to create employee')
    }

    await AuditService.log(
      'CREATE',
      'employee',
      employee.id,
      userId || null,
      null,
      employee
    )

    return employee
  }

  async search(searchTerm: string, pagination: { page: number; limit: number }, filter?: any): Promise<PaginatedResponse<Employee>> {
    const { data, total } = await employeesRepository.searchByName(searchTerm, pagination)
    const dataWithAge = data.map(emp => ({ ...emp, age: calculateAge(emp.birth_date), years_of_service: calculateYearsOfService(emp.join_date, emp.resign_date) }))
    return createPaginatedResponse(dataWithAge, total, pagination.page, pagination.limit)
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

    return { ...employee, age: calculateAge(employee.birth_date), years_of_service: calculateYearsOfService(employee.join_date, employee.resign_date) }
  }

  async updateProfile(userId: string, updates: Partial<Employee>): Promise<Employee> {
    const { id, employee_id, user_id, created_at, ...allowedUpdates } = updates as any

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

    return { ...employee, age: calculateAge(employee.birth_date), years_of_service: calculateYearsOfService(employee.join_date, employee.resign_date) }
  }

  async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string> {
    const fileName = `${userId}-${Date.now()}.${file.mimetype.split('/')[1]}`
    await employeesRepository.uploadFile(fileName, file.buffer, file.mimetype)
    
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

    return { ...employee, age: calculateAge(employee.birth_date), years_of_service: calculateYearsOfService(employee.join_date, employee.resign_date) }
  }

  async update(id: string, data: Partial<Employee>, file?: Express.Multer.File, userId?: string): Promise<Employee> {
    const { id: _, user_id, created_at, employee_id, ...allowedUpdates } = data as any
    
    let profilePictureUrl: string | null = null
    if (file) {
      const fileName = `${id}-${Date.now()}.${file.mimetype.split('/')[1]}`
      try {
        await employeesRepository.uploadFile(fileName, file.buffer, file.mimetype)
        profilePictureUrl = employeesRepository.getPublicUrl(fileName)
        allowedUpdates.profile_picture = profilePictureUrl
      } catch (err) {
        // Continue without profile picture if upload fails
      }
    }
    
    const cleanedUpdates = Object.fromEntries(
      Object.entries(allowedUpdates).map(([key, value]) => {
        if (value === '' && (key === 'resign_date' || key === 'end_date' || key === 'sign_date')) {
          return [key, null]
        }
        return [key, value]
      }).filter(([_, value]) => value !== '')
    )

    if (Object.keys(cleanedUpdates).length === 0 && !file) {
      throw new Error('No valid fields to update')
    }

    const oldEmployee = await employeesRepository.findById(id)
    const employee = await employeesRepository.updateById(id, cleanedUpdates)
    
    if (!employee) {
      throw new Error('Failed to update employee')
    }

    await AuditService.log(
      'UPDATE',
      'employee',
      id,
      userId || null,
      oldEmployee,
      employee
    )

    return employee
  }

  async delete(id: string, userId?: string): Promise<void> {
    const employee = await employeesRepository.findById(id)
    await employeesRepository.delete(id)

    if (employee) {
      await AuditService.log(
        'DELETE',
        'employee',
        id,
        userId || null,
        employee,
        null
      )
    }
  }

  async bulkUpdateActive(ids: string[], isActive: boolean): Promise<void> {
    await employeesRepository.bulkUpdateActive(ids, isActive)
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await employeesRepository.bulkDelete(ids)
  }

  async exportToExcel(filter?: any): Promise<Buffer> {
    const data = await employeesRepository.exportData(filter)
    const dataWithAge = data.map(emp => {
      const yos = calculateYearsOfService(emp.join_date, emp.resign_date)
      return {
        ...emp,
        age: calculateAge(emp.birth_date),
        years_of_service: yos ? `${yos.years}y ${yos.months}m ${yos.days}d` : null
      }
    })
    const columns = [
      { header: 'Employee ID', key: 'employee_id', width: 15 },
      { header: 'Full Name', key: 'full_name', width: 25 },
      { header: 'Job Position', key: 'job_position', width: 20 },
      { header: 'Branch Name', key: 'branch_name', width: 20 },
      { header: 'Brand Name', key: 'brand_name', width: 20 },
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
      { header: 'Years of Service', key: 'years_of_service', width: 15 },
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
    return await ExportService.generateExcel(dataWithAge, columns)
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
          brand_name: row.brand_name,
          email: row.email,
          mobile_phone: row.mobile_phone,
          nik: row.nik,
          birth_date: row.birth_date,
          birth_place: row.birth_place,
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