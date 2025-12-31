import { MetricUnitsService } from './metricUnits.service'
import { metricUnitsRepository } from './metricUnits.repository'
import { AuditService } from '../../services/audit.service'
import { MetricUnitNotFoundError, DuplicateMetricUnitError } from './metricUnits.errors'
import { createPaginatedResponse } from '../../utils/pagination.util'

jest.mock('./metricUnits.repository')
jest.mock('../../services/audit.service')

describe('MetricUnitsService', () => {
  let service: MetricUnitsService
  const mockRepository = metricUnitsRepository as jest.Mocked<typeof metricUnitsRepository>
  const mockAuditService = AuditService as jest.Mocked<typeof AuditService>

  beforeEach(() => {
    service = new MetricUnitsService()
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('should return paginated metric units', async () => {
      const mockData = [{ id: '1', metric_type: 'Unit', unit_name: 'kg' }]
      mockRepository.list.mockResolvedValue({ data: mockData as any, total: 1 })

      const result = await service.list({ page: 1, limit: 10, offset: 0 })

      expect(result.data).toEqual(mockData)
      expect(result.pagination.total).toBe(1)
    })
  })

  describe('listActive', () => {
    it('should return paginated active metric units', async () => {
      const mockData = [{ id: '1', metric_type: 'Unit', unit_name: 'kg', is_active: true }]
      mockRepository.listActiveFromView.mockResolvedValue({ data: mockData as any, total: 1 })

      const result = await service.listActive({ page: 1, limit: 10, offset: 0 })

      expect(result.data).toEqual(mockData)
      expect(result.pagination.total).toBe(1)
    })
  })

  describe('getById', () => {
    it('should return metric unit when found', async () => {
      const mockUnit = { id: '123', metric_type: 'Unit', unit_name: 'kg', is_active: true }
      mockRepository.findById.mockResolvedValue(mockUnit as any)

      const result = await service.getById('123')

      expect(result).toEqual(mockUnit)
      expect(mockRepository.findById).toHaveBeenCalledWith('123')
    })

    it('should throw MetricUnitNotFoundError when not found', async () => {
      mockRepository.findById.mockResolvedValue(null)

      await expect(service.getById('123')).rejects.toThrow(MetricUnitNotFoundError)
    })
  })

  describe('create', () => {
    it('should create metric unit successfully', async () => {
      const dto = { metric_type: 'Unit' as const, unit_name: 'kg' }
      const created = { id: '123', ...dto, is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01', created_by: 'user123' }
      mockRepository.create.mockResolvedValue(created as any)

      const result = await service.create(dto, 'user123')

      expect(result).toEqual(created)
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...dto,
        is_active: true,
        created_by: 'user123'
      })
      expect(mockAuditService.log).toHaveBeenCalled()
    })

    it('should throw DuplicateMetricUnitError on unique constraint violation', async () => {
      const dto = { metric_type: 'Unit' as const, unit_name: 'kg' }
      mockRepository.create.mockRejectedValue({ code: '23505' })

      await expect(service.create(dto, 'user123')).rejects.toThrow(DuplicateMetricUnitError)
    })
  })

  describe('update', () => {
    it('should update metric unit successfully', async () => {
      const existing = { id: '123', metric_type: 'Unit', unit_name: 'kg', is_active: true }
      const dto = { unit_name: 'kilogram' }
      const updated = { ...existing, ...dto, updated_by: 'user123' }
      
      mockRepository.findById.mockResolvedValue(existing as any)
      mockRepository.updateById.mockResolvedValue(updated as any)

      const result = await service.update('123', dto, 'user123')

      expect(result).toEqual(updated)
      expect(mockAuditService.log).toHaveBeenCalled()
    })

    it('should throw MetricUnitNotFoundError when updating non-existent unit', async () => {
      mockRepository.findById.mockResolvedValue(null)

      await expect(service.update('123', {}, 'user123')).rejects.toThrow(MetricUnitNotFoundError)
    })

    it('should throw DuplicateMetricUnitError on unique constraint violation', async () => {
      const existing = { id: '123', metric_type: 'Unit', unit_name: 'kg' }
      mockRepository.findById.mockResolvedValue(existing as any)
      mockRepository.updateById.mockRejectedValue({ code: '23505' })

      await expect(service.update('123', { unit_name: 'gram' }, 'user123')).rejects.toThrow(DuplicateMetricUnitError)
    })
  })

  describe('delete', () => {
    it('should delete metric unit successfully', async () => {
      const existing = { id: '123', metric_type: 'Unit', unit_name: 'kg' }
      mockRepository.findById.mockResolvedValue(existing as any)
      mockRepository.updateById.mockResolvedValue({ ...existing, is_active: false } as any)

      await service.delete('123', 'user123')

      expect(mockRepository.updateById).toHaveBeenCalledWith('123', { is_active: false, updated_by: 'user123' })
      expect(mockAuditService.log).toHaveBeenCalled()
    })

    it('should throw MetricUnitNotFoundError when deleting non-existent unit', async () => {
      mockRepository.findById.mockResolvedValue(null)

      await expect(service.delete('123', 'user123')).rejects.toThrow(MetricUnitNotFoundError)
    })
  })

  describe('bulkUpdateStatus', () => {
    it('should update status for multiple units', async () => {
      const ids = ['123', '456']
      mockRepository.bulkUpdateStatus.mockResolvedValue()

      await service.bulkUpdateStatus(ids, false, 'user123')

      expect(mockRepository.bulkUpdateStatus).toHaveBeenCalledWith(ids, false)
      expect(mockAuditService.log).toHaveBeenCalled()
    })

    it('should throw error for empty ids array', async () => {
      mockRepository.bulkUpdateStatus.mockRejectedValue(new Error('No IDs provided for bulk update'))

      await expect(service.bulkUpdateStatus([], false, 'user123')).rejects.toThrow('No IDs provided')
    })
  })

  describe('filterOptions', () => {
    it('should return filter options', () => {
      const result = service.filterOptions()

      expect(result.metric_types).toEqual(['Unit', 'Volume', 'Weight'])
      expect(result.statuses).toHaveLength(2)
    })
  })
})
