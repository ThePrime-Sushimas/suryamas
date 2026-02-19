import { companiesRepository, CompaniesRepository } from './companies.repository'
import { Company, CreateCompanyDTO, UpdateCompanyDTO } from './companies.types'
import { PaginatedResponse, createPaginatedResponse } from '../../utils/pagination.util'
import { ExportService } from '../../services/export.service'
import { ImportService } from '../../services/import.service'
import { AuditService } from '../monitoring/monitoring.service'
import { CompanyErrors } from './companies.errors'
import { CompanyConfig } from './companies.config'
import { logInfo, logError } from '../../config/logger'

export class CompaniesService {
  constructor(private repository: CompaniesRepository = companiesRepository) {}

  async list(pagination: { page: number; limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: any): Promise<PaginatedResponse<Company>> {
    const { data, total } = await companiesRepository.findAll(pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async search(searchTerm: string, pagination: { page: number; limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: any): Promise<PaginatedResponse<Company>> {
    const { data, total } = await companiesRepository.search(searchTerm, pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async create(data: CreateCompanyDTO, userId: string): Promise<Company> {
    logInfo('Creating company', { company_code: data.company_code, user: userId })
    
    try {
      const trimmedData = {
        ...data,
        company_code: data.company_code.trim(),
        company_name: data.company_name.trim(),
        company_type: data.company_type || 'PT',
        status: data.status || 'active'
      }

      const company = await this.repository.create(trimmedData)

      if (!company) {
        throw CompanyErrors.CREATE_FAILED()
      }

      await AuditService.log('CREATE', 'company', company.id, userId, null, company)
      logInfo('Company created successfully', { company_id: company.id })
      return company
    } catch (error: any) {
      if (error.code === '23505') {
        if (error.message?.includes('company_code') || error.constraint?.includes('company_code')) {
          logError('Duplicate company code', { company_code: data.company_code })
          throw CompanyErrors.CODE_EXISTS(data.company_code)
        }
        if (error.message?.includes('npwp') || error.constraint?.includes('npwp')) {
          logError('Duplicate NPWP', { npwp: data.npwp })
          throw CompanyErrors.NPWP_EXISTS(data.npwp)
        }
      }
      logError('Failed to create company', { error: error.message, user: userId })
      throw error
    }
  }

  async getById(id: string): Promise<Company> {
    const company = await this.repository.findById(id)
    if (!company) {
      throw CompanyErrors.NOT_FOUND()
    }
    return company
  }

  async update(id: string, data: UpdateCompanyDTO, userId: string): Promise<Company> {
    logInfo('Updating company', { company_id: id, user: userId })
    
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw CompanyErrors.NOT_FOUND()
    }

    try {
      const trimmedData = {
        ...data,
        ...(data.company_name && { company_name: data.company_name.trim() })
      }

      const company = await this.repository.update(id, trimmedData)
      if (!company) {
        throw CompanyErrors.UPDATE_FAILED()
      }

      await AuditService.log('UPDATE', 'company', id, userId, existing, company)
      logInfo('Company updated successfully', { company_id: id })
      return company
    } catch (error: any) {
      if (error.code === '23505') {
        if (error.message?.includes('npwp') || error.constraint?.includes('npwp')) {
          logError('Duplicate NPWP on update', { npwp: data.npwp })
          throw CompanyErrors.NPWP_EXISTS()
        }
      }
      logError('Failed to update company', { error: error.message, company_id: id })
      throw error
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    logInfo('Deleting company', { company_id: id, user: userId })
    
    const company = await this.repository.findById(id)
    if (!company) {
      throw CompanyErrors.NOT_FOUND()
    }

    await this.repository.delete(id)
    await AuditService.log('DELETE', 'company', id, userId, company, null)
    logInfo('Company deleted successfully', { company_id: id })
  }

  async bulkUpdateStatus(ids: string[], status: string, userId: string): Promise<void> {
    logInfo('Bulk updating company status', { count: ids.length, status, user: userId })
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const invalidIds = ids.filter(id => !uuidRegex.test(id))
    if (invalidIds.length > 0) {
      throw new Error(`Invalid UUID format: ${invalidIds.join(', ')}`)
    }

    if (!CompanyConfig.STATUSES.includes(status as any)) {
      throw new Error(`Invalid status: ${status}. Valid statuses: ${CompanyConfig.STATUSES.join(', ')}`)
    }

    await this.repository.bulkUpdateStatus(ids, status)
    await AuditService.log('BULK_UPDATE_STATUS', 'company', ids.join(','), userId, null, { status })
    logInfo('Bulk status update completed', { count: ids.length })
  }

  async bulkDelete(ids: string[], userId: string): Promise<void> {
    logInfo('Bulk deleting companies', { count: ids.length, user: userId })
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const invalidIds = ids.filter(id => !uuidRegex.test(id))
    if (invalidIds.length > 0) {
      throw new Error(`Invalid UUID format: ${invalidIds.join(', ')}`)
    }

    await this.repository.bulkDelete(ids)
    await AuditService.log('BULK_DELETE', 'company', ids.join(','), userId, null, null)
    logInfo('Bulk delete completed', { count: ids.length })
  }

  async getFilterOptions() {
    return await this.repository.getFilterOptions()
  }

  async exportToExcel(filter?: any): Promise<Buffer> {
    logInfo('Exporting companies to Excel', { filter })
    const data = await this.repository.exportData(filter, CompanyConfig.EXPORT.MAX_ROWS)
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
    logInfo('Importing companies from Excel', { skipDuplicates })
    const rows = await ImportService.parseExcel(buffer)
    const requiredFields = ['company_code', 'company_name']
    
    return await ImportService.processImport(
      rows,
      requiredFields,
      async (row) => {
        if (skipDuplicates) {
          const existingCode = await this.repository.findByCode(row.company_code)
          if (existingCode) {
            throw new Error(`Duplicate company_code: ${row.company_code}`)
          }

          if (row.npwp) {
            const existingNpwp = await this.repository.findByNpwp(row.npwp)
            if (existingNpwp) {
              throw new Error(`Duplicate npwp: ${row.npwp}`)
            }
          }
        }

        await this.repository.create({
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

}

export const companiesService = new CompaniesService()
