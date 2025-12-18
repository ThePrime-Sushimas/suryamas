import { subCategoriesRepository } from './sub-categories.repository'
import { SubCategory, SubCategoryWithCategory, CreateSubCategoryDto, UpdateSubCategoryDto } from '../../types/category.types'
import { categoriesRepository } from '../categories/categories.repository'
import { AuditService } from '../../services/audit.service'
import { logError, logInfo } from '../../config/logger'

export class SubCategoriesService {
  async list(pagination: { page: number; limit: number }, sort?: { field: string; order: 'asc' | 'desc' }, categoryId?: string): Promise<any> {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await subCategoriesRepository.findAll({ limit: pagination.limit, offset }, sort, categoryId)

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

  async trash(pagination: { page: number; limit: number }, sort?: { field: string; order: 'asc' | 'desc' }): Promise<any> {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await subCategoriesRepository.findTrash({ limit: pagination.limit, offset }, sort)

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

  async search(q: string, pagination: { page: number; limit: number }, sort?: { field: string; order: 'asc' | 'desc' }): Promise<any> {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await subCategoriesRepository.search(q, { limit: pagination.limit, offset }, sort)

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

  async create(dto: CreateSubCategoryDto, userId?: string): Promise<SubCategory> {
    if (!dto.category_id || !dto.sub_category_code || !dto.sub_category_name) {
      throw new Error('category_id, sub_category_code, and sub_category_name are required')
    }

    if (dto.sub_category_code.length > 50) {
      throw new Error('sub_category_code must not exceed 50 characters')
    }

    if (dto.sub_category_name.length > 255) {
      throw new Error('sub_category_name must not exceed 255 characters')
    }

    const category = await categoriesRepository.findById(dto.category_id)
    if (!category) {
      throw new Error('Category not found')
    }

    const existing = await subCategoriesRepository.findByCode(dto.sub_category_code, dto.category_id)
    if (existing) {
      throw new Error('sub_category_code already exists for this category')
    }

    const subCategory = await subCategoriesRepository.create({
      ...dto,
      created_by: userId,
      updated_by: userId,
    })

    if (userId) {
      await AuditService.log('CREATE', 'sub_category', subCategory.id, userId, undefined, subCategory)
    }

    logInfo('SubCategory created', { id: subCategory.id, code: subCategory.sub_category_code })
    return subCategory
  }

  async update(id: string, dto: UpdateSubCategoryDto, userId?: string): Promise<SubCategory | null> {
    if (dto.sub_category_name && dto.sub_category_name.length > 255) {
      throw new Error('sub_category_name must not exceed 255 characters')
    }

    const subCategory = await subCategoriesRepository.updateById(id, {
      ...dto,
      updated_by: userId,
    })

    if (subCategory && userId) {
      await AuditService.log('UPDATE', 'sub_category', id, userId, undefined, dto)
    }

    logInfo('SubCategory updated', { id })
    return subCategory
  }

  async getById(id: string): Promise<SubCategoryWithCategory | null> {
    return subCategoriesRepository.findById(id)
  }

  async getByCategory(categoryId: string): Promise<SubCategory[]> {
    return subCategoriesRepository.findByCategory(categoryId)
  }

  async delete(id: string, userId?: string): Promise<void> {
    try {
      await subCategoriesRepository.softDelete(id, userId)

      if (userId) {
        await AuditService.log('DELETE', 'sub_category', id, userId)
      }

      logInfo('SubCategory deleted', { id })
    } catch (error: any) {
      logError('Delete sub_category failed', { id, error: error.message })
      throw error
    }
  }

  async restore(id: string, userId?: string): Promise<void> {
    try {
      await subCategoriesRepository.restore(id, userId)

      if (userId) {
        await AuditService.log('RESTORE', 'sub_category', id, userId)
      }

      logInfo('SubCategory restored', { id })
    } catch (error: any) {
      logError('Restore sub_category failed', { id, error: error.message })
      throw error
    }
  }

  async bulkDelete(ids: string[], userId?: string): Promise<void> {
    await subCategoriesRepository.bulkDelete(ids, userId)

    if (userId) {
      await AuditService.log('DELETE', 'sub_category', ids.join(','), userId)
    }

    logInfo('Bulk delete', { count: ids.length })
  }

  async exportToExcel(): Promise<SubCategory[]> {
    return subCategoriesRepository.exportData()
  }
}

export const subCategoriesService = new SubCategoriesService()
