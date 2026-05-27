import type { Request, Response } from 'express'
import { menusService } from './menus.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { createMenuSchema, updateMenuSchema, menuIdSchema, bulkDeleteMenuSchema, syncMenusSchema } from './menus.schema'
import { getReadScope, getWriteScope } from '../../../utils/branch-access.util'

type CreateReq = ValidatedAuthRequest<typeof createMenuSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateMenuSchema>
type IdReq = ValidatedAuthRequest<typeof menuIdSchema>
type BulkDeleteReq = ValidatedAuthRequest<typeof bulkDeleteMenuSchema>
type SyncReq = ValidatedAuthRequest<typeof syncMenusSchema>

export class MenusController {
  list = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const is_active = req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined
      const category_id = req.query.category_id as string | undefined
      const group_id = req.query.group_id as string | undefined
      const has_recipe = req.query.has_recipe === 'true' ? true : req.query.has_recipe === 'false' ? false : undefined
      const sync_enabled = req.query.sync_enabled === 'true' ? true : req.query.sync_enabled === 'false' ? false : undefined
      const search = (req.query.search as string) || (req.query.q as string) || undefined
      const result = await menusService.list(companyIds, { page, limit }, req.sort, { is_active, category_id, group_id, has_recipe, sync_enabled, search })
      sendSuccess(res, result.data, 'Menus retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_menus' })
    }
  }

  search = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const result = await menusService.search(companyIds, q, { page, limit })
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_menus' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const menu = await menusService.getById(id, companyIds)
      sendSuccess(res, menu, 'Menu retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_menu', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const { body } = (req as CreateReq).validated
      const menu = await menusService.create(companyId, body, userId)
      sendSuccess(res, menu, 'Menu created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_menu' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { params, body } = (req as UpdateReq).validated
      const existing = await menusService.getById(params.id, companyIds)
      const menu = await menusService.update(params.id, existing.company_id, body, userId, existing)
      sendSuccess(res, menu, 'Menu updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_menu', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const existing = await menusService.getById(id, companyIds)
      await menusService.delete(id, existing.company_id, userId, existing)
      sendSuccess(res, null, 'Menu deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_menu', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const { id } = (req as IdReq).validated.params
      await menusService.restore(id, companyId, userId)
      sendSuccess(res, null, 'Menu restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_menu', id: req.params.id })
    }
  }

  bulkDelete = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { ids } = (req as BulkDeleteReq).validated.body
      for (const id of ids) {
        const existing = await menusService.getById(id, companyIds)
        await menusService.delete(id, existing.company_id, userId, existing)
      }
      sendSuccess(res, null, `${ids.length} menus deleted`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_menus' })
    }
  }

  syncFromPos = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const { body } = (req as SyncReq).validated
      const result = await menusService.syncFromPos(companyId, userId, body.force)
      sendSuccess(res, result, `Sync completed: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'sync_menus_from_pos' })
    }
  }
}

export const menusController = new MenusController()
