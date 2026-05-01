import type { Request, Response } from 'express'
import { categoriesService } from './categories.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  CreateCategorySchema, UpdateCategorySchema, UpdateStatusSchema, BulkDeleteSchema,
} from './categories.schema'
import { categoryIdSchema } from './categories.schema'

type CreateReq = ValidatedAuthRequest<typeof CreateCategorySchema>
type UpdateReq = ValidatedAuthRequest<typeof UpdateCategorySchema>
type StatusReq = ValidatedAuthRequest<typeof UpdateStatusSchema>
type BulkDeleteReq = ValidatedAuthRequest<typeof BulkDeleteSchema>
type IdReq = ValidatedAuthRequest<typeof categoryIdSchema>

export class CategoriesController {
  list = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const is_active = req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined
      const filter = is_active !== undefined ? { is_active } : undefined
      const result = await categoriesService.list({ page, limit }, req.sort, filter)
      sendSuccess(res, result.data, 'Categories retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_categories' })
    }
  }

  trash = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string || '1') || 1
      const limit = parseInt(req.query.limit as string || '10') || 10
      const result = await categoriesService.trash({ page, limit }, req.sort)
      sendSuccess(res, result.data, 'Trash retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_trash_categories' })
    }
  }

  search = async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string || '1') || 1
      const limit = parseInt(req.query.limit as string || '10') || 10
      const result = await categoriesService.search(q, { page, limit }, req.sort)
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_categories' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const category = await categoriesService.getById(id)
      sendSuccess(res, category, 'Category retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_category', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const category = await categoriesService.create(body, req.user?.id)
      sendSuccess(res, category, 'Category created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_category' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const category = await categoriesService.update(params.id, body, req.user?.id)
      sendSuccess(res, category, 'Category updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_category', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await categoriesService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Category deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_category', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await categoriesService.restore(id, req.user?.id)
      const category = await categoriesService.getById(id)
      sendSuccess(res, category, 'Category restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_category', id: req.params.id })
    }
  }

  bulkDelete = async (req: Request, res: Response) => {
    try {
      const { ids } = (req as BulkDeleteReq).validated.body
      await categoriesService.bulkDelete(ids, req.user?.id)
      sendSuccess(res, null, 'Categories deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_categories' })
    }
  }

  updateStatus = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as StatusReq).validated
      const category = await categoriesService.updateStatus(params.id, body.is_active, req.user?.id)
      sendSuccess(res, category, 'Category status updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_category_status', id: req.params.id })
    }
  }
}

export const categoriesController = new CategoriesController()
