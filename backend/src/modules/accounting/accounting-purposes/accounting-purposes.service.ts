import { accountingPurposesRepository, AccountingPurposesRepository } from './accounting-purposes.repository'
import { AccountingPurpose, CreateAccountingPurposeDTO, UpdateAccountingPurposeDTO, FilterParams, SortParams } from './accounting-purposes.types'
import { PaginatedResponse, createPaginatedResponse } from '../../../utils/pagination.util'
import { ExportService } from '../../../services/export.service'
import { ImportService } from '../../../services/import.service'
import { AuditService } from '../../../services/audit.service'
import { AccountingPurposeErrors } from './accounting-purposes.errors'
import { APPLIED_TO_TYPES, defaultConfig } from './accounting-purposes.config'
import { AccountingPurposesConfig } from './accounting-purposes.config'
import { logInfo, logError, logWarn } from '../../../config/logger'

export interface IAuditService {
  log(action: string, entity: string, entityId: string, userId: string, oldData?: any, newData?: any): Promise<void>
}

export interface IExportService {
  generateExcel(data: any[], columns: any[]): Promise<Buffer>
}

export interface IImportService {
  parseExcel(buffer: Buffer): Promise<any[]>
  processImport(rows: any[], requiredFields: string[], processor: (row: any) => Promise<void>, skipDuplicates: boolean): Promise<any>
}

export class AccountingPurposesService {
  private readonly config: AccountingPurposesConfig

  /**
   * Service constructor with dependency injection
   * @param repository Data access layer
   * @param auditService Audit logging service
   * @param exportService Excel export service
   * @param importService Excel import service
   * @param config Module configuration
   */
  constructor(
    private repository: AccountingPurposesRepository = accountingPurposesRepository,
    private auditService: IAuditService = AuditService,
    private exportService: IExportService = ExportService,
    private importService: IImportService = ImportService,
    config: AccountingPurposesConfig = defaultConfig
  ) {
    this.config = config
  }

  private sanitizeInput(input: string): string {
    if (!input) return ''
    return input.trim()
  }

  private validateCompanyAccess(companyId: string): void {
    if (!companyId?.trim()) {
      throw AccountingPurposeErrors.COMPANY_ACCESS_DENIED('undefined')
    }
    
    // Additional validation can be added here (e.g., user permissions)
  }

  private validateUUIDs(ids: string[]): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const invalidIds = ids.filter(id => !id?.trim() || !uuidRegex.test(id.trim()))
    if (invalidIds.length > 0) {
      throw AccountingPurposeErrors.VALIDATION_ERROR('ids', `Invalid UUID format: ${invalidIds.join(', ')}`)
    }
  }

  private validateFilter(filter: any): FilterParams {
    if (!filter) return {}
    
    const validatedFilter: FilterParams = {}
    
    if (filter.applied_to && typeof filter.applied_to === 'string') {
      if (APPLIED_TO_TYPES.includes(filter.applied_to as any)) {
        validatedFilter.applied_to = filter.applied_to
      }
    }
    
    if (filter.is_active !== undefined && typeof filter.is_active === 'boolean') {
      validatedFilter.is_active = filter.is_active
    }
    
    if (filter.show_deleted !== undefined && typeof filter.show_deleted === 'boolean') {
      validatedFilter.show_deleted = filter.show_deleted
    }
    
    if (filter.q && typeof filter.q === 'string' && filter.q.trim().length > 0) {
      // Sanitize search query to prevent injection
      const sanitized = filter.q.trim().replace(/[%_\\]/g, '\\$&')
      if (sanitized.length <= 100) {
        validatedFilter.q = sanitized
      }
    }
    
    return validatedFilter
  }

  private validateSort(sort: any): SortParams | undefined {
    if (!sort) return undefined
    
    const validFields = ['purpose_code', 'purpose_name', 'applied_to', 'is_active', 'created_at', 'updated_at']
    
    if (sort.field && validFields.includes(sort.field) && 
        sort.order && ['asc', 'desc'].includes(sort.order)) {
      return { field: sort.field, order: sort.order }
    }
    
    return undefined
  }

  /**
   * Lists accounting purposes with pagination and filtering
   * @param companyId Company identifier
   * @param pagination Pagination parameters
   * @param sort Sort parameters
   * @param filter Filter parameters
   * @param correlationId Request correlation ID
   * @returns Paginated list of accounting purposes
   */
  async list(
    companyId: string,
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any,
    correlationId?: string
  ): Promise<PaginatedResponse<AccountingPurpose>> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      // Validate pagination limits
      if (pagination.limit > this.config.limits.pageSize) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('limit', `Page size cannot exceed ${this.config.limits.pageSize}`)
      }
      
      // Validate filter and sort at service level
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

  /**
   * Searches accounting purposes with text query
   * @param companyId Company identifier
   * @param searchTerm Search text
   * @param pagination Pagination parameters
   * @param sort Sort parameters
   * @param filter Filter parameters
   * @param correlationId Request correlation ID
   * @returns Paginated search results
   */
  async search(
    companyId: string,
    searchTerm: string,
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any,
    correlationId?: string
  ): Promise<PaginatedResponse<AccountingPurpose>> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      // Sanitize search term
      const sanitizedSearchTerm = this.sanitizeInput(searchTerm)
      if (sanitizedSearchTerm.length > 100) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('searchTerm', 'Search term must be 100 characters or less')
      }
      
      // Validate filter and sort at service level
      const validatedFilter = this.validateFilter({ ...filter, q: sanitizedSearchTerm })
      const validatedSort = this.validateSort(sort)
      
      logInfo('Service search started', { 
        correlation_id: correlationId,
        company_id: companyId,
        search_term: sanitizedSearchTerm,
        pagination
      })
      
      const { data, total } = await this.repository.findAll(companyId, pagination, validatedSort, validatedFilter)
      const result = createPaginatedResponse(data, total, pagination.page, pagination.limit)
      
      logInfo('Service search completed', { 
        correlation_id: correlationId,
        company_id: companyId,
        search_results: data.length
      })
      
      return result
    } catch (error) {
      logError('Service search failed', { 
        correlation_id: correlationId,
        company_id: companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Creates a new accounting purpose
   * @param data Purpose creation data
   * @param userId User performing the action
   * @param correlationId Request correlation ID
   * @returns Created accounting purpose
   */
  async create(data: CreateAccountingPurposeDTO, userId: string, correlationId?: string): Promise<AccountingPurpose> {
    
    try {
      this.validateCompanyAccess(data.company_id)
      
      if (!userId?.trim()) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('userId', 'User ID is required')
      }
      
      logInfo('Service create started', { 
        correlation_id: correlationId,
        purpose_code: data.purpose_code, 
        company_id: data.company_id,
        user_id: userId 
      })
      
      // Sanitize input data
      const sanitizedData: CreateAccountingPurposeDTO = {
        ...data,
        purpose_code: this.sanitizeInput(data.purpose_code).toUpperCase(),
        purpose_name: this.sanitizeInput(data.purpose_name),
        description: data.description ? this.sanitizeInput(data.description) : null,
        is_active: data.is_active !== undefined ? data.is_active : true
      }
      
      // Validate applied_to
      if (!APPLIED_TO_TYPES.includes(sanitizedData.applied_to as any)) {
        throw AccountingPurposeErrors.INVALID_APPLIED_TO(sanitizedData.applied_to)
      }
      
      // Check for existing purpose code (race condition protection)
      const existingPurpose = await this.repository.findByCode(data.company_id, sanitizedData.purpose_code)
      if (existingPurpose) {
        throw AccountingPurposeErrors.CODE_EXISTS(sanitizedData.purpose_code, data.company_id)
      }
      
      const purpose = await this.repository.create(sanitizedData, userId)
      
      // Audit logging with error handling
      try {
        await this.auditService.log('CREATE', 'accounting_purpose', purpose.id, userId, null, purpose)
      } catch (auditError) {
        logWarn('Audit logging failed for create operation', {
          correlation_id: correlationId,
          purpose_id: purpose.id,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service create completed', { 
        correlation_id: correlationId,
        purpose_id: purpose.id,
        purpose_code: purpose.purpose_code
      })
      
      return purpose
    } catch (error) {
      logError('Service create failed', { 
        correlation_id: correlationId,
        purpose_code: data.purpose_code,
        company_id: data.company_id,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Retrieves accounting purpose by ID
   * @param id Purpose identifier
   * @param companyId Company identifier
   * @param correlationId Request correlation ID
   * @returns Accounting purpose or throws if not found
   */
  async getById(id: string, companyId: string, correlationId?: string): Promise<AccountingPurpose> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      if (!id?.trim()) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('id', 'Purpose ID is required')
      }
      
      logInfo('Service getById started', { 
        correlation_id: correlationId,
        purpose_id: id,
        company_id: companyId
      })
      
      const purpose = await this.repository.findById(id.trim(), companyId)
      if (!purpose) {
        throw AccountingPurposeErrors.NOT_FOUND(id)
      }
      
      logInfo('Service getById completed', { 
        correlation_id: correlationId,
        purpose_id: id,
        purpose_code: purpose.purpose_code
      })
      
      return purpose
    } catch (error) {
      logError('Service getById failed', { 
        correlation_id: correlationId,
        purpose_id: id,
        company_id: companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Updates an existing accounting purpose
   * @param id Purpose identifier
   * @param data Update data
   * @param userId User performing the action
   * @param companyId Company identifier
   * @param correlationId Request correlation ID
   * @returns Updated accounting purpose
   */
  async update(id: string, data: UpdateAccountingPurposeDTO, userId: string, companyId: string, correlationId?: string): Promise<AccountingPurpose> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      if (!id?.trim() || !userId?.trim()) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'Purpose ID and User ID are required')
      }
      
      logInfo('Service update started', { 
        correlation_id: correlationId,
        purpose_id: id, 
        user_id: userId,
        company_id: companyId
      })
      
      // Get existing record for validation and audit
      const existing = await this.repository.findById(id.trim(), companyId)
      if (!existing) {
        throw AccountingPurposeErrors.NOT_FOUND(id)
      }
      
      // Check if system purpose
      if (existing.is_system) {
        throw AccountingPurposeErrors.SYSTEM_PURPOSE_READONLY()
      }
      
      // Sanitize input data
      const sanitizedData: UpdateAccountingPurposeDTO = {
        ...(data.purpose_name && { purpose_name: this.sanitizeInput(data.purpose_name) }),
        ...(data.applied_to && { applied_to: data.applied_to }),
        ...(data.description !== undefined && { 
          description: data.description ? this.sanitizeInput(data.description) : null 
        }),
        ...(data.is_active !== undefined && { is_active: data.is_active })
      }
      
      // Validate applied_to if being changed
      if (sanitizedData.applied_to && !APPLIED_TO_TYPES.includes(sanitizedData.applied_to as any)) {
        throw AccountingPurposeErrors.INVALID_APPLIED_TO(sanitizedData.applied_to)
      }
      
      const purpose = await this.repository.update(id.trim(), companyId, {
        ...sanitizedData,
        updated_by: userId
      })
      if (!purpose) {
        throw AccountingPurposeErrors.UPDATE_FAILED()
      }
      
      // Audit logging with error handling
      try {
        await this.auditService.log('UPDATE', 'accounting_purpose', id, userId, existing, purpose)
      } catch (auditError) {
        logWarn('Audit logging failed for update operation', {
          correlation_id: correlationId,
          purpose_id: id,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service update completed', { 
        correlation_id: correlationId,
        purpose_id: id,
        purpose_code: purpose.purpose_code
      })
      
      return purpose
    } catch (error) {
      logError('Service update failed', { 
        correlation_id: correlationId,
        purpose_id: id,
        company_id: companyId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Deletes an accounting purpose
   * @param id Purpose identifier
   * @param userId User performing the action
   * @param companyId Company identifier
   * @param correlationId Request correlation ID
   */
  async delete(id: string, userId: string, companyId: string, correlationId?: string): Promise<void> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      if (!id?.trim() || !userId?.trim()) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'Purpose ID and User ID are required')
      }
      
      logInfo('Service delete started', { 
        correlation_id: correlationId,
        purpose_id: id, 
        user_id: userId,
        company_id: companyId
      })
      
      // Get existing record for validation and audit
      const purpose = await this.repository.findById(id.trim(), companyId)
      if (!purpose) {
        throw AccountingPurposeErrors.NOT_FOUND(id)
      }
      
      // Check if system purpose
      if (purpose.is_system) {
        throw AccountingPurposeErrors.SYSTEM_PURPOSE_READONLY()
      }
      
      await this.repository.delete(id.trim(), companyId)
      
      // Audit logging with error handling
      try {
        await this.auditService.log('DELETE', 'accounting_purpose', id, userId, purpose, null)
      } catch (auditError) {
        logWarn('Audit logging failed for delete operation', {
          correlation_id: correlationId,
          purpose_id: id,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service delete completed', { 
        correlation_id: correlationId,
        purpose_id: id,
        purpose_code: purpose.purpose_code
      })
    } catch (error) {
      logError('Service delete failed', { 
        correlation_id: correlationId,
        purpose_id: id,
        company_id: companyId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Updates status of multiple accounting purposes
   * @param ids Array of purpose identifiers
   * @param isActive New active status
   * @param userId User performing the action
   * @param companyId Company identifier
   * @param correlationId Request correlation ID
   */
  async bulkUpdateStatus(ids: string[], isActive: boolean, userId: string, companyId: string, correlationId?: string): Promise<void> {
    const lockKey = `bulk_update_${companyId}`
    
    try {
      this.validateCompanyAccess(companyId)
      this.validateUUIDs(ids)
      
      if (!userId?.trim()) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('userId', 'User ID is required')
      }
      
      if (ids.length > this.config.limits.bulkUpdate) {
        throw AccountingPurposeErrors.BULK_OPERATION_LIMIT_EXCEEDED('update', this.config.limits.bulkUpdate, ids.length)
      }
      
      logInfo('Service bulkUpdateStatus started', { 
        correlation_id: correlationId,
        count: ids.length, 
        is_active: isActive, 
        user_id: userId,
        company_id: companyId
      })
      
      // Validate no system purposes in the list (bulk check to avoid N+1)
      const purposes = await this.repository.findByIds(companyId, ids.map(id => id.trim()))
      const systemPurposes = purposes.filter(p => p.is_system)
      if (systemPurposes.length > 0) {
        throw AccountingPurposeErrors.SYSTEM_PURPOSE_READONLY()
      }
      
      // Check if all requested IDs exist
      if (purposes.length !== ids.length) {
        const foundIds = purposes.map(p => p.id)
        const missingIds = ids.filter(id => !foundIds.includes(id))
        throw AccountingPurposeErrors.NOT_FOUND(missingIds[0])
      }
      
      await this.repository.bulkUpdateStatus(companyId, ids.map(id => id.trim()), {
        is_active: isActive,
        updated_by: userId
      })
      
      // Audit logging with error handling
      try {
        await this.auditService.log('BULK_UPDATE_STATUS', 'accounting_purpose', ids.join(','), userId, null, { is_active: isActive })
      } catch (auditError) {
        logWarn('Audit logging failed for bulk update operation', {
          correlation_id: correlationId,
          ids_count: ids.length,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service bulkUpdateStatus completed', { 
        correlation_id: correlationId,
        updated_count: ids.length,
        is_active: isActive
      })
    } catch (error) {
      logError('Service bulkUpdateStatus failed', { 
        correlation_id: correlationId,
        count: ids.length,
        company_id: companyId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Deletes multiple accounting purposes
   * @param ids Array of purpose identifiers
   * @param userId User performing the action
   * @param companyId Company identifier
   * @param correlationId Request correlation ID
   */
  async bulkDelete(ids: string[], userId: string, companyId: string, correlationId?: string): Promise<void> {
    
    try {
      this.validateCompanyAccess(companyId)
      this.validateUUIDs(ids)
      
      if (!userId?.trim()) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('userId', 'User ID is required')
      }
      
      if (ids.length > this.config.limits.bulkDelete) {
        throw AccountingPurposeErrors.BULK_OPERATION_LIMIT_EXCEEDED('delete', this.config.limits.bulkDelete, ids.length)
      }
      
      logInfo('Service bulkDelete started', { 
        correlation_id: correlationId,
        count: ids.length, 
        user_id: userId,
        company_id: companyId
      })
      
      // Validate no system purposes in the list (bulk check to avoid N+1)
      const purposes = await this.repository.findByIds(companyId, ids.map(id => id.trim()))
      const systemPurposes = purposes.filter(p => p.is_system)
      if (systemPurposes.length > 0) {
        throw AccountingPurposeErrors.SYSTEM_PURPOSE_READONLY()
      }
      
      // Check if all requested IDs exist
      if (purposes.length !== ids.length) {
        const foundIds = purposes.map(p => p.id)
        const missingIds = ids.filter(id => !foundIds.includes(id))
        throw AccountingPurposeErrors.NOT_FOUND(missingIds[0])
      }
      
      await this.repository.bulkDelete(companyId, ids.map(id => id.trim()))
      
      // Audit logging with error handling
      try {
        await this.auditService.log('BULK_DELETE', 'accounting_purpose', ids.join(','), userId, null, null)
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
        throw AccountingPurposeErrors.VALIDATION_ERROR('required_fields', 'Purpose ID and User ID are required')
      }
      
      logInfo('Service restore started', { 
        correlation_id: correlationId,
        purpose_id: id, 
        user_id: userId,
        company_id: companyId
      })
      
      await this.repository.restore(id.trim(), companyId)
      
      try {
        await this.auditService.log('RESTORE', 'accounting_purpose', id, userId, null, null)
      } catch (auditError) {
        logWarn('Audit logging failed for restore operation', {
          correlation_id: correlationId,
          purpose_id: id,
          error: auditError instanceof Error ? auditError.message : 'Unknown audit error'
        })
      }
      
      logInfo('Service restore completed', { 
        correlation_id: correlationId,
        purpose_id: id
      })
    } catch (error) {
      logError('Service restore failed', { 
        correlation_id: correlationId,
        purpose_id: id,
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
        throw AccountingPurposeErrors.VALIDATION_ERROR('userId', 'User ID is required')
      }
      
      logInfo('Service bulkRestore started', { 
        correlation_id: correlationId,
        count: ids.length, 
        user_id: userId,
        company_id: companyId
      })
      
      await this.repository.bulkRestore(companyId, ids.map(id => id.trim()))
      
      try {
        await this.auditService.log('BULK_RESTORE', 'accounting_purpose', ids.join(','), userId, null, null)
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

  /**
   * Gets available filter options for the company
   * @param companyId Company identifier
   * @param correlationId Request correlation ID
   * @returns Available filter options
   */
  async getFilterOptions(companyId: string, correlationId?: string) {
    
    try {
      this.validateCompanyAccess(companyId)
      
      logInfo('Service getFilterOptions started', { 
        correlation_id: correlationId,
        company_id: companyId
      })
      
      const options = await this.repository.getFilterOptions(companyId)
      
      logInfo('Service getFilterOptions completed', { 
        correlation_id: correlationId,
        company_id: companyId,
        applied_to_types_count: options.applied_to_types.length
      })
      
      return options
    } catch (error) {
      logError('Service getFilterOptions failed', { 
        correlation_id: correlationId,
        company_id: companyId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Exports accounting purposes to Excel format
   * @param companyId Company identifier
   * @param filter Optional filter parameters
   * @param correlationId Request correlation ID
   * @returns Excel file buffer
   */
  async exportToExcel(companyId: string, filter?: any, correlationId?: string): Promise<Buffer> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      // Validate filter at service level
      const validatedFilter = this.validateFilter(filter)
      
      logInfo('Service exportToExcel started', { 
        correlation_id: correlationId,
        company_id: companyId, 
        filter: validatedFilter 
      })
      
      const data = await this.repository.exportData(companyId, validatedFilter, this.config.limits.export)
      
      const columns = [
        { header: 'Purpose Code', key: 'purpose_code', width: 20 },
        { header: 'Purpose Name', key: 'purpose_name', width: 30 },
        { header: 'Applied To', key: 'applied_to', width: 15 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Active', key: 'is_active', width: 10 },
        { header: 'System', key: 'is_system', width: 10 },
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

  /**
   * Previews Excel import data
   * @param buffer Excel file buffer
   * @param correlationId Request correlation ID
   * @returns Parsed preview data
   */
  async previewImport(buffer: Buffer, correlationId?: string): Promise<any[]> {
    
    try {
      logInfo('Service previewImport started', { 
        correlation_id: correlationId,
        buffer_size: buffer.length
      })
      
      const result = await this.importService.parseExcel(buffer)
      
      logInfo('Service previewImport completed', { 
        correlation_id: correlationId,
        parsed_rows: result.length
      })
      
      return result
    } catch (error) {
      logError('Service previewImport failed', { 
        correlation_id: correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Imports accounting purposes from Excel file
   * @param buffer Excel file buffer
   * @param failOnDuplicates Whether to fail when duplicates are found
   * @param companyId Company identifier
   * @param userId User performing the import
   * @param correlationId Request correlation ID
   * @returns Import result
   */
  async importFromExcel(buffer: Buffer, failOnDuplicates: boolean, companyId: string, userId: string, correlationId?: string): Promise<any> {
    
    try {
      this.validateCompanyAccess(companyId)
      
      if (!userId?.trim()) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('userId', 'User ID is required')
      }
      
      if (!buffer || buffer.length === 0) {
        throw AccountingPurposeErrors.VALIDATION_ERROR('buffer', 'File buffer is required')
      }
      
      logInfo('Service importFromExcel started', { 
        correlation_id: correlationId,
        company_id: companyId, 
        fail_on_duplicates: failOnDuplicates,
        user_id: userId,
        buffer_size: buffer.length
      })
      
      const rows = await this.importService.parseExcel(buffer)
      const requiredFields = ['purpose_code', 'purpose_name', 'applied_to']
      
      const result = await this.importService.processImport(
        rows,
        requiredFields,
        async (row) => {
          // Sanitize row data
          const sanitizedRow = {
            purpose_code: this.sanitizeInput(row.purpose_code).toUpperCase(),
            purpose_name: this.sanitizeInput(row.purpose_name),
            applied_to: row.applied_to,
            description: row.description ? this.sanitizeInput(row.description) : null,
            is_active: row.is_active !== 'false' && row.is_active !== false
          }
          
          if (failOnDuplicates) {
            const existingPurpose = await this.repository.findByCode(companyId, sanitizedRow.purpose_code)
            if (existingPurpose) {
              throw AccountingPurposeErrors.CODE_EXISTS(sanitizedRow.purpose_code, companyId)
            }
          }

          // Validate applied_to
          if (!APPLIED_TO_TYPES.includes(sanitizedRow.applied_to)) {
            throw AccountingPurposeErrors.INVALID_APPLIED_TO(sanitizedRow.applied_to)
          }

          await this.repository.create({
            company_id: companyId,
            ...sanitizedRow
          }, userId)
        },
        !failOnDuplicates
      )
      
      logInfo('Service importFromExcel completed', { 
        correlation_id: correlationId,
        company_id: companyId,
        processed_rows: rows.length
      })
      
      return result
    } catch (error) {
      logError('Service importFromExcel failed', { 
        correlation_id: correlationId,
        company_id: companyId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }
}

export const accountingPurposesService = new AccountingPurposesService()