import { menuCategoriesRepository } from './menu-categories.repository'
import { MenuCategoryNotFoundError, MenuCategoryDuplicateError, MenuCategoryInUseError } from './menu-categories.errors'
import { AuditService } from '../../monitoring/monitoring.service'
import { isPostgresError } from '../../../utils/postgres-error.util'
import type { CreateMenuCategoryDto, UpdateMenuCategoryDto, MenuCategory, MenuCategoryWithCoa } from './menu-categories.types'

export class MenuCategoriesService {
  async list(companyIds: string[], pagination: { page: number; limit: number }, sort?: { field: string; order: string }, filter?: { is_active?: boolean }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await menuCategoriesRepository.findAll(companyIds, { limit: pagination.limit, offset }, sort, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async search(companyIds: string[], q: string, pagination: { page: number; limit: number }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await menuCategoriesRepository.search(companyIds, q, { limit: pagination.limit, offset })
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async getById(id: string, companyIds: string[]): Promise<MenuCategoryWithCoa> {
    const category = await menuCategoriesRepository.findByIdAccessible(id, companyIds)
    if (!category) throw new MenuCategoryNotFoundError(id)
    return category
  }

  async create(companyId: string, dto: CreateMenuCategoryDto, userId: string): Promise<MenuCategory> {
    try {
      const category = await menuCategoriesRepository.create(companyId, { ...dto, created_by: userId, updated_by: userId })
      await AuditService.log('CREATE', 'menu_category', category.id, userId, undefined, category)
      return category
    } catch (err: unknown) {
      if (isPostgresError(err, '23505')) throw new MenuCategoryDuplicateError(dto.category_code)
      throw err
    }
  }

  async update(id: string, companyId: string, dto: UpdateMenuCategoryDto, userId: string, existing?: MenuCategoryWithCoa): Promise<MenuCategory> {
    const record = existing ?? await menuCategoriesRepository.findById(id, companyId)
    if (!record) throw new MenuCategoryNotFoundError(id)

    const updated = await menuCategoriesRepository.update(id, companyId, { ...dto, updated_by: userId })
    if (!updated) throw new MenuCategoryNotFoundError(id)

    await AuditService.log('UPDATE', 'menu_category', id, userId, record, updated)
    return updated
  }

  async delete(id: string, companyId: string, userId: string, existing?: MenuCategoryWithCoa): Promise<void> {
    const record = existing ?? await menuCategoriesRepository.findById(id, companyId)
    if (!record) throw new MenuCategoryNotFoundError(id)

    const hasChildren = await menuCategoriesRepository.hasChildren(id)
    if (hasChildren) throw new MenuCategoryInUseError()

    await menuCategoriesRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'menu_category', id, userId, record)
  }

  async restore(id: string, companyId: string, userId: string): Promise<void> {
    const restored = await menuCategoriesRepository.restore(id, companyId, userId)
    if (!restored) throw new MenuCategoryNotFoundError(id)
    await AuditService.log('RESTORE', 'menu_category', id, userId)
  }
}

export const menuCategoriesService = new MenuCategoriesService()
