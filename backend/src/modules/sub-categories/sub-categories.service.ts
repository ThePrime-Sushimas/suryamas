import { subCategoriesRepository } from './sub-categories.repository'
import { SubCategory, SubCategoryWithCategory, CreateSubCategoryDto, UpdateSubCategoryDto } from '../categories/categories.types'
import { categoriesRepository } from '../categories/categories.repository'
import { AuditService } from '../monitoring/monitoring.service'
import { logInfo } from '../../config/logger'
import { SubCategoryErrors } from './sub-categories.errors'

export class SubCategoriesService {
  async list(pagination: { page: number; limit: number }, sort?: { field: string; order: 'asc' | 'desc' }, categoryId?: string) {
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

  async trash(pagination: { page: number; limit: number }, sort?: { field: string; order: 'asc' | 'desc' }) {
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

  async search(q: string, pagination: { page: number; limit: number }, sort?: { field: string; order: 'asc' | 'desc' }) {
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
      throw SubCategoryErrors.VALIDATION_ERROR('Category, code, and name are required')
    }

    if (dto.sub_category_code.length > 50) {
      throw SubCategoryErrors.INVALID_CODE()
    }

    if (dto.sub_category_name.length > 255) {
      throw SubCategoryErrors.INVALID_NAME()
    }

    const category = await categoriesRepository.findById(dto.category_id)
    if (!category) {
      throw SubCategoryErrors.CATEGORY_REQUIRED()
    }

    const existing = await subCategoriesRepository.findByCode(dto.sub_category_code, dto.category_id)
    if (existing) {
      throw SubCategoryErrors.CODE_EXISTS(dto.sub_category_code)
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
      throw SubCategoryErrors.INVALID_NAME()
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
    await subCategoriesRepository.softDelete(id, userId)

    if (userId) {
      await AuditService.log('DELETE', 'sub_category', id, userId)
    }

    logInfo('SubCategory deleted', { id })
  }

  async restore(id: string, userId?: string): Promise<void> {
    await subCategoriesRepository.restore(id, userId)

    if (userId) {
      await AuditService.log('RESTORE', 'sub_category', id, userId)
    }

    logInfo('SubCategory restored', { id })
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
