import { menuGroupsRepository } from './menu-groups.repository'
import { MenuGroupNotFoundError, MenuGroupDuplicateError, MenuGroupInUseError } from './menu-groups.errors'
import { AuditService } from '../../monitoring/monitoring.service'
import { isPostgresError } from '../../../utils/postgres-error.util'
import type { CreateMenuGroupDto, UpdateMenuGroupDto, MenuGroup, MenuGroupWithCategory } from './menu-groups.types'

export class MenuGroupsService {
  async list(companyIds: string[], pagination: { page: number; limit: number }, sort?: { field: string; order: string }, filter?: { is_active?: boolean; category_id?: string }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await menuGroupsRepository.findAll(companyIds, { limit: pagination.limit, offset }, sort, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async search(companyIds: string[], q: string, pagination: { page: number; limit: number }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await menuGroupsRepository.search(companyIds, q, { limit: pagination.limit, offset })
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async getById(id: string, companyIds: string[]): Promise<MenuGroupWithCategory> {
    const group = await menuGroupsRepository.findByIdAccessible(id, companyIds)
    if (!group) throw new MenuGroupNotFoundError(id)
    return group
  }

  async create(companyId: string, dto: CreateMenuGroupDto, userId: string): Promise<MenuGroup> {
    try {
      const group = await menuGroupsRepository.create(companyId, { ...dto, created_by: userId, updated_by: userId })
      await AuditService.log('CREATE', 'menu_group', group.id, userId, undefined, group)
      return group
    } catch (err: unknown) {
      if (isPostgresError(err, '23505')) throw new MenuGroupDuplicateError(dto.group_code)
      throw err
    }
  }

  async update(id: string, companyId: string, dto: UpdateMenuGroupDto, userId: string, existing?: MenuGroupWithCategory): Promise<MenuGroup> {
    const record = existing ?? await menuGroupsRepository.findById(id, companyId)
    if (!record) throw new MenuGroupNotFoundError(id)

    const updated = await menuGroupsRepository.update(id, companyId, { ...dto, updated_by: userId })
    if (!updated) throw new MenuGroupNotFoundError(id)

    await AuditService.log('UPDATE', 'menu_group', id, userId, record, updated)
    return updated
  }

  async delete(id: string, companyId: string, userId: string, existing?: MenuGroupWithCategory): Promise<void> {
    const record = existing ?? await menuGroupsRepository.findById(id, companyId)
    if (!record) throw new MenuGroupNotFoundError(id)

    const hasMenus = await menuGroupsRepository.hasMenus(id)
    if (hasMenus) throw new MenuGroupInUseError()

    await menuGroupsRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'menu_group', id, userId, record)
  }

  async restore(id: string, companyId: string, userId: string): Promise<void> {
    const restored = await menuGroupsRepository.restore(id, companyId, userId)
    if (!restored) throw new MenuGroupNotFoundError(id)
    await AuditService.log('RESTORE', 'menu_group', id, userId)
  }
}

export const menuGroupsService = new MenuGroupsService()
