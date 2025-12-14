import { companiesRepository } from './companies.repository'
import { Company, CreateCompanyDTO, UpdateCompanyDTO } from './companies.types'
import { PaginatedResponse, createPaginatedResponse } from '../../utils/pagination.util'
import { ExportService } from '../../services/export.service'
import { ImportService } from '../../services/import.service'
import { AuditService } from '../../services/audit.service'
import { validateEmail, validateUrl, validatePhone } from '../../utils/validation.util'

export class CompaniesService {
  private readonly VALID_TYPES = ['PT', 'CV', 'Firma', 'Koperasi', 'Yayasan']
  private readonly VALID_STATUSES = ['active', 'inactive', 'suspended', 'closed']

  async list(pagination: { page: number; limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: any): Promise<PaginatedResponse<Company>> {
    const { data, total } = await companiesRepository.findAll(pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async search(searchTerm: string, pagination: { page: number; limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: any): Promise<PaginatedResponse<Company>> {
    const { data, total } = await companiesRepository.search(searchTerm, pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async create(data: CreateCompanyDTO, userId?: string): Promise<Company> {
    this.validateCreateInput(data)
    
    const existingCode = await companiesRepository.findByCode(data.company_code)
    if (existingCode) {
      throw new Error('Company code already exists')
    }

    if (data.npwp) {
      const existingNpwp = await companiesRepository.findByNpwp(data.npwp)
      if (existingNpwp) {
        throw new Error('NPWP already exists')
      }
    }

    const company = await companiesRepository.create({
      ...data,
      company_type: data.company_type || 'PT',
      status: data.status || 'active'
    })

    if (!company) {
      throw new Error('Failed to create company')
    }

    await AuditService.log('CREATE', 'company', company.id, userId || null, null, company)
    return company
  }

  async getById(id: string): Promise<Company> {
    const company = await companiesRepository.findById(id)
    if (!company) {
      throw new Error('Company not found')
    }
    return company
  }

  async update(id: string, data: UpdateCompanyDTO, userId?: string): Promise<Company> {
    const existing = await companiesRepository.findById(id)
    if (!existing) {
      throw new Error('Company not found')
    }

    this.validateUpdateInput(data)

    if (data.npwp && data.npwp !== existing.npwp) {
      const existingNpwp = await companiesRepository.findByNpwp(data.npwp)
      if (existingNpwp) {
        throw new Error('NPWP already exists')
      }
    }

    const company = await companiesRepository.update(id, data)
    if (!company) {
      throw new Error('Failed to update company')
    }

    await AuditService.log('UPDATE', 'company', id, userId || null, existing, company)
    return company
  }

  async delete(id: string, userId?: string): Promise<void> {
    const company = await companiesRepository.findById(id)
    if (!company) {
      throw new Error('Company not found')
    }

    await companiesRepository.delete(id)
    await AuditService.log('DELETE', 'company', id, userId || null, company, null)
  }

  async bulkUpdateStatus(ids: string[], status: string, userId?: string): Promise<void> {
    if (!this.VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${this.VALID_STATUSES.join(', ')}`)
    }

    await companiesRepository.bulkUpdateStatus(ids, status)
  }

  async bulkDelete(ids: string[], userId?: string): Promise<void> {
    await companiesRepository.bulkDelete(ids)
  }

  async getFilterOptions() {
    return await companiesRepository.getFilterOptions()
  }

  async exportToExcel(filter?: any): Promise<Buffer> {
    const data = await companiesRepository.exportData(filter)
    const columns = [
      { header: 'Company Code', key: 'company_code', width: 15 },
      { header: 'Company Name', key: 'company_name', width: 30 },
      { header: 'Company Type', key: 'company_type', width: 15 },
      { header: 'NPWP', key: 'npwp', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Website', key: 'website', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created At', key: 'created_at', width: 20 },
      { header: 'Updated At', key: 'updated_at', width: 20 }
    ]
    return await ExportService.generateExcel(data, columns)
  }

  async previewImport(buffer: Buffer): Promise<any[]> {
    return await ImportService.parseExcel(buffer)
  }

  async importFromExcel(buffer: Buffer, skipDuplicates: boolean): Promise<any> {
    const rows = await ImportService.parseExcel(buffer)
    const requiredFields = ['company_code', 'company_name']
    
    return await ImportService.processImport(
      rows,
      requiredFields,
      async (row) => {
        if (skipDuplicates) {
          const existingCode = await companiesRepository.findByCode(row.company_code)
          if (existingCode) {
            throw new Error(`Duplicate company_code: ${row.company_code}`)
          }

          if (row.npwp) {
            const existingNpwp = await companiesRepository.findByNpwp(row.npwp)
            if (existingNpwp) {
              throw new Error(`Duplicate npwp: ${row.npwp}`)
            }
          }
        }

        await companiesRepository.create({
          company_code: row.company_code,
          company_name: row.company_name,
          company_type: row.company_type || 'PT',
          npwp: row.npwp || null,
          email: row.email || null,
          phone: row.phone || null,
          website: row.website || null,
          status: row.status || 'active'
        })
      },
      skipDuplicates
    )
  }

  private validateCreateInput(data: CreateCompanyDTO): void {
    if (!data.company_code || !data.company_code.trim()) {
      throw new Error('company_code is required')
    }

    if (!data.company_name || !data.company_name.trim()) {
      throw new Error('company_name is required')
    }

    if (data.company_type && !this.VALID_TYPES.includes(data.company_type)) {
      throw new Error(`Invalid company_type. Must be one of: ${this.VALID_TYPES.join(', ')}`)
    }

    if (data.status && !this.VALID_STATUSES.includes(data.status)) {
      throw new Error(`Invalid status. Must be one of: ${this.VALID_STATUSES.join(', ')}`)
    }

    if (data.email && !validateEmail(data.email)) {
      throw new Error('Invalid email format')
    }

    if (data.website && !validateUrl(data.website)) {
      throw new Error('Invalid website URL format')
    }

    if (data.phone && !validatePhone(data.phone)) {
      throw new Error('Invalid phone format')
    }
  }

  private validateUpdateInput(data: UpdateCompanyDTO): void {
    if (data.company_type && !this.VALID_TYPES.includes(data.company_type)) {
      throw new Error(`Invalid company_type. Must be one of: ${this.VALID_TYPES.join(', ')}`)
    }

    if (data.status && !this.VALID_STATUSES.includes(data.status)) {
      throw new Error(`Invalid status. Must be one of: ${this.VALID_STATUSES.join(', ')}`)
    }

    if (data.email && !validateEmail(data.email)) {
      throw new Error('Invalid email format')
    }

    if (data.website && !validateUrl(data.website)) {
      throw new Error('Invalid website URL format')
    }

    if (data.phone && !validatePhone(data.phone)) {
      throw new Error('Invalid phone format')
    }
  }
}

export const companiesService = new CompaniesService()
