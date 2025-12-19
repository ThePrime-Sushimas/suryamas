import { metricUnitsRepository } from './metricUnits.repository'
import { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto } from './metricUnits.types'
import { PaginatedResponse, createPaginatedResponse } from '../../utils/pagination.util'
import { AuditService } from '../../services/audit.service'

const VALID_METRIC_TYPES = ['Unit', 'Volume', 'Weight']

function isValidMetricType(type: any): type is string {
  return VALID_METRIC_TYPES.includes(type)
}

function isNonEmptyString(str: any): str is string {
  return typeof str === 'string' && str.trim().length > 0
}

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
    if (!metricUnit) throw new Error('Metric unit not found')
    return metricUnit
  }

  async create(dto: CreateMetricUnitDto, userId?: string): Promise<MetricUnit> {
    if (!isValidMetricType(dto.metric_type)) {
      throw new Error('Invalid metric_type')
    }
    if (!isNonEmptyString(dto.unit_name) || dto.unit_name.length > 100) {
      throw new Error('Invalid unit_name')
    }

    const isDuplicate = await metricUnitsRepository.isDuplicate(dto.metric_type, dto.unit_name)
    if (isDuplicate) {
      throw new Error('409: Duplicate metric_type + unit_name')
    }

    const created = await metricUnitsRepository.create({
      ...dto,
      is_active: dto.is_active ?? true,
      created_by: userId || null
    })

    await AuditService.log('CREATE', 'metric_unit', created.id, userId || null, null, created)
    return created
  }

  async update(id: string, dto: UpdateMetricUnitDto, userId?: string): Promise<MetricUnit> {
    if (dto.metric_type && !isValidMetricType(dto.metric_type)) {
      throw new Error('Invalid metric_type')
    }
    if (dto.unit_name && (!isNonEmptyString(dto.unit_name) || dto.unit_name.length > 100)) {
      throw new Error('Invalid unit_name')
    }

    const before = await metricUnitsRepository.findById(id)
    if (!before) throw new Error('Metric unit not found')

    if (dto.metric_type || dto.unit_name) {
      const isDuplicate = await metricUnitsRepository.isDuplicate(
        dto.metric_type || before.metric_type,
        dto.unit_name || before.unit_name,
        id
      )
      if (isDuplicate) {
        throw new Error('409: Duplicate metric_type + unit_name')
      }
    }

    const updateData = {
      ...dto,
      updated_by: userId || null,
      updated_at: new Date().toISOString()
    }
    const updated = await metricUnitsRepository.updateById(id, updateData)
    await AuditService.log('UPDATE', 'metric_unit', id, userId || null, before, dto)
    return updated
  }

  async delete(id: string, userId?: string): Promise<void> {
    const before = await metricUnitsRepository.findById(id)
    if (!before) throw new Error('Metric unit not found')

    await metricUnitsRepository.delete(id)
    await AuditService.log('DELETE', 'metric_unit', id, userId || null, before, null)
  }

  async bulkUpdateStatus(ids: string[], isActive: boolean, userId?: string): Promise<void> {
    await metricUnitsRepository.bulkUpdateStatus(ids, isActive)
    await AuditService.log('BULK', 'metric_unit', 'BULK', userId || null, { ids }, { is_active: isActive })
  }

  async filterOptions() {
    return {
      metric_types: VALID_METRIC_TYPES,
      statuses: [true, false]
    }
  }
}

export const metricUnitsService = new MetricUnitsService()
