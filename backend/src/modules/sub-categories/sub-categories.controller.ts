import { Request, Response } from 'express'
import { subCategoriesService } from './sub-categories.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { SubCategoryErrors } from './sub-categories.errors'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  subCategoryIdSchema,
  categoryIdSchema,
  CreateSubCategorySchema,
  UpdateSubCategorySchema,
  BulkDeleteSchema,
} from './sub-categories.schema'

export class SubCategoriesController {
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const categoryId = req.query.category_id as string | undefined
      const result = await subCategoriesService.list({ page, limit }, req.sort, categoryId)
      sendSuccess(res, result.data, 'SubCategories retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list' })
    }
  }

  trash = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const result = await subCategoriesService.trash({ page, limit }, req.sort)
      sendSuccess(res, result.data, 'Trash retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'trash' })
    }
  }

  search = async (req: Request, res: Response): Promise<void> => {
    try {
      const q = (req.query.q as string) || ''
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const result = await subCategoriesService.search(q, { page, limit }, req.sort)
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search', query: req.query.q })
    }
  }

  getById = async (req: ValidatedAuthRequest<typeof subCategoryIdSchema>, res: Response): Promise<void> => {
    try {
      const { id } = req.validated.params
      const subCategory = await subCategoriesService.getById(id)
      if (!subCategory) throw SubCategoryErrors.NOT_FOUND(id)
      sendSuccess(res, subCategory, 'SubCategory retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'getById', id: req.validated?.params?.id })
    }
  }

  getByCategory = async (req: ValidatedAuthRequest<typeof categoryIdSchema>, res: Response): Promise<void> => {
    try {
      const { categoryId } = req.validated.params
      const subCategories = await subCategoriesService.getByCategory(categoryId)
      sendSuccess(res, subCategories, 'SubCategories retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'getByCategory', categoryId: req.validated?.params?.categoryId })
    }
  }

  create = async (req: ValidatedAuthRequest<typeof CreateSubCategorySchema>, res: Response): Promise<void> => {
    try {
      const subCategory = await subCategoriesService.create(req.validated.body, req.user?.id)
      sendSuccess(res, subCategory, 'SubCategory created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create' })
    }
  }

  update = async (req: ValidatedAuthRequest<typeof UpdateSubCategorySchema>, res: Response): Promise<void> => {
    try {
      const { params, body } = req.validated
      const subCategory = await subCategoriesService.update(params.id, body, req.user?.id)
      sendSuccess(res, subCategory, 'SubCategory updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update', id: req.validated?.params?.id })
    }
  }

  delete = async (req: ValidatedAuthRequest<typeof subCategoryIdSchema>, res: Response): Promise<void> => {
    try {
      const { id } = req.validated.params
      await subCategoriesService.delete(id, req.user?.id)
      sendSuccess(res, null, 'SubCategory deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete', id: req.validated?.params?.id })
    }
  }

  restore = async (req: ValidatedAuthRequest<typeof subCategoryIdSchema>, res: Response): Promise<void> => {
    try {
      const { id } = req.validated.params
      await subCategoriesService.restore(id, req.user?.id)
      const subCategory = await subCategoriesService.getById(id)
      sendSuccess(res, subCategory, 'SubCategory restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore', id: req.validated?.params?.id })
    }
  }

  bulkDelete = async (req: ValidatedAuthRequest<typeof BulkDeleteSchema>, res: Response): Promise<void> => {
    try {
      const { ids } = req.validated.body
      await subCategoriesService.bulkDelete(ids, req.user?.id)
      sendSuccess(res, null, 'SubCategories deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulkDelete' })
    }
  }
}

export const subCategoriesController = new SubCategoriesController()
