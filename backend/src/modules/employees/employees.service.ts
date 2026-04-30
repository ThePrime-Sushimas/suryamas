import { employeesRepository } from './employees.repository'
import { EmployeeResponse, EmployeeCreatePayload, EmployeeUpdatePayload, EmployeeProfileUpdatePayload, EmployeeFilter, PaginationParams, EmployeeDB, EmployeeWithBranch } from './employees.types'
import { PaginatedResponse, createPaginatedResponse } from '../../utils/pagination.util'
import { ExportService } from '../../services/export.service'
import { ImportService } from '../../services/import.service'
import { AuditService } from '../monitoring/monitoring.service'
import { calculateAge, calculateYearsOfService } from '../../utils/age.util'
import { EmployeeErrors } from './employees.errors'

export class EmployeesService {
  async list(params: PaginationParams): Promise<PaginatedResponse<EmployeeResponse>> {
    const { data, total } = await employeesRepository.findAll(params)
    return createPaginatedResponse(this.enrichWithComputed(data), total, params.page, params.limit)
  }

  async getUnassigned(params: { page: number; limit: number }): Promise<PaginatedResponse<EmployeeResponse>> {
    const { data, total } = await employeesRepository.findUnassigned(params)
    return createPaginatedResponse(this.enrichWithComputed(data), total, params.page, params.limit)
  }

  async create(payload: EmployeeCreatePayload, file?: Express.Multer.File, userId?: string): Promise<EmployeeResponse> {
    const profilePictureUrl = file ? await this.uploadFile(file) : null
    const employeeId = payload.employee_id || await this.generateEmployeeId(payload)
    
    const employee = await employeesRepository.create({
      ...payload,
      employee_id: employeeId,
      profile_picture: profilePictureUrl
    })

    await AuditService.log('CREATE', 'employee', employee.id, userId || null, null, employee)

    const fullEmployee = await employeesRepository.findById(employee.id)
    if (!fullEmployee) throw EmployeeErrors.NOT_FOUND(employee.id)
    
    return this.enrichWithComputed([fullEmployee])[0]
  }

  async search(searchTerm: string, params: PaginationParams, filter?: EmployeeFilter): Promise<PaginatedResponse<EmployeeResponse>> {
    const { data, total } = await employeesRepository.search(searchTerm, params, filter)
    return createPaginatedResponse(this.enrichWithComputed(data), total, params.page, params.limit)
  }

  async getFilterOptions() {
    return await employeesRepository.getFilterOptions()
  }

  async autocomplete(query: string): Promise<{ id: string; full_name: string }[]> {
    return await employeesRepository.autocomplete(query)
  }

  async getProfile(userId: string): Promise<EmployeeResponse> {
    const employee = await employeesRepository.findByUserId(userId)
    if (!employee) throw EmployeeErrors.PROFILE_NOT_FOUND()
    return this.enrichWithComputed([employee])[0]
  }

  async updateProfile(userId: string, payload: EmployeeProfileUpdatePayload): Promise<EmployeeResponse> {
    const cleanedUpdates = this.cleanEmptyStrings(payload as unknown as Record<string, unknown>)
    if (Object.keys(cleanedUpdates).length === 0) throw EmployeeErrors.NO_CHANGES()

    const employee = await employeesRepository.update(userId, cleanedUpdates)
    const fullEmployee = await employeesRepository.findByUserId(userId)
    if (!fullEmployee) throw EmployeeErrors.PROFILE_NOT_FOUND()
    
    return this.enrichWithComputed([fullEmployee])[0]
  }

  async uploadProfilePicture(userId: string, file: Express.Multer.File): Promise<string> {
    const publicUrl = await this.uploadFile(file, userId)
    await employeesRepository.update(userId, { profile_picture: publicUrl })
    return publicUrl
  }

  async getById(id: string): Promise<EmployeeResponse> {
    const employee = await employeesRepository.findById(id)
    if (!employee) throw EmployeeErrors.NOT_FOUND(id)
    return this.enrichWithComputed([employee])[0]
  }

  async update(id: string, payload: EmployeeUpdatePayload, file?: Express.Multer.File, userId?: string): Promise<EmployeeResponse> {
    const cleanedUpdates = this.cleanEmptyStrings(payload as unknown as Record<string, unknown>)
    
    if (file) {
      const profilePictureUrl = await this.uploadFile(file, id)
      cleanedUpdates.profile_picture = profilePictureUrl
    }
    
    if (Object.keys(cleanedUpdates).length === 0) throw EmployeeErrors.NO_CHANGES()

    const oldEmployee = await employeesRepository.findById(id)
    const employee = await employeesRepository.updateById(id, cleanedUpdates)

    await AuditService.log('UPDATE', 'employee', id, userId || null, oldEmployee, employee)

    const fullEmployee = await employeesRepository.findById(id)
    if (!fullEmployee) throw EmployeeErrors.NOT_FOUND(id)
    
    return this.enrichWithComputed([fullEmployee])[0]
  }

  async delete(id: string, userId?: string): Promise<void> {
    const employee = await employeesRepository.findById(id)
    await employeesRepository.delete(id)
    if (employee) {
      await AuditService.log('DELETE', 'employee', id, userId || null, employee, null)
    }
  }

  async restore(id: string, userId?: string): Promise<void> {
    await employeesRepository.restore(id)
    const employee = await employeesRepository.findById(id)
    if (employee) {
      await AuditService.log('RESTORE', 'employee', id, userId || null, null, employee)
    }
  }

  async bulkUpdateActive(ids: string[], isActive: boolean): Promise<void> {
    if (ids.length === 0) throw EmployeeErrors.NO_SELECTION()
    await employeesRepository.bulkUpdateActive(ids, isActive)
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) throw EmployeeErrors.NO_SELECTION()
    await employeesRepository.bulkDelete(ids)
  }

  async bulkRestore(ids: string[]): Promise<void> {
    if (ids.length === 0) throw EmployeeErrors.NO_SELECTION()
    await employeesRepository.bulkRestore(ids)
  }

  async exportToExcel(filter?: EmployeeFilter): Promise<Buffer> {
    const data = await employeesRepository.exportData(filter)
    const enriched = this.enrichWithComputed(data).map(emp => ({
      ...emp,
      years_of_service: emp.years_of_service ? `${emp.years_of_service.years}y ${emp.years_of_service.months}m ${emp.years_of_service.days}d` : null
    }))
    
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
    return await ExportService.generateExcel(enriched, columns)
  }

  async previewImport(buffer: Buffer): Promise<Record<string, unknown>[]> {
    return await ImportService.parseExcel(buffer)
  }

  async importFromExcel(buffer: Buffer, skipDuplicates: boolean) {
    const rows = await ImportService.parseExcel(buffer)
    const requiredFields = ['full_name', 'brand_name', 'join_date', 'job_position']
    
    return await ImportService.processImport(
      rows,
      requiredFields,
      async (row) => {
        let employeeId = row.employee_id
        if (!employeeId && row.brand_name && row.join_date && row.job_position) {
          employeeId = await this.generateEmployeeId({
            brand_name: row.brand_name as string,
            join_date: row.join_date as string,
            job_position: row.job_position as string,
          })
        }
        
        await employeesRepository.create({
          employee_id: employeeId,
          full_name: row.full_name as string,
          job_position: row.job_position as string,
          brand_name: row.brand_name as string,
          email: row.email as string,
          mobile_phone: row.mobile_phone as string,
          nik: row.nik as string,
          birth_date: row.birth_date as string,
          birth_place: row.birth_place as string,
          gender: row.gender as string,
          religion: row.religion as string,
          marital_status: row.marital_status as string,
          citizen_id_address: row.citizen_id_address as string,
          join_date: row.join_date as string,
          resign_date: row.resign_date as string,
          sign_date: row.sign_date as string,
          end_date: row.end_date as string,
          status_employee: row.status_employee as string,
          is_active: row.active === 'true' || row.active === true || row.is_active === 'true' || row.is_active === true,
          ptkp_status: row.ptkp_status as string,
          bank_name: row.bank_name as string,
          bank_account: row.bank_account as string,
          bank_account_holder: row.bank_account_holder as string,
        } as Partial<EmployeeDB>)
      },
      skipDuplicates
    )
  }

  private async generateEmployeeId(payload: Pick<EmployeeCreatePayload, 'brand_name' | 'join_date' | 'job_position'>): Promise<string> {
    return employeesRepository.generateEmployeeId(payload.brand_name, payload.join_date, payload.job_position)
  }

  private async uploadFile(file: Express.Multer.File, prefix?: string): Promise<string> {
    const fileName = `${prefix || Date.now()}-${Date.now()}.${file.mimetype.split('/')[1]}`
    await employeesRepository.uploadFile(fileName, file.buffer, file.mimetype)
    return employeesRepository.getPublicUrl(fileName)
  }

  private enrichWithComputed(data: EmployeeWithBranch[]): EmployeeResponse[] {
    return data.map(emp => ({
      ...emp,
      age: calculateAge(emp.birth_date),
      years_of_service: calculateYearsOfService(emp.join_date, emp.resign_date)
    }))
  }

  private cleanEmptyStrings(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(obj)
        .map(([key, value]) => {
          if (value === '' && ['resign_date', 'end_date', 'sign_date', 'birth_date'].includes(key)) {
            return [key, null]
          }
          return [key, value]
        })
        .filter(([_, value]) => value !== '')
    )
  }
}

export const employeesService = new EmployeesService()
