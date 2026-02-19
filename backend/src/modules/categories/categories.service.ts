import { categoriesRepository } from './categories.repository'
import { Category, CreateCategoryDto, UpdateCategoryDto } from './categories.types'
import { CategoryErrors } from './categories.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { logError, logInfo } from '../../config/logger'

export class CategoriesService {
  async list(pagination: { page: number; limit: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: { is_active?: boolean }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await categoriesRepository.findAll({ limit: pagination.limit, offset }, sort, filter)

    const totalPages = Math.ceil(total / pagination.limit)
    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    }
  }

  async trash(pagination: { page: number; limit: number }, sort?: { field: string; order: 'asc' | 'desc' }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await categoriesRepository.findTrash({ limit: pagination.limit, offset }, sort)

    const totalPages = Math.ceil(total / pagination.limit)
    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    }
  }

  async search(q: string, pagination: { page: number; limit: number }, sort?: { field: string; order: 'asc' | 'desc' }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await categoriesRepository.search(q, { limit: pagination.limit, offset }, sort)

    const totalPages = Math.ceil(total / pagination.limit)
    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    }
  }

  async create(dto: CreateCategoryDto, userId?: string): Promise<Category> {
    if (!dto.category_code || !dto.category_name) {
      throw CategoryErrors.INVALID_NAME()
    }

    if (dto.category_code.length > 50) {
      throw CategoryErrors.INVALID_CODE()
    }

    if (dto.category_name.length > 255) {
      throw CategoryErrors.INVALID_NAME()
    }

    const existing = await categoriesRepository.findByCode(dto.category_code)
    if (existing) {
      throw CategoryErrors.ALREADY_EXISTS(dto.category_code)
    }

    const category = await categoriesRepository.create({
      ...dto,
      created_by: userId,
      updated_by: userId,
    })

    if (userId) {
      await AuditService.log('CREATE', 'category', category.id, userId, undefined, category)
    }

    logInfo('Category created', { id: category.id, code: category.category_code })
    return category
  }

  async update(id: string, dto: UpdateCategoryDto, userId?: string): Promise<Category | null> {
    if (dto.category_name && dto.category_name.length > 255) {
      throw CategoryErrors.INVALID_NAME()
    }

    const category = await categoriesRepository.updateById(id, {
      ...dto,
      updated_by: userId,
    })

    if (!category) {
      throw CategoryErrors.NOT_FOUND()
    }

    if (userId) {
      await AuditService.log('UPDATE', 'category', id, userId, undefined, dto)
    }

    logInfo('Category updated', { id })
    return category
  }

  async getById(id: string): Promise<Category> {
    const category = await categoriesRepository.findById(id)
    if (!category) {
      throw CategoryErrors.NOT_FOUND()
    }
    return category
  }

  async delete(id: string, userId?: string): Promise<void> {
    try {
      await categoriesRepository.softDelete(id, userId)

      if (userId) {
        await AuditService.log('DELETE', 'category', id, userId)
      }

      logInfo('Category deleted', { id })
    } catch (error: any) {
      logError('Delete category failed', { id, error: error.message })
      throw error
    }
  }

  async restore(id: string, userId?: string): Promise<void> {
    try {
      await categoriesRepository.restore(id, userId)

      if (userId) {
        await AuditService.log('RESTORE', 'category', id, userId)
      }

      logInfo('Category restored', { id })
    } catch (error: any) {
      logError('Restore category failed', { id, error: error.message })
      throw error
    }
  }

  async bulkDelete(ids: string[], userId?: string): Promise<void> {
    if (!ids || ids.length === 0) {
      throw new Error('Please select at least one category')
    }

    try {
      await categoriesRepository.bulkDelete(ids, userId)

      if (userId) {
        await AuditService.log('DELETE', 'category', ids.join(','), userId)
      }

      logInfo('Bulk delete completed', { count: ids.length })
    } catch (error: any) {
      logError('Bulk delete failed', { ids, error: error.message })
      throw error
    }
  }

  async updateStatus(id: string, is_active: boolean, userId?: string): Promise<Category | null> {
    const category = await categoriesRepository.updateStatus(id, is_active, userId)

    if (category && userId) {
      await AuditService.log('UPDATE', 'category', id, userId, undefined, { is_active })
    }

    logInfo('Category status updated', { id, is_active })
    return category
  }

  async exportToExcel(): Promise<Category[]> {
    return categoriesRepository.exportData()
  }
}

export const categoriesService = new CategoriesService()
