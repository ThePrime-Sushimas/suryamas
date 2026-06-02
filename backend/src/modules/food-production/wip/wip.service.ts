import { wipRepository } from './wip.repository'
import { WipItemNotFoundError, WipItemDuplicateError, WipItemInUseError } from './wip.errors'
import { AuditService } from '../../monitoring/monitoring.service'
import { isPostgresError } from '../../../utils/postgres-error.util'
import { recipesService } from '../recipes/recipes.service'
import type { CreateWipItemDto, UpdateWipItemDto, WipItem, WipItemWithIngredients, WipItemWithPositions } from './wip.types'

export class WipService {
  async list(companyIds: string[], pagination: { page: number; limit: number }, filter?: { is_active?: boolean; positionIds?: string[]; canAccessAll?: boolean; companyId?: string }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await wipRepository.findAll(companyIds, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async listWithPositions(companyIds: string[], pagination: { page: number; limit: number }, filter?: { is_active?: boolean; positionIds?: string[]; canAccessAll?: boolean; companyId?: string; positionFilter?: string[] }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await wipRepository.findAllWithPositions(companyIds, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async search(companyIds: string[], q: string, pagination: { page: number; limit: number }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await wipRepository.search(companyIds, q, { limit: pagination.limit, offset })
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async getById(id: string, companyIds: string[]): Promise<WipItemWithIngredients> {
    const item = await wipRepository.findByIdWithIngredientsAccessible(id, companyIds)
    if (!item) throw new WipItemNotFoundError(id)
    return item
  }

  async create(companyId: string, dto: CreateWipItemDto, userId: string): Promise<WipItem> {
    try {
      const item = await wipRepository.create(companyId, { ...dto, created_by: userId, updated_by: userId })
      await AuditService.log('CREATE', 'wip_item', item.id, userId, undefined, item)
      return item
    } catch (err: unknown) {
      if (isPostgresError(err, '23505')) throw new WipItemDuplicateError(dto.wip_code)
      throw err
    }
  }

  async update(id: string, companyId: string, dto: UpdateWipItemDto, userId: string, existing?: WipItem): Promise<WipItem> {
    const record = existing ?? await wipRepository.findById(id, companyId)
    if (!record) throw new WipItemNotFoundError(id)

    const updated = await wipRepository.update(id, companyId, { ...dto, updated_by: userId })
    if (!updated) throw new WipItemNotFoundError(id)

    await AuditService.log('UPDATE', 'wip_item', id, userId, record, updated)

    const costChanged = (dto.yield_qty !== undefined && dto.yield_qty !== Number(record.yield_qty)) || dto.ingredients !== undefined
    if (costChanged) {
      await recipesService.recalculateCostFromWip(id, companyId, userId)
    }

    return updated
  }

  async delete(id: string, companyId: string, userId: string, existing?: WipItem): Promise<void> {
    const record = existing ?? await wipRepository.findById(id, companyId)
    if (!record) throw new WipItemNotFoundError(id)

    const hasRecipes = await wipRepository.hasRecipeLines(id)
    if (hasRecipes) throw new WipItemInUseError()

    await wipRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'wip_item', id, userId, record)
  }

  async restore(id: string, companyId: string, userId: string, existing?: WipItem): Promise<void> {
    const restored = await wipRepository.restore(id, companyId, userId)
    if (!restored) throw new WipItemNotFoundError(id)
    await AuditService.log('RESTORE', 'wip_item', id, userId, existing)
  }
}

export const wipService = new WipService()
