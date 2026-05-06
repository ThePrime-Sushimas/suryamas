import type { Request, Response } from 'express'
import { menuCategoriesService } from './menu-categories.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { createMenuCategorySchema, updateMenuCategorySchema, menuCategoryIdSchema, bulkDeleteMenuCategorySchema } from './menu-categories.schema'

type CreateReq = ValidatedAuthRequest<typeof createMenuCategorySchema>
type UpdateReq = ValidatedAuthRequest<typeof updateMenuCategorySchema>
type IdReq = ValidatedAuthRequest<typeof menuCategoryIdSchema>
type BulkDeleteReq = ValidatedAuthRequest<typeof bulkDeleteMenuCategorySchema>

export class MenuCategoriesController {
  list = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25
      const is_active = req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined
      const result = await menuCategoriesService.list(companyId, { page, limit }, req.sort, is_active !== undefined ? { is_active } : undefined)
      sendSuccess(res, result.data, 'Menu categories retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_menu_categories' })
    }
  }

  search = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25
      const result = await menuCategoriesService.search(companyId, q, { page, limit })
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_menu_categories' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const category = await menuCategoriesService.getById(id, req.context?.company_id ?? '')
      sendSuccess(res, category, 'Menu category retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_menu_category', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const category = await menuCategoriesService.create(req.context?.company_id ?? '', body, req.user?.id ?? '')
      sendSuccess(res, category, 'Menu category created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_menu_category' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const category = await menuCategoriesService.update(params.id, req.context?.company_id ?? '', body, req.user?.id ?? '')
      sendSuccess(res, category, 'Menu category updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_menu_category', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await menuCategoriesService.delete(id, req.context?.company_id ?? '', req.user?.id ?? '')
      sendSuccess(res, null, 'Menu category deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_menu_category', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await menuCategoriesService.restore(id, req.context?.company_id ?? '', req.user?.id ?? '')
      sendSuccess(res, null, 'Menu category restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_menu_category', id: req.params.id })
    }
  }

  bulkDelete = async (req: Request, res: Response) => {
    try {
      const { ids } = (req as BulkDeleteReq).validated.body
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      for (const id of ids) await menuCategoriesService.delete(id, companyId, userId)
      sendSuccess(res, null, `${ids.length} menu categories deleted`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_menu_categories' })
    }
  }
}

export const menuCategoriesController = new MenuCategoriesController()
