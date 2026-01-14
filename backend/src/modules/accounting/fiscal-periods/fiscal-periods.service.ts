import { fiscalPeriodsRepository, FiscalPeriodsRepository } from './fiscal-periods.repository'
import { FiscalPeriod, CreateFiscalPeriodDto, UpdateFiscalPeriodDto, FiscalPeriodFilter, SortParams } from './fiscal-periods.types'
import { PaginatedResponse, createPaginatedResponse } from '../../../utils/pagination.util'
import { ExportService } from '../../../services/export.service'
import { AuditService } from '../../../services/audit.service'
import { FiscalPeriodErrors } from './fiscal-periods.errors'
import { PERIOD_FORMAT_REGEX } from './fiscal-periods.constants'
import { FiscalPeriodsConfig, defaultConfig } from './fiscal-periods.config'
import { logInfo, logError, logWarn } from '../../../config/logger'

export interface IAuditService {
  log(action: string, entity: string, entityId: string, userId: string, oldData?: any, newData?: any): Promise<void>
}

export interface IExportService {
  generateExcel(data: any[], columns: any[]): Promise<Buffer>
}

export class FiscalPeriodsService {
  private readonly config: FiscalPeriodsConfig

  constructor(
    private repository: FiscalPeriodsRepository = fiscalPeriodsRepository,
    private auditService: IAuditService = AuditService,
    private exportService: IExportService = ExportService,
    config: FiscalPeriodsConfig = defaultConfig
  ) {
    this.config = config
  }

  private sanitizeInput(input: string): string {
    if (!input) return ''
    return input.trim()
  }

  private validateCompanyAccess(companyId: string): void {
    if (!companyId?.trim()) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('company_id', 'Company ID is required')
    }
  }

  private validateUUIDs(ids: string[]): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const invalidIds = ids.filter(id => !id?.trim() || !uuidRegex.test(id.trim()))
    if (invalidIds.length > 0) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('ids', `Invalid UUID format: ${invalidIds.join(', ')}`)
    }
  }

  private validatePeriodFormat(period: string): void {
    if (!PERIOD_FORMAT_REGEX.test(period)) {
      throw FiscalPeriodErrors.INVALID_PERIOD_FORMAT()
    }
  }

  private validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('period_date', 'Invalid date format')
    }

    if (start > end) {
      throw FiscalPeriodErrors.INVALID_DATE_RANGE()
    }
  }

  /**
   * Validates that new period does not overlap with existing periods
   * Critical accounting rule: periods must not have overlapping date ranges
   */
  private async validateNoDateOverlap(
    companyId: string,
    periodStart: string,
    periodEnd: string,
    excludePeriodId?: string
  ): Promise<void> {
    const { data: allPeriods } = await this.repository.findAll(
      companyId,
      { limit: 1000, offset: 0 },
      undefined,
      { show_deleted: false }
    )

    const start = new Date(periodStart)
    const end = new Date(periodEnd)

    for (const existing of allPeriods) {
      if (excludePeriodId && existing.id === excludePeriodId) continue

      const existingStart = new Date(existing.period_start)
      const existingEnd = new Date(existing.period_end)

      // Check for any overlap: (start <= existingEnd) AND (end >= existingStart)
      if (start <= existingEnd && end >= existingStart) {
        throw FiscalPeriodErrors.VALIDATION_ERROR(
          'period_overlap',
          `Period dates overlap with existing period ${existing.period} (${existing.period_start} to ${existing.period_end})`
        )
      }
    }
  }

  /**
   * Validates year-end period rules
   * - Must be December (month 12)
   * - Only one year-end per fiscal year
   */
  private async validateYearEndRules(
    companyId: string,
    period: string,
    isYearEnd: boolean,
    excludePeriodId?: string
  ): Promise<void> {
    if (!isYearEnd) return

    // Extract month from period (YYYY-MM)
    const month = parseInt(period.substring(5, 7))
    if (month !== 12) {
      throw FiscalPeriodErrors.VALIDATION_ERROR(
        'year_end_month',
        'Year-end period must be December (month 12)'
      )
    }

    // Check if year-end already exists for this fiscal year
    const fiscalYear = parseInt(period.substring(0, 4))
    const { data: existingPeriods } = await this.repository.findAll(
      companyId,
      { limit: 100, offset: 0 },
      undefined,
      { fiscal_year: fiscalYear, show_deleted: false }
    )

    const existingYearEnd = existingPeriods.find(
      p => p.is_year_end && (!excludePeriodId || p.id !== excludePeriodId)
    )

    if (existingYearEnd) {
      throw FiscalPeriodErrors.VALIDATION_ERROR(
        'year_end_exists',
        `Year-end period already exists for fiscal year ${fiscalYear}: ${existingYearEnd.period}`
      )
    }
  }

  private validateFilter(filter: any): FiscalPeriodFilter {
    if (!filter) return {}
    
    const validatedFilter: FiscalPeriodFilter = {}
    
    if (filter.fiscal_year !== undefined && typeof filter.fiscal_year === 'number') {
      validatedFilter.fiscal_year = filter.fiscal_year
    }
    
    if (filter.is_open !== undefined && typeof filter.is_open === 'boolean') {
      validatedFilter.is_open = filter.is_open
    }
    
    if (filter.period && typeof filter.period === 'string') {
      validatedFilter.period = filter.period.trim()
    }
    
    if (filter.show_deleted !== undefined && typeof filter.show_deleted === 'boolean') {
      validatedFilter.show_deleted = filter.show_deleted
    }
    
    if (filter.q && typeof filter.q === 'string' && filter.q.trim().length > 0) {
      const sanitized = filter.q.trim().replace(/[%_\\]/g, '\\$&')
      if (sanitized.length <= 100) {
        validatedFilter.q = sanitized
      }
    }
    
    return validatedFilter
  }

  private validateSort(sort: any): SortParams | undefined {
    if (!sort) return undefined
    
    const validFields = ['period', 'fiscal_year', 'is_open', 'created_at', 'updated_at']
    
    if (sort.field && validFields.includes(sort.field) && 
        sort.order && ['asc', 'desc'].includes(sort.order)) {
      return { field: sort.field, order: sort.order }
    }
    
    return undefined
  }

  async list(
    companyId: string,
    pagination: { page: number; limit: number; offset: number },
    sort?: SortParams,
    filter?: any,
    correlationId?: string
  ): Promise<PaginatedResponse<FiscalPeriod>> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      if (pagination.limit > this.config.limits.pageSize) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('limit', `Page size cannot exceed ${this.config.limits.pageSize}`)
      }
      
      const validatedFilter = this.validateFilter(filter)
      const validatedSort = this.validateSort(sort)
      
      logInfo('Service list started', { 
        correlation_id: correlationId,
        company_id: companyId,
        pagination,
        sort: validatedSort,
        filter: validatedFilter
      })
      
      const { data, total } = await this.repository.findAll(companyId, pagination, validatedSort, validatedFilter)
      const result = createPaginatedResponse(data, total, pagination.page, pagination.limit)
      
      logInfo('Service list completed', { 
        correlation_id: correlationId,
        company_id: companyId,
        total_records: total,
        returned_records: data.length
      })
      
      return result
    } catch (error) {
      logError('Service list failed', { 
        correlation_id: correlationId,
        company_id: companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async create(data: CreateFiscalPeriodDto & { company_id: string }, userId: string, correlationId?: string): Promise<FiscalPeriod> {
    
    try {
      this.validateCompanyAccess(data.company_id)
      
      if (!userId?.trim()) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('userId', 'User ID is required')
      }
      
      logInfo('Service create started', { 
        correlation_id: correlationId,
        period: data.period, 
        company_id: data.company_id,
        user_id: userId 
      })
      
      const sanitizedData: CreateFiscalPeriodDto = {
        ...data,
        period: this.sanitizeInput(data.period),
        period_start: this.sanitizeInput(data.period_start),
        period_end: this.sanitizeInput(data.period_end),
        is_adjustment_allowed: data.is_adjustment_allowed !== undefined ? data.is_adjustment_allowed : true,
        is_year_end: data.is_year_end !== undefined ? data.is_year_end : false
      }
      
      this.validatePeriodFormat(sanitizedData.period)
      this.validateDateRange(sanitizedData.period_start, sanitizedData.period_end)
      
      const existingPeriod = await this.repository.findByCompanyAndPeriod(data.company_id, sanitizedData.period)
      if (existingPeriod) {
        throw FiscalPeriodErrors.PERIOD_EXISTS(sanitizedData.period, data.company_id)
      }
      
      // Validate no date overlap with existing periods
      await this.validateNoDateOverlap(
        data.company_id,
        sanitizedData.period_start,
        sanitizedData.period_end
      )
      
      // Validate year-end rules if applicable
      await this.validateYearEndRules(
        data.company_id,
        sanitizedData.period,
        sanitizedData.is_year_end || false
      )
      
      const period = await this.repository.create({ ...sanitizedData, company_id: data.company_id }, userId)
      
      try {
        await this.auditService.log('CREATE', 'fiscal_period', period.id, userId, null, period)
      } catch (auditError) {
        logWarn('Audit logging failed for create operation', {
          correlation_id: correlationId,
          period_id: period.id,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service create completed', { 
        correlation_id: correlationId,
        period_id: period.id,
        period: period.period
      })
      
      return period
    } catch (error) {
      logError('Service create failed', { 
        correlation_id: correlationId,
        period: data.period,
        company_id: data.company_id,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async getById(id: string, companyId: string, correlationId?: string): Promise<FiscalPeriod> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      if (!id?.trim()) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('id', 'Period ID is required')
      }
      
      logInfo('Service getById started', { 
        correlation_id: correlationId,
        period_id: id,
        company_id: companyId
      })
      
      const period = await this.repository.findById(id.trim(), companyId)
      if (!period) {
        throw FiscalPeriodErrors.NOT_FOUND(id)
      }
      
      logInfo('Service getById completed', { 
        correlation_id: correlationId,
        period_id: id,
        period: period.period
      })
      
      return period
    } catch (error) {
      logError('Service getById failed', { 
        correlation_id: correlationId,
        period_id: id,
        company_id: companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async update(id: string, data: UpdateFiscalPeriodDto, userId: string, companyId: string, correlationId?: string): Promise<FiscalPeriod> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      if (!id?.trim() || !userId?.trim()) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('required_fields', 'Period ID and User ID are required')
      }
      
      logInfo('Service update started', { 
        correlation_id: correlationId,
        period_id: id, 
        user_id: userId,
        company_id: companyId
      })
      
      const existing = await this.repository.findById(id.trim(), companyId)
      if (!existing) {
        throw FiscalPeriodErrors.NOT_FOUND(id)
      }
      
      if (!existing.is_open) {
        throw FiscalPeriodErrors.PERIOD_ALREADY_CLOSED()
      }
      
      const sanitizedData: UpdateFiscalPeriodDto = {
        ...(data.is_adjustment_allowed !== undefined && { is_adjustment_allowed: data.is_adjustment_allowed })
      }
      
      const period = await this.repository.update(id.trim(), companyId, {
        ...sanitizedData,
        updated_by: userId
      })
      if (!period) {
        throw FiscalPeriodErrors.NOT_FOUND(id)
      }
      
      try {
        await this.auditService.log('UPDATE', 'fiscal_period', id, userId, existing, period)
      } catch (auditError) {
        logWarn('Audit logging failed for update operation', {
          correlation_id: correlationId,
          period_id: id,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service update completed', { 
        correlation_id: correlationId,
        period_id: id,
        period: period.period
      })
      
      return period
    } catch (error) {
      logError('Service update failed', { 
        correlation_id: correlationId,
        period_id: id,
        company_id: companyId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async closePeriod(id: string, userId: string, companyId: string, reason?: string, correlationId?: string): Promise<FiscalPeriod> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      if (!id?.trim() || !userId?.trim()) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('required_fields', 'Period ID and User ID are required')
      }
      
      logInfo('Service closePeriod started', { 
        correlation_id: correlationId,
        period_id: id, 
        user_id: userId,
        company_id: companyId
      })
      
      const existing = await this.repository.findById(id.trim(), companyId)
      if (!existing) {
        throw FiscalPeriodErrors.NOT_FOUND(id)
      }
      
      if (!existing.is_open) {
        throw FiscalPeriodErrors.PERIOD_ALREADY_CLOSED()
      }
      
      const period = await this.repository.closePeriod(id.trim(), companyId, userId, reason)
      if (!period) {
        throw FiscalPeriodErrors.NOT_FOUND(id)
      }
      
      try {
        await this.auditService.log('CLOSE', 'fiscal_period', id, userId, existing, period)
      } catch (auditError) {
        logWarn('Audit logging failed for close operation', {
          correlation_id: correlationId,
          period_id: id,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service closePeriod completed', { 
        correlation_id: correlationId,
        period_id: id,
        period: period.period
      })
      
      return period
    } catch (error) {
      logError('Service closePeriod failed', { 
        correlation_id: correlationId,
        period_id: id,
        company_id: companyId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async delete(id: string, userId: string, companyId: string, correlationId?: string): Promise<void> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      if (!id?.trim() || !userId?.trim()) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('required_fields', 'Period ID and User ID are required')
      }
      
      logInfo('Service delete started', { 
        correlation_id: correlationId,
        period_id: id, 
        user_id: userId,
        company_id: companyId
      })
      
      const period = await this.repository.findById(id.trim(), companyId)
      if (!period) {
        throw FiscalPeriodErrors.NOT_FOUND(id)
      }
      
      if (!period.is_open) {
        throw FiscalPeriodErrors.PERIOD_ALREADY_CLOSED()
      }
      
      await this.repository.softDelete(id.trim(), companyId, userId)
      
      try {
        await this.auditService.log('DELETE', 'fiscal_period', id, userId, period, null)
      } catch (auditError) {
        logWarn('Audit logging failed for delete operation', {
          correlation_id: correlationId,
          period_id: id,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service delete completed', { 
        correlation_id: correlationId,
        period_id: id,
        period: period.period
      })
    } catch (error) {
      logError('Service delete failed', { 
        correlation_id: correlationId,
        period_id: id,
        company_id: companyId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async bulkDelete(ids: string[], userId: string, companyId: string, correlationId?: string): Promise<void> {
    
    try {
      this.validateCompanyAccess(companyId)
      this.validateUUIDs(ids)
      
      if (!userId?.trim()) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('userId', 'User ID is required')
      }
      
      if (ids.length > this.config.limits.bulkDelete) {
        throw FiscalPeriodErrors.BULK_OPERATION_LIMIT_EXCEEDED('delete', this.config.limits.bulkDelete, ids.length)
      }
      
      logInfo('Service bulkDelete started', { 
        correlation_id: correlationId,
        count: ids.length, 
        user_id: userId,
        company_id: companyId
      })
      
      const periods = await this.repository.findByIds(companyId, ids.map(id => id.trim()))
      
      if (periods.length !== ids.length) {
        const foundIds = periods.map(p => p.id)
        const missingIds = ids.filter(id => !foundIds.includes(id))
        throw FiscalPeriodErrors.NOT_FOUND(missingIds[0])
      }
      
      const closedPeriod = periods.find(p => !p.is_open)
      if (closedPeriod) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('closed_period', `Cannot delete closed period: ${closedPeriod.period}`)
      }
      
      await this.repository.bulkDelete(companyId, ids.map(id => id.trim()), userId)
      
      try {
        await this.auditService.log('BULK_DELETE', 'fiscal_period', ids.join(','), userId, null, null)
      } catch (auditError) {
        logWarn('Audit logging failed for bulk delete operation', {
          correlation_id: correlationId,
          ids_count: ids.length,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service bulkDelete completed', { 
        correlation_id: correlationId,
        deleted_count: ids.length
      })
    } catch (error) {
      logError('Service bulkDelete failed', { 
        correlation_id: correlationId,
        count: ids.length,
        company_id: companyId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async restore(id: string, userId: string, companyId: string, correlationId?: string): Promise<void> {
    try {
      this.validateCompanyAccess(companyId)
      
      if (!id?.trim() || !userId?.trim()) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('required_fields', 'Period ID and User ID are required')
      }
      
      logInfo('Service restore started', { 
        correlation_id: correlationId,
        period_id: id, 
        user_id: userId,
        company_id: companyId
      })
      
      await this.repository.restore(id.trim(), companyId)
      
      try {
        await this.auditService.log('RESTORE', 'fiscal_period', id, userId, null, null)
      } catch (auditError) {
        logWarn('Audit logging failed for restore operation', {
          correlation_id: correlationId,
          period_id: id,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service restore completed', { 
        correlation_id: correlationId,
        period_id: id
      })
    } catch (error) {
      logError('Service restore failed', { 
        correlation_id: correlationId,
        period_id: id,
        company_id: companyId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async bulkRestore(ids: string[], userId: string, companyId: string, correlationId?: string): Promise<void> {
    try {
      this.validateCompanyAccess(companyId)
      this.validateUUIDs(ids)
      
      if (!userId?.trim()) {
        throw FiscalPeriodErrors.VALIDATION_ERROR('userId', 'User ID is required')
      }
      
      logInfo('Service bulkRestore started', { 
        correlation_id: correlationId,
        count: ids.length, 
        user_id: userId,
        company_id: companyId
      })
      
      await this.repository.bulkRestore(companyId, ids.map(id => id.trim()))
      
      try {
        await this.auditService.log('BULK_RESTORE', 'fiscal_period', ids.join(','), userId, null, null)
      } catch (auditError) {
        logWarn('Audit logging failed for bulk restore operation', {
          correlation_id: correlationId,
          ids_count: ids.length,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service bulkRestore completed', { 
        correlation_id: correlationId,
        restored_count: ids.length
      })
    } catch (error) {
      logError('Service bulkRestore failed', { 
        correlation_id: correlationId,
        count: ids.length,
        company_id: companyId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async exportToExcel(companyId: string, filter?: any, correlationId?: string): Promise<Buffer> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      const validatedFilter = this.validateFilter(filter)
      
      logInfo('Service exportToExcel started', { 
        correlation_id: correlationId,
        company_id: companyId, 
        filter: validatedFilter 
      })
      
      const data = await this.repository.exportData(companyId, validatedFilter, this.config.limits.export)
      
      const columns = [
        { header: 'Period', key: 'period', width: 15 },
        { header: 'Fiscal Year', key: 'fiscal_year', width: 15 },
        { header: 'Period Start', key: 'period_start', width: 15 },
        { header: 'Period End', key: 'period_end', width: 15 },
        { header: 'Open', key: 'is_open', width: 10 },
        { header: 'Adjustment Allowed', key: 'is_adjustment_allowed', width: 20 },
        { header: 'Year End', key: 'is_year_end', width: 10 },
        { header: 'Created At', key: 'created_at', width: 20 }
      ]
      
      const buffer = await this.exportService.generateExcel(data, columns)
      
      logInfo('Service exportToExcel completed', { 
        correlation_id: correlationId,
        company_id: companyId,
        exported_records: data.length
      })
      
      return buffer
    } catch (error) {
      logError('Service exportToExcel failed', { 
        correlation_id: correlationId,
        company_id: companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }
}

export const fiscalPeriodsService = new FiscalPeriodsService()
