import type { Response } from 'express'
import { categoriesService } from './categories.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import { getParamString, getQueryString } from '../../utils/validation.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { AuthRequest } from '../../types/common.types'
import type {
  CreateCategorySchema,
  UpdateCategorySchema,
  UpdateStatusSchema,
  BulkDeleteSchema,
} from './categories.schema'

type CreateCategoryReq = ValidatedAuthRequest<typeof CreateCategorySchema>
type UpdateCategoryReq = ValidatedAuthRequest<typeof UpdateCategorySchema>
type UpdateStatusReq = ValidatedAuthRequest<typeof UpdateStatusSchema>
type BulkDeleteReq = ValidatedAuthRequest<typeof BulkDeleteSchema>

interface SortInfo { field: string; order: 'asc' | 'desc' }

export class CategoriesController {
  list = async (req: AuthRequest & { sort?: SortInfo }, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const is_active = req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined
      const filter = is_active !== undefined ? { is_active } : undefined
      const result = await categoriesService.list({ page, limit }, req.sort, filter)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Categories retrieved successfully',
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'list', page: req.query.page })
    }
  }

  trash = async (req: AuthRequest & { sort?: SortInfo }, res: Response): Promise<void> => {
    try {
      const page = parseInt(getQueryString(req.query.page) || '1') || 1
      const limit = parseInt(getQueryString(req.query.limit) || '10') || 10
      const result = await categoriesService.trash({ page, limit }, req.sort)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Trash retrieved successfully',
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'trash' })
    }
  }

  search = async (req: AuthRequest & { sort?: SortInfo }, res: Response): Promise<void> => {
    try {
      const q = getQueryString(req.query.q) || ''
      const page = parseInt(getQueryString(req.query.page) || '1') || 1
      const limit = parseInt(getQueryString(req.query.limit) || '10') || 10
      const result = await categoriesService.search(q, { page, limit }, req.sort)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Search completed',
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'search', q: req.query.q })
    }
  }

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = getParamString(req.params.id)
      const category = await categoriesService.getById(id)
      sendSuccess(res, category, 'Category retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'getById', id: req.params.id })
    }
  }

  create = withValidated(async (req: CreateCategoryReq, res: Response) => {
    try {
      const category = await categoriesService.create(req.validated.body, req.user?.id)
      sendSuccess(res, category, 'Category created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'create' })
    }
  })

  update = withValidated(async (req: UpdateCategoryReq, res: Response) => {
    try {
      const { params, body } = req.validated
      const category = await categoriesService.update(params.id, body, req.user?.id)
      sendSuccess(res, category, 'Category updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'update', id: req.validated.params.id })
    }
  })

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = getParamString(req.params.id)
      await categoriesService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Category deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'delete', id: req.params.id })
    }
  }

  restore = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = getParamString(req.params.id)
      await categoriesService.restore(id, req.user?.id)
      const category = await categoriesService.getById(id)
      sendSuccess(res, category, 'Category restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'restore', id: req.params.id })
    }
  }

  bulkDelete = withValidated(async (req: BulkDeleteReq, res: Response) => {
    try {
      const { ids } = req.validated.body
      await categoriesService.bulkDelete(ids, req.user?.id)
      sendSuccess(res, null, 'Categories deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'bulkDelete', count: req.validated.body.ids.length })
    }
  })

  updateStatus = withValidated(async (req: UpdateStatusReq, res: Response) => {
    try {
      const { params, body } = req.validated
      const category = await categoriesService.updateStatus(params.id, body.is_active, req.user?.id)
      sendSuccess(res, category, 'Category status updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { method: 'updateStatus', id: req.validated.params.id })
    }
  })
}

export const categoriesController = new CategoriesController()
