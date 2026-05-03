import { fiscalPeriodsRepository, FiscalPeriodsRepository } from './fiscal-periods.repository'
import { FiscalPeriod, CreateFiscalPeriodDto, UpdateFiscalPeriodDto, FiscalPeriodFilter, SortParams, PeriodClosingSummary, ClosingAccountLine, ClosePeriodWithEntriesDto, ClosePeriodWithEntriesResult } from './fiscal-periods.types'
import { PaginatedResponse, createPaginatedResponse } from '../../../utils/pagination.util'
import { ExportService } from '../../../services/export.service'
import { AuditService } from '../../monitoring/monitoring.service'
import { FiscalPeriodErrors } from './fiscal-periods.errors'
import { PERIOD_FORMAT_REGEX } from './fiscal-periods.constants'
import { FiscalPeriodsConfig, defaultConfig } from './fiscal-periods.config'
import { logInfo, logError, logWarn } from '../../../config/logger'
import { pool } from '../../../config/db'

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
      
      const existingPeriod = await this.repository.findAnyByCompanyAndPeriod(data.company_id, sanitizedData.period)
      
      logInfo('Checking existing period before create', { 
        period: sanitizedData.period, 
        found: !!existingPeriod,
        existing_data: existingPeriod 
      })

      if (existingPeriod) {
        if (!existingPeriod.deleted_at) {
          logWarn('Period already exists and is not deleted', { period: sanitizedData.period })
          throw FiscalPeriodErrors.PERIOD_EXISTS(sanitizedData.period, data.company_id)
        }
        
        // If deleted, restore and update it
        logInfo('Restoring previously deleted fiscal period', { 
          period_id: existingPeriod.id, 
          period: sanitizedData.period 
        })
        
        const restoredPeriod = await this.repository.restoreWithUpdate(
          existingPeriod.id, 
          data.company_id, 
          {
            ...sanitizedData,
            updated_by: userId
          }
        )
        
        await this.auditService.log('RESTORE', 'fiscal_period', restoredPeriod.id, userId, existingPeriod, restoredPeriod)
        return restoredPeriod
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
        ...(data.period !== undefined && { period: this.sanitizeInput(data.period) }),
        ...(data.period_start !== undefined && { period_start: this.sanitizeInput(data.period_start) }),
        ...(data.period_end !== undefined && { period_end: this.sanitizeInput(data.period_end) }),
        ...(data.is_adjustment_allowed !== undefined && { is_adjustment_allowed: data.is_adjustment_allowed }),
        ...(data.is_year_end !== undefined && { is_year_end: data.is_year_end })
      }

      // Validations if period or dates changed
      if (sanitizedData.period && sanitizedData.period !== existing.period) {
        this.validatePeriodFormat(sanitizedData.period)
        const otherExists = await this.repository.findAnyByCompanyAndPeriod(companyId, sanitizedData.period)
        if (otherExists && otherExists.id !== id) {
          throw FiscalPeriodErrors.PERIOD_EXISTS(sanitizedData.period, companyId)
        }
      }

      const newStart = sanitizedData.period_start || existing.period_start
      const newEnd = sanitizedData.period_end || existing.period_end
      
      if (sanitizedData.period_start || sanitizedData.period_end) {
        this.validateDateRange(newStart, newEnd)
        await this.validateNoDateOverlap(companyId, newStart, newEnd, id)
      }

      if (sanitizedData.is_year_end !== undefined || sanitizedData.period) {
        const checkIsYearEnd = sanitizedData.is_year_end !== undefined ? sanitizedData.is_year_end : existing.is_year_end
        const checkPeriod = sanitizedData.period || existing.period
        await this.validateYearEndRules(companyId, checkPeriod, checkIsYearEnd, id)
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

  // ============================================================================
  // FISCAL CLOSING METHODS
  // ============================================================================

  async getClosingPreview(id: string, companyId: string): Promise<PeriodClosingSummary> {
    this.validateCompanyAccess(companyId)
    if (!id?.trim()) throw FiscalPeriodErrors.VALIDATION_ERROR('id', 'Period ID is required')

    const period = await this.repository.findById(id.trim(), companyId)
    if (!period) throw FiscalPeriodErrors.NOT_FOUND(id)
    if (!period.is_open) throw FiscalPeriodErrors.PERIOD_ALREADY_CLOSED(period.period)

    const { accounts, posted_count, pending_count } = await this.repository.getRevenueExpenseSummary(
      companyId, period.period_start, period.period_end
    )

    const closingLines: ClosingAccountLine[] = accounts.map(a => {
      const isRevenue = a.account_type === 'REVENUE'
      // Revenue normal = credit, Expense normal = debit
      const net = isRevenue
        ? a.total_credit - a.total_debit
        : a.total_debit - a.total_credit

      let closingDebit = 0
      let closingCredit = 0
      if (isRevenue) {
        if (net > 0) closingDebit = net   // normal revenue → debit to zero
        else closingCredit = Math.abs(net) // abnormal → credit to zero
      } else {
        if (net > 0) closingCredit = net   // normal expense → credit to zero
        else closingDebit = Math.abs(net)  // abnormal → debit to zero
      }

      return {
        account_id: a.account_id,
        account_code: a.account_code,
        account_name: a.account_name,
        account_type: a.account_type as 'REVENUE' | 'EXPENSE',
        total_debit: a.total_debit,
        total_credit: a.total_credit,
        net_amount: net,
        closing_debit: closingDebit,
        closing_credit: closingCredit,
      }
    })

    const totalRevenue = closingLines.filter(l => l.account_type === 'REVENUE').reduce((s, l) => s + l.net_amount, 0)
    const totalExpense = closingLines.filter(l => l.account_type === 'EXPENSE').reduce((s, l) => s + l.net_amount, 0)
    const netIncome = totalRevenue - totalExpense

    const defaultRE = await this.repository.getDefaultRetainedEarningsAccount(companyId)

    return {
      period: period.period,
      period_start: period.period_start,
      period_end: period.period_end,
      total_revenue: totalRevenue,
      total_expense: totalExpense,
      net_income: netIncome,
      is_profit: netIncome >= 0,
      accounts: closingLines,
      pending_journals_count: pending_count,
      posted_journals_count: posted_count,
      default_retained_earnings_account_id: defaultRE,
    }
  }

  async closePeriodWithEntries(
    id: string,
    dto: ClosePeriodWithEntriesDto,
    userId: string,
    companyId: string,
  ): Promise<ClosePeriodWithEntriesResult> {
    this.validateCompanyAccess(companyId)
    if (!id?.trim() || !userId?.trim()) {
      throw FiscalPeriodErrors.VALIDATION_ERROR('required_fields', 'Period ID and User ID are required')
    }

    const period = await this.repository.findById(id.trim(), companyId)
    if (!period) throw FiscalPeriodErrors.NOT_FOUND(id)
    if (!period.is_open) throw FiscalPeriodErrors.PERIOD_ALREADY_CLOSED(period.period)

    // Check closing journal doesn't already exist
    const hasClosing = await this.repository.hasClosingJournal(companyId, period.period)
    if (hasClosing) throw FiscalPeriodErrors.CLOSING_JOURNAL_EXISTS(period.period)

    // Validate RE account is EQUITY type
    const reAccountRes = await pool.query(
      `SELECT id, account_type, account_code, account_name FROM chart_of_accounts
       WHERE id = $1 AND company_id = $2 AND is_active = true AND deleted_at IS NULL`,
      [dto.retained_earnings_account_id, companyId]
    )
    if (reAccountRes.rows.length === 0 || reAccountRes.rows[0].account_type !== 'EQUITY') {
      throw FiscalPeriodErrors.INVALID_RETAINED_EARNINGS_ACCOUNT(dto.retained_earnings_account_id)
    }

    // Get revenue/expense summary
    const { accounts, posted_count } = await this.repository.getRevenueExpenseSummary(
      companyId, period.period_start, period.period_end
    )
    if (posted_count === 0) throw FiscalPeriodErrors.NO_TRANSACTIONS_IN_PERIOD(period.period)

    // Build closing lines
    const closingLines: Array<{ account_id: string; debit: number; credit: number; description: string }> = []
    let totalClosingDebit = 0
    let totalClosingCredit = 0

    for (const a of accounts) {
      const isRevenue = a.account_type === 'REVENUE'
      const net = isRevenue ? a.total_credit - a.total_debit : a.total_debit - a.total_credit
      if (Math.abs(net) < 0.005) continue // skip zero-balance accounts

      let debit = 0
      let credit = 0
      if (isRevenue) {
        if (net > 0) debit = net; else credit = Math.abs(net)
      } else {
        if (net > 0) credit = net; else debit = Math.abs(net)
      }

      closingLines.push({ account_id: a.account_id, debit, credit, description: `Closing ${a.account_code} - ${a.account_name}` })
      totalClosingDebit += debit
      totalClosingCredit += credit
    }

    // RE line (penyeimbang)
    const netIncome = totalClosingDebit - totalClosingCredit
    const isProfit = netIncome > 0
    if (Math.abs(netIncome) >= 0.005) {
      if (isProfit) {
        closingLines.push({ account_id: dto.retained_earnings_account_id, debit: 0, credit: netIncome, description: `Laba periode ${period.period}` })
        totalClosingCredit += netIncome
      } else {
        closingLines.push({ account_id: dto.retained_earnings_account_id, debit: Math.abs(netIncome), credit: 0, description: `Rugi periode ${period.period}` })
        totalClosingDebit += Math.abs(netIncome)
      }
    }

    const totalAmount = Math.max(totalClosingDebit, totalClosingCredit)

    // Execute atomically
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Get next sequence
      const seqRes = await client.query(
        `SELECT get_next_journal_sequence($1, $2, 'GENERAL')`,
        [companyId, period.period]
      )
      const seq = seqRes.rows[0].get_next_journal_sequence
      const journalNumber = `JG-${period.period}-${String(seq).padStart(4, '0')}`

      // 2. Create journal header
      const headerRes = await client.query(
        `INSERT INTO journal_headers (
          company_id, branch_id, journal_number, sequence_number,
          journal_type, journal_date, period, description,
          total_debit, total_credit, currency, exchange_rate,
          status, source_module, posted_at, created_by, created_at, updated_at
        ) VALUES ($1, NULL, $2, $3, 'GENERAL', $4, $5, $6, $7, $8, 'IDR', 1, 'POSTED', 'FISCAL_CLOSING', NOW(), $9, NOW(), NOW())
        RETURNING id, journal_number`,
        [companyId, journalNumber, seq, period.period_end, period.period,
         `Closing Entry - ${period.period}`, totalAmount, totalAmount, userId]
      )
      const journalId = headerRes.rows[0].id
      const journalNum = headerRes.rows[0].journal_number

      // 3. Insert journal lines
      for (let i = 0; i < closingLines.length; i++) {
        const line = closingLines[i]
        await client.query(
          `INSERT INTO journal_lines (
            journal_header_id, line_number, account_id, description,
            debit_amount, credit_amount, base_debit_amount, base_credit_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $5, $6)`,
          [journalId, i + 1, line.account_id, line.description, line.debit, line.credit]
        )
      }

      // 4. Close the fiscal period
      await client.query(
        `UPDATE fiscal_periods SET is_open = false, closed_at = NOW(), closed_by = $1, close_reason = $2, updated_at = NOW(), updated_by = $1
         WHERE id = $3 AND company_id = $4`,
        [userId, dto.close_reason || `Fiscal closing - ${period.period}`, id, companyId]
      )

      await client.query('COMMIT')

      logInfo('Fiscal period closed with entries', {
        period_id: id, period: period.period, journal_id: journalId,
        journal_number: journalNum, net_income: netIncome, lines: closingLines.length,
      })

      // Audit log (outside transaction, non-critical)
      await this.auditService.log('CLOSE', 'fiscal_period', id, userId, { is_open: true }, {
        is_open: false, closing_journal_id: journalId, closing_journal_number: journalNum, net_income: netIncome,
      }).catch(e => logWarn('Audit log failed for fiscal closing', { error: String(e) }))

      // Fetch fresh data (bypasses cache)
      const updatedPeriod = await this.repository.findById(id, companyId)

      return {
        period: updatedPeriod || { ...period, is_open: false } as FiscalPeriod,
        closing_journal_id: journalId,
        closing_journal_number: journalNum,
        net_income: Math.abs(netIncome),
        is_profit: isProfit,
        lines_count: closingLines.length,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      logError('Fiscal closing failed, rolled back', { period_id: id, error })
      throw error
    } finally {
      client.release()
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
