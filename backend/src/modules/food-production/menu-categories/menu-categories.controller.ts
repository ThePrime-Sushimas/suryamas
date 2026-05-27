import type { Request, Response } from 'express'
import { menuCategoriesService } from './menu-categories.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { createMenuCategorySchema, updateMenuCategorySchema, menuCategoryIdSchema, bulkDeleteMenuCategorySchema } from './menu-categories.schema'
import { getReadScope, getWriteScope } from '../../../utils/branch-access.util'

type CreateReq = ValidatedAuthRequest<typeof createMenuCategorySchema>
type UpdateReq = ValidatedAuthRequest<typeof updateMenuCategorySchema>
type IdReq = ValidatedAuthRequest<typeof menuCategoryIdSchema>
type BulkDeleteReq = ValidatedAuthRequest<typeof bulkDeleteMenuCategorySchema>

export class MenuCategoriesController {
  list = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25
      const is_active = req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined
      const result = await menuCategoriesService.list(companyIds, { page, limit }, req.sort, is_active !== undefined ? { is_active } : undefined)
      sendSuccess(res, result.data, 'Menu categories retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_menu_categories' })
    }
  }

  search = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25
      const result = await menuCategoriesService.search(companyIds, q, { page, limit })
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_menu_categories' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const category = await menuCategoriesService.getById(id, companyIds)
      sendSuccess(res, category, 'Menu category retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_menu_category', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const { body } = (req as CreateReq).validated
      const category = await menuCategoriesService.create(companyId, body, userId)
      sendSuccess(res, category, 'Menu category created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_menu_category' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { params, body } = (req as UpdateReq).validated
      const existing = await menuCategoriesService.getById(params.id, companyIds)
      const category = await menuCategoriesService.update(params.id, existing.company_id, body, userId, existing)
      sendSuccess(res, category, 'Menu category updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_menu_category', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const existing = await menuCategoriesService.getById(id, companyIds)
      await menuCategoriesService.delete(id, existing.company_id, userId, existing)
      sendSuccess(res, null, 'Menu category deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_menu_category', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const existing = await menuCategoriesService.getById(id, companyIds)
      await menuCategoriesService.restore(id, existing.company_id, userId)
      sendSuccess(res, null, 'Menu category restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_menu_category', id: req.params.id })
    }
  }

  bulkDelete = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { ids } = (req as BulkDeleteReq).validated.body
      for (const id of ids) {
        const existing = await menuCategoriesService.getById(id, companyIds)
        await menuCategoriesService.delete(id, existing.company_id, userId, existing)
      }
      sendSuccess(res, null, `${ids.length} menu categories deleted`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_menu_categories' })
    }
  }
}

export const menuCategoriesController = new MenuCategoriesController()
