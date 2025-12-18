import { categoriesRepository } from './categories.repository'
import { Category, CreateCategoryDto, UpdateCategoryDto } from '../../types/category.types'
import { AuditService } from '../../services/audit.service'
import { logError, logInfo } from '../../config/logger'

export class CategoriesService {
  async list(pagination: { page: number; limit: number }, sort?: { field: string; order: 'asc' | 'desc' }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await categoriesRepository.findAll({ limit: pagination.limit, offset }, sort)

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
      throw new Error('category_code and category_name are required')
    }

    if (dto.category_code.length > 50) {
      throw new Error('category_code must not exceed 50 characters')
    }

    if (dto.category_name.length > 255) {
      throw new Error('category_name must not exceed 255 characters')
    }

    const existing = await categoriesRepository.findByCode(dto.category_code)
    if (existing) {
      throw new Error('category_code already exists')
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
      throw new Error('category_name must not exceed 255 characters')
    }

    const category = await categoriesRepository.updateById(id, {
      ...dto,
      updated_by: userId,
    })

    if (category && userId) {
      await AuditService.log('UPDATE', 'category', id, userId, undefined, dto)
    }

    logInfo('Category updated', { id })
    return category
  }

  async getById(id: string): Promise<Category | null> {
    return categoriesRepository.findById(id)
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
    await categoriesRepository.bulkDelete(ids, userId)

    if (userId) {
      await AuditService.log('DELETE', 'category', ids.join(','), userId)
    }

    logInfo('Bulk delete', { count: ids.length })
  }

  async exportToExcel(): Promise<Category[]> {
    return categoriesRepository.exportData()
  }
}

export const categoriesService = new CategoriesService()
