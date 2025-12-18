import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { categoriesService } from './categories.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'

export class CategoriesController {
  list = async (req: AuthRequest & { sort?: any }, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const result = await categoriesService.list({ page, limit }, req.sort)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Categories retrieved successfully',
      })
    } catch (error: any) {
      logError('List categories failed', { error: error.message })
      sendError(res, 'Failed to retrieve categories', 500)
    }
  }

  trash = async (req: AuthRequest & { sort?: any }, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const result = await categoriesService.trash({ page, limit }, req.sort)
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
      const result = await categoriesService.search(q, { page, limit }, req.sort)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Search completed',
      })
    } catch (error: any) {
      logError('Search categories failed', { error: error.message })
      sendError(res, 'Search failed', 500)
    }
  }

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const category = await categoriesService.getById(id)

      if (!category) {
        sendError(res, 'Category not found', 404)
        return
      }

      sendSuccess(res, category, 'Category retrieved successfully')
    } catch (error: any) {
      logError('Get category failed', { error: error.message })
      sendError(res, 'Failed to retrieve category', 500)
    }
  }

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const category = await categoriesService.create(req.body, req.user?.id)
      sendSuccess(res, category, 'Category created successfully', 201)
    } catch (error: any) {
      logError('Create category failed', { error: error.message })
      sendError(res, error.message || 'Failed to create category', 400)
    }
  }

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const category = await categoriesService.update(id, req.body, req.user?.id)
      sendSuccess(res, category, 'Category updated successfully')
    } catch (error: any) {
      logError('Update category failed', { error: error.message })
      sendError(res, error.message || 'Failed to update category', 400)
    }
  }

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await categoriesService.delete(id, req.user?.id)
      sendSuccess(res, null, 'Category deleted successfully')
    } catch (error: any) {
      logError('Delete category failed', { error: error.message })
      sendError(res, error.message || 'Failed to delete category', 400)
    }
  }

  restore = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      await categoriesService.restore(id, req.user?.id)
      const category = await categoriesService.getById(id)
      sendSuccess(res, category, 'Category restored successfully')
    } catch (error: any) {
      logError('Restore category failed', { error: error.message })
      sendError(res, error.message || 'Failed to restore category', 400)
    }
  }

  bulkDelete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { ids } = req.body
      await categoriesService.bulkDelete(ids, req.user?.id)
      sendSuccess(res, null, 'Categories deleted successfully')
    } catch (error: any) {
      logError('Bulk delete failed', { error: error.message })
      sendError(res, error.message || 'Failed to delete categories', 400)
    }
  }
}

export const categoriesController = new CategoriesController()
