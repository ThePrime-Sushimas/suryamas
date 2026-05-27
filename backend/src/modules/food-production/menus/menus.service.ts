import { menusRepository } from './menus.repository'
import { MenuNotFoundError, MenuDuplicateError, MenuInUseError } from './menus.errors'
import { AuditService } from '../../monitoring/monitoring.service'
import { isPostgresError } from '../../../utils/postgres-error.util'
import type { CreateMenuDto, UpdateMenuDto, Menu, MenuWithRelations } from './menus.types'

export class MenusService {
  async list(companyIds: string[], pagination: { page: number; limit: number }, sort?: { field: string; order: string }, filter?: { is_active?: boolean; category_id?: string; group_id?: string; has_recipe?: boolean; sync_enabled?: boolean; search?: string }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await menusRepository.findAll(companyIds, { limit: pagination.limit, offset }, sort, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async search(companyIds: string[], q: string, pagination: { page: number; limit: number }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await menusRepository.search(companyIds, q, { limit: pagination.limit, offset })
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async getById(id: string, companyIds: string[]): Promise<MenuWithRelations> {
    const menu = await menusRepository.findByIdAccessible(id, companyIds)
    if (!menu) throw new MenuNotFoundError(id)
    return menu
  }

  async create(companyId: string, dto: CreateMenuDto, userId: string): Promise<Menu> {
    try {
      const menu = await menusRepository.create(companyId, { ...dto, created_by: userId, updated_by: userId })
      await AuditService.log('CREATE', 'menu', menu.id, userId, undefined, menu)
      return menu
    } catch (err: unknown) {
      if (isPostgresError(err, '23505')) throw new MenuDuplicateError(dto.menu_code)
      throw err
    }
  }

  async update(id: string, companyId: string, dto: UpdateMenuDto, userId: string, existing?: MenuWithRelations): Promise<Menu> {
    const record = existing ?? await menusRepository.findById(id, companyId)
    if (!record) throw new MenuNotFoundError(id)

    const updated = await menusRepository.update(id, companyId, { ...dto, updated_by: userId })
    if (!updated) throw new MenuNotFoundError(id)

    await AuditService.log('UPDATE', 'menu', id, userId, record, updated)
    return updated
  }

  async delete(id: string, companyId: string, userId: string, existing?: MenuWithRelations): Promise<void> {
    const record = existing ?? await menusRepository.findById(id, companyId)
    if (!record) throw new MenuNotFoundError(id)

    const hasRecipes = await menusRepository.hasRecipeLines(id)
    if (hasRecipes) throw new MenuInUseError()

    const hasCogs = await menusRepository.hasCogcCalculationLines(id)
    if (hasCogs) throw new MenuInUseError()

    await menusRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'menu', id, userId, record)
  }

  async restore(id: string, companyId: string, userId: string, existing?: MenuWithRelations): Promise<void> {
    const restored = await menusRepository.restore(id, companyId, userId)
    if (!restored) throw new MenuNotFoundError(id)
    await AuditService.log('RESTORE', 'menu', id, userId, existing)
  }

  async syncFromPos(companyId: string, userId: string, force: boolean): Promise<{ inserted: number; updated: number; skipped: number }> {
    const result = await menusRepository.batchSyncFromPos(companyId, force)
    await AuditService.log('UPDATE', 'menu_sync', 'bulk', userId, undefined, result)
    return result
  }
}

export const menusService = new MenusService()
