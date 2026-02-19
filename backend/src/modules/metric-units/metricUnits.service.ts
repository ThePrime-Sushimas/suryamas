import { metricUnitsRepository } from './metricUnits.repository'
import { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto } from './metricUnits.types'
import { PaginatedResponse, createPaginatedResponse } from '../../utils/pagination.util'
import { AuditService } from '../monitoring/monitoring.service'
import { METRIC_UNIT_CONFIG } from './metricUnits.constants'
import { MetricUnitNotFoundError, DuplicateMetricUnitError } from './metric-units.errors'
import { logError, logWarn } from '../../config/logger'

export class MetricUnitsService {
  /**
   * Retrieves a paginated list of metric units with optional sorting and filtering
   * @param pagination - Page number, limit, and offset
   * @param sort - Optional sorting configuration
   * @param filter - Optional filters for metric_type, is_active, and search query
   * @returns Paginated response with metric units
   */
  async list(
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: { metric_type?: string; is_active?: boolean; q?: string }
  ): Promise<PaginatedResponse<MetricUnit>> {
    const { data, total } = await metricUnitsRepository.list(pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async listActive(
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Promise<PaginatedResponse<MetricUnit>> {
    const { data, total } = await metricUnitsRepository.listActiveFromView(pagination, sort)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async getById(id: string): Promise<MetricUnit> {
    const metricUnit = await metricUnitsRepository.findById(id)
    if (!metricUnit) throw new MetricUnitNotFoundError(id)
    return metricUnit
  }

  /**
   * Creates a new metric unit with audit logging
   * @param dto - Metric unit data to create
   * @param userId - ID of user creating the unit
   * @returns Created metric unit with generated ID
   * @throws DuplicateMetricUnitError if metric_type + unit_name combination exists
   */
  async create(dto: CreateMetricUnitDto, userId?: string): Promise<MetricUnit> {
    const created = await metricUnitsRepository.create({
      ...dto,
      is_active: dto.is_active ?? true,
      created_by: userId ?? null
    })

    await AuditService.log('CREATE', 'metric_unit', created.id, userId ?? null, null, dto)
    return created
  }

  async update(id: string, dto: UpdateMetricUnitDto, userId?: string): Promise<MetricUnit> {
    const before = await metricUnitsRepository.findById(id)
    if (!before) throw new MetricUnitNotFoundError(id)

    const updated = await metricUnitsRepository.updateById(id, {
      ...dto,
      updated_by: userId ?? null
    })
    
    if (!updated) throw new MetricUnitNotFoundError(id)
    
    await AuditService.log('UPDATE', 'metric_unit', id, userId ?? null, before, updated)
    return updated
  }

  /**
   * Soft deletes a metric unit by setting is_active to false
   * @param id - Metric unit ID to delete
   * @param userId - ID of user performing the deletion
   * @throws MetricUnitNotFoundError if unit doesn't exist
   */
  async delete(id: string, userId?: string): Promise<void> {
    const before = await metricUnitsRepository.findById(id)
    if (!before) throw new MetricUnitNotFoundError(id)

    const updated = await metricUnitsRepository.updateById(id, { is_active: false, updated_by: userId ?? null })
    if (!updated) throw new MetricUnitNotFoundError(id)
    
    await AuditService.log('DELETE', 'metric_unit', id, userId ?? null, before, { is_active: false })
  }

  /**
   * Restores a soft-deleted metric unit by setting is_active to true
   * @param id - Metric unit ID to restore
   * @param userId - ID of user performing the restoration
   * @returns Restored metric unit
   * @throws MetricUnitNotFoundError if unit doesn't exist
   */
  async restore(id: string, userId?: string): Promise<MetricUnit> {
    const before = await metricUnitsRepository.findById(id)
    if (!before) throw new MetricUnitNotFoundError(id)

    const restored = await metricUnitsRepository.updateById(id, { is_active: true, updated_by: userId ?? null })
    if (!restored) throw new MetricUnitNotFoundError(id)
    
    await AuditService.log('RESTORE', 'metric_unit', id, userId ?? null, before, { is_active: true })
    return restored
  }

  /**
   * Updates status (is_active) for multiple metric units in a single operation
   * @param ids - Array of metric unit IDs to update
   * @param isActive - New active status to set
   * @param userId - ID of user performing the bulk update
   */
  async bulkUpdateStatus(ids: string[], isActive: boolean, userId?: string): Promise<void> {
    await metricUnitsRepository.bulkUpdateStatus(ids, isActive)
    await AuditService.log('BULK_UPDATE_STATUS', 'metric_unit', ids.join(','), userId ?? null, { ids }, { is_active: isActive })
  }

  filterOptions() {
    return {
      metric_types: METRIC_UNIT_CONFIG.VALID_TYPES,
      statuses: [{ label: 'Active', value: true }, { label: 'Inactive', value: false }]
    }
  }
}

export const metricUnitsService = new MetricUnitsService()
