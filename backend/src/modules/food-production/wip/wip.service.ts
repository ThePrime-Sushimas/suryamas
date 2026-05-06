import { wipRepository } from './wip.repository'
import { WipItemNotFoundError, WipItemDuplicateError, WipItemInUseError } from './wip.errors'
import { AuditService } from '../../monitoring/monitoring.service'
import { isPostgresError } from '../../../utils/postgres-error.util'
import { recipesService } from '../recipes/recipes.service'
import type { CreateWipItemDto, UpdateWipItemDto, WipItem, WipItemWithIngredients } from './wip.types'

export class WipService {
  async list(companyId: string, pagination: { page: number; limit: number }, filter?: { is_active?: boolean }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await wipRepository.findAll(companyId, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async search(companyId: string, q: string, pagination: { page: number; limit: number }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await wipRepository.search(companyId, q, { limit: pagination.limit, offset })
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async getById(id: string, companyId: string): Promise<WipItemWithIngredients> {
    const item = await wipRepository.findByIdWithIngredients(id, companyId)
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

  async update(id: string, companyId: string, dto: UpdateWipItemDto, userId: string): Promise<WipItem> {
    const existing = await wipRepository.findById(id, companyId)
    if (!existing) throw new WipItemNotFoundError(id)

    const updated = await wipRepository.update(id, companyId, { ...dto, updated_by: userId })
    if (!updated) throw new WipItemNotFoundError(id)

    await AuditService.log('UPDATE', 'wip_item', id, userId, existing, updated)

    // Auto-propagate cost to recipe_lines → menus if yield_qty or ingredients changed
    // NOTE: This runs in a separate transaction from the WIP update above.
    // If propagation fails, WIP is updated but menus may be stale — acceptable trade-off,
    // can be retried via POST /recipes/recalculate/wip/:wipId
    const costChanged = (dto.yield_qty !== undefined && dto.yield_qty !== Number(existing.yield_qty)) || dto.ingredients !== undefined
    if (costChanged) {
      await recipesService.recalculateCostFromWip(id, companyId, userId)
    }

    return updated
  }

  async delete(id: string, companyId: string, userId: string): Promise<void> {
    const existing = await wipRepository.findById(id, companyId)
    if (!existing) throw new WipItemNotFoundError(id)

    const hasRecipes = await wipRepository.hasRecipeLines(id)
    if (hasRecipes) throw new WipItemInUseError()

    await wipRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'wip_item', id, userId, existing)
  }

  async restore(id: string, companyId: string, userId: string): Promise<void> {
    const restored = await wipRepository.restore(id, companyId, userId)
    if (!restored) throw new WipItemNotFoundError(id)
    await AuditService.log('RESTORE', 'wip_item', id, userId)
  }
}

export const wipService = new WipService()
