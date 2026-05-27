import { warehousesRepository } from './warehouses.repository'
import { WarehouseNotFoundError, WarehouseDuplicateError, WarehouseInUseError } from './warehouses.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { isPostgresError } from '../../utils/postgres-error.util'
import type { CreateWarehouseDto, UpdateWarehouseDto, Warehouse, WarehouseWithBranch, WarehouseType } from './warehouses.types'

export class WarehousesService {
  async list(companyIds: string[], pagination: { page: number; limit: number }, sort?: { field: string; order: string }, filter?: { branch_id?: string; warehouse_type?: string; is_active?: boolean }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await warehousesRepository.findAll(companyIds, { limit: pagination.limit, offset }, sort, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async search(companyIds: string[], q: string, pagination: { page: number; limit: number }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await warehousesRepository.search(companyIds, q, { limit: pagination.limit, offset })
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async getById(id: string, companyIds: string[]): Promise<WarehouseWithBranch> {
    const warehouse = await warehousesRepository.findByIdAccessible(id, companyIds)
    if (!warehouse) throw new WarehouseNotFoundError(id)
    return warehouse
  }

  async getByBranch(branchId: string, companyIds: string[]): Promise<WarehouseWithBranch[]> {
    return warehousesRepository.findByBranch(branchId, companyIds)
  }

  async create(companyId: string, dto: CreateWarehouseDto, userId: string): Promise<Warehouse> {
    try {
      const warehouse = await warehousesRepository.create(companyId, { ...dto, created_by: userId, updated_by: userId })
      await AuditService.log('CREATE', 'warehouse', warehouse.id, userId, undefined, warehouse)
      return warehouse
    } catch (err: unknown) {
      if (isPostgresError(err, '23505')) throw new WarehouseDuplicateError(dto.warehouse_code)
      throw err
    }
  }

  async update(id: string, companyId: string, dto: UpdateWarehouseDto, userId: string, existing?: WarehouseWithBranch): Promise<Warehouse> {
    const record = existing ?? await warehousesRepository.findById(id, companyId)
    if (!record) throw new WarehouseNotFoundError(id)

    const updated = await warehousesRepository.update(id, companyId, { ...dto, updated_by: userId })
    if (!updated) throw new WarehouseNotFoundError(id)

    await AuditService.log('UPDATE', 'warehouse', id, userId, record, updated)
    return updated
  }

  async delete(id: string, companyId: string, userId: string, existing?: WarehouseWithBranch): Promise<void> {
    const record = existing ?? await warehousesRepository.findById(id, companyId)
    if (!record) throw new WarehouseNotFoundError(id)

    const hasChildren = await warehousesRepository.hasChildren(id)
    if (hasChildren) throw new WarehouseInUseError()

    const hasMovements = await warehousesRepository.hasMovements(id)
    if (hasMovements) throw new WarehouseInUseError()

    await warehousesRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'warehouse', id, userId, record)
  }

  async restore(id: string, companyId: string, userId: string): Promise<void> {
    const restored = await warehousesRepository.restore(id, companyId, userId)
    if (!restored) throw new WarehouseNotFoundError(id)
    await AuditService.log('RESTORE', 'warehouse', id, userId)
  }

  /**
   * Create default warehouses (MAIN + READY) for a branch.
   * Called when a new operational branch is created.
   */
  async createDefaultForBranch(companyId: string, branchId: string, branchCode: string, userId: string): Promise<Warehouse[]> {
    const defaults: { code: string; name: string; type: WarehouseType }[] = [
      { code: `${branchCode}-MAIN`, name: `Gudang Utama ${branchCode}`, type: 'MAIN' },
      { code: `${branchCode}-READY`, name: `Gudang Ready ${branchCode}`, type: 'READY' },
    ]

    const results: Warehouse[] = []
    for (const d of defaults) {
      const existing = await warehousesRepository.findByCode(d.code, companyId)
      if (!existing) {
        const warehouse = await this.create(companyId, {
          branch_id: branchId,
          warehouse_code: d.code,
          warehouse_name: d.name,
          warehouse_type: d.type,
        }, userId)
        results.push(warehouse)
      }
    }
    return results
  }
}

export const warehousesService = new WarehousesService()
