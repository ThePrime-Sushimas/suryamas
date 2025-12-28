import { metricUnitsRepository } from './metricUnits.repository'
import { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto } from './metricUnits.types'
import { PaginatedResponse, createPaginatedResponse } from '../../utils/pagination.util'
import { AuditService } from '../../services/audit.service'
import { METRIC_UNIT_CONFIG } from './metricUnits.constants'
import { MetricUnitNotFoundError, DuplicateMetricUnitError } from './metricUnits.errors'
import { logError, logWarn } from '../../config/logger'

export class MetricUnitsService {
  async list(
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any
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

  async create(dto: CreateMetricUnitDto, userId?: string): Promise<MetricUnit> {
    try {
      const created = await metricUnitsRepository.create({
        ...dto,
        is_active: dto.is_active ?? true,
        created_by: userId ?? null
      })

      await AuditService.log('CREATE', 'metric_unit', created.id, userId ?? null, null, created)
      return created
    } catch (error: any) {
      if (error.code === '23505') {
        logWarn('Duplicate metric unit attempt', { dto, userId })
        throw new DuplicateMetricUnitError()
      }
      logError('Unexpected error creating metric unit', { error: error.message, dto })
      throw error
    }
  }

  async update(id: string, dto: UpdateMetricUnitDto, userId?: string): Promise<MetricUnit> {
    const before = await metricUnitsRepository.findById(id)
    if (!before) throw new MetricUnitNotFoundError(id)

    try {
      const updated = await metricUnitsRepository.updateById(id, {
        ...dto,
        updated_by: userId ?? null
      })
      
      await AuditService.log('UPDATE', 'metric_unit', id, userId ?? null, before, dto)
      return updated
    } catch (error: any) {
      if (error.code === '23505') {
        logWarn('Duplicate metric unit attempt on update', { id, dto, userId })
        throw new DuplicateMetricUnitError()
      }
      logError('Unexpected error updating metric unit', { error: error.message, id, dto })
      throw error
    }
  }

  async delete(id: string, userId?: string): Promise<void> {
    const before = await metricUnitsRepository.findById(id)
    if (!before) throw new MetricUnitNotFoundError(id)

    await metricUnitsRepository.delete(id)
    await AuditService.log('DELETE', 'metric_unit', id, userId ?? null, before, null)
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean, userId?: string): Promise<void> {
    await metricUnitsRepository.bulkUpdateStatus(ids, isActive)
    await AuditService.log('BULK_UPDATE_STATUS', 'metric_unit', ids.join(','), userId ?? null, { ids }, { is_active: isActive })
  }

  async filterOptions() {
    return {
      metric_types: METRIC_UNIT_CONFIG.VALID_TYPES,
      statuses: [{ label: 'Active', value: true }, { label: 'Inactive', value: false }]
    }
  }
}

export const metricUnitsService = new MetricUnitsService()
