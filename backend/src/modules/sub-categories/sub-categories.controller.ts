import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { subCategoriesService } from './sub-categories.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'

export class SubCategoriesController {
  list = async (req: AuthRequest & { sort?: any }, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const categoryId = req.query.category_id as string
      const result = await subCategoriesService.list({ page, limit }, req.sort, categoryId)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'SubCategories retrieved successfully',
      })
    } catch (error: any) {
      logError('List sub_categories failed', { error: error.message })
      sendError(res, 'Failed to retrieve sub_categories', 500)
    }
  }

  trash = async (req: AuthRequest & { sort?: any }, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const result = await subCategoriesService.trash({ page, limit }, req.sort)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Trash retrieved successfully',
      })
    } catch (error: any) {
      logError('List trash failed', { error: error.message })
      sendError(res, 'Failed to retrieve trash', 500)
    }
  }

  search = async (req: AuthRequest & { sort?: any }, res: Response): Promise<void> => {
    try {
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const result = await subCategoriesService.search(q, { page, limit }, req.sort)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Search completed',
      })
    } catch (error: any) {
      logError('Search sub_categories failed', { error: error.message })
      sendError(res, 'Search failed', 500)
    }
  }

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const subCategory = await subCategoriesService.getById(id)

      if (!subCategory) {
        sendError(res, 'SubCategory not found', 404)
        return
      }

      sendSuccess(res, subCategory, 'SubCategory retrieved successfully')
    } catch (error: any) {
      logError('Get sub_category failed', { error: error.message })
      sendError(res, 'Failed to retrieve sub_category', 500)
    }
  }

  getByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { categoryId } = req.params
      const subCategories = await subCategoriesService.getByCategory(categoryId)
      sendSuccess(res, subCategories, 'SubCategories retrieved successfully')
    } catch (error: any) {
      logError('Get sub_categories by category failed', { error: error.message })
      sendError(res, 'Failed to retrieve sub_categories', 500)
    }
  }

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const subCategory = await subCategoriesService.create(req.body, req.user?.id)
      sendSuccess(res, subCategory, 'SubCategory created successfully', 201)
    } catch (error: any) {
      logError('Create sub_category failed', { error: error.message })
      sendError(res, error.message || 'Failed to create sub_category', 400)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const subCategory = await subCategoriesService.update(id, req.body, req.user?.id)
      sendSuccess(res, subCategory, 'SubCategory updated successfully')
    } catch (error: any) {
      logError('Update sub_category failed', { error: error.message })
      sendError(res, error.message || 'Failed to update sub_category', 400)
    }
  }

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await subCategoriesService.delete(id, req.user?.id)
      sendSuccess(res, null, 'SubCategory deleted successfully')
    } catch (error: any) {
      logError('Delete sub_category failed', { error: error.message })
      sendError(res, error.message || 'Failed to delete sub_category', 400)
    }
  }

  restore = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await subCategoriesService.restore(id, req.user?.id)
      const subCategory = await subCategoriesService.getById(id)
      sendSuccess(res, subCategory, 'SubCategory restored successfully')
    } catch (error: any) {
      logError('Restore sub_category failed', { error: error.message })
      sendError(res, error.message || 'Failed to restore sub_category', 400)
    }
  }

  bulkDelete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { ids } = req.body
      await subCategoriesService.bulkDelete(ids, req.user?.id)
      sendSuccess(res, null, 'SubCategories deleted successfully')
    } catch (error: any) {
      logError('Bulk delete failed', { error: error.message })
      sendError(res, error.message || 'Failed to delete sub_categories', 400)
    }
  }
}

export const subCategoriesController = new SubCategoriesController()
