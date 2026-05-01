import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { subCategoriesService } from './sub-categories.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { SubCategoryErrors } from './sub-categories.errors'
import type {
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
      await handleError(res, error, req, { action: 'list_sub_categories' })
    }
  }

  trash = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = req.pagination?.page || parseInt(req.query.page as string) || 1
      const limit = req.pagination?.limit || parseInt(req.query.limit as string) || 10
      const result = await subCategoriesService.trash({ page, limit }, req.sort)
      sendSuccess(res, result.data, 'Trash retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_sub_categories_trash' })
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
      await handleError(res, error, req, { action: 'search_sub_categories' })
    }
  }

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof subCategoryIdSchema>).validated
      const subCategory = await subCategoriesService.getById(params.id)
      if (!subCategory) throw SubCategoryErrors.NOT_FOUND(params.id)
      sendSuccess(res, subCategory, 'SubCategory retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_sub_category' })
    }
  }

  getByCategory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof categoryIdSchema>).validated
      const subCategories = await subCategoriesService.getByCategory(params.categoryId)
      sendSuccess(res, subCategories, 'SubCategories retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_sub_categories_by_category' })
    }
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof CreateSubCategorySchema>).validated
      const subCategory = await subCategoriesService.create(body, req.user?.id)
      sendSuccess(res, subCategory, 'SubCategory created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_sub_category' })
    }
  }

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof UpdateSubCategorySchema>).validated
      const subCategory = await subCategoriesService.update(params.id, body, req.user?.id)
      sendSuccess(res, subCategory, 'SubCategory updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_sub_category' })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof subCategoryIdSchema>).validated
      await subCategoriesService.delete(params.id, req.user?.id)
      sendSuccess(res, null, 'SubCategory deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_sub_category' })
    }
  }

  restore = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof subCategoryIdSchema>).validated
      await subCategoriesService.restore(params.id, req.user?.id)
      const subCategory = await subCategoriesService.getById(params.id)
      sendSuccess(res, subCategory, 'SubCategory restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_sub_category' })
    }
  }

  bulkDelete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof BulkDeleteSchema>).validated
      await subCategoriesService.bulkDelete(body.ids, req.user?.id)
      sendSuccess(res, null, 'SubCategories deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_sub_categories' })
    }
  }
}

export const subCategoriesController = new SubCategoriesController()
