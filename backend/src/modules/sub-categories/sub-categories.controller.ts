import { Response, Request } from 'express'
import { AuthRequest } from '../../types/common.types'
import { subCategoriesService } from './sub-categories.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'

import { getParamString } from '../../utils/validation.util'
import type { ValidatedRequest } from '../../middleware/validation.middleware'
import {
  subCategoryIdSchema,
  categoryIdSchema,
  CreateSubCategorySchema,
  UpdateSubCategorySchema,
  BulkDeleteSchema,
} from './sub-categories.schema'

type SubCategoryIdReq = ValidatedRequest<typeof subCategoryIdSchema>
type CategoryIdReq = ValidatedRequest<typeof categoryIdSchema>
type CreateSubCategoryReq = ValidatedRequest<typeof CreateSubCategorySchema>
type UpdateSubCategoryReq = ValidatedRequest<typeof UpdateSubCategorySchema>
type BulkDeleteReq = ValidatedRequest<typeof BulkDeleteSchema>


export class SubCategoriesController {
  list = async (req: AuthRequest & { sort?: any }, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const categoryId = req.query.category_id as string
      const result = await subCategoriesService.list({ page, limit }, req.sort, categoryId)
      sendSuccess(res, result.data, 'SubCategories retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  trash = async (req: AuthRequest & { sort?: any }, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const result = await subCategoriesService.trash({ page, limit }, req.sort)
      sendSuccess(res, result.data, 'Trash retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  search = async (req: AuthRequest & { sort?: any }, res: Response): Promise<void> => {
    try {
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const result = await subCategoriesService.search(q, { page, limit }, req.sort)
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  }

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = getParamString(req.params.id)
      const subCategory = await subCategoriesService.getById(id)

      if (!subCategory) {
        throw new Error('SubCategory not found')
      }

      sendSuccess(res, subCategory, 'SubCategory retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  getByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const categoryId = getParamString(req.params.categoryId)
      const subCategories = await subCategoriesService.getByCategory(categoryId)
      sendSuccess(res, subCategories, 'SubCategories retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  create = withValidated(async (req: CreateSubCategoryReq, res: Response) => {
    try {
      const subCategory = await subCategoriesService.create(req.validated.body, (req as any).user?.id)
      sendSuccess(res, subCategory, 'SubCategory created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  update = withValidated(async (req: UpdateSubCategoryReq, res: Response) => {
    try {
      const { id } = req.validated.params
      const subCategory = await subCategoriesService.update(id, req.validated.body, (req as any).user?.id)
      sendSuccess(res, subCategory, 'SubCategory updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = getParamString(req.params.id)
      await subCategoriesService.delete(id, req.user?.id)
      sendSuccess(res, null, 'SubCategory deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  restore = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = getParamString(req.params.id)
      await subCategoriesService.restore(id, req.user?.id)
      const subCategory = await subCategoriesService.getById(id)
      sendSuccess(res, subCategory, 'SubCategory restored successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  bulkDelete = withValidated(async (req: BulkDeleteReq, res: Response) => {
    try {
      const { ids } = req.validated.body
      await subCategoriesService.bulkDelete(ids, (req as any).user?.id)
      sendSuccess(res, null, 'SubCategories deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })
}

export const subCategoriesController = new SubCategoriesController()
