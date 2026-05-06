import type { Request, Response } from 'express'
import { menuGroupsService } from './menu-groups.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { createMenuGroupSchema, updateMenuGroupSchema, menuGroupIdSchema, bulkDeleteMenuGroupSchema } from './menu-groups.schema'

type CreateReq = ValidatedAuthRequest<typeof createMenuGroupSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateMenuGroupSchema>
type IdReq = ValidatedAuthRequest<typeof menuGroupIdSchema>
type BulkDeleteReq = ValidatedAuthRequest<typeof bulkDeleteMenuGroupSchema>

export class MenuGroupsController {
  list = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const is_active = req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined
      const category_id = req.query.category_id as string | undefined
      const result = await menuGroupsService.list(companyId, { page, limit }, req.sort, { is_active, category_id })
      sendSuccess(res, result.data, 'Menu groups retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_menu_groups' })
    }
  }

  search = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const result = await menuGroupsService.search(companyId, q, { page, limit })
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_menu_groups' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const group = await menuGroupsService.getById(id, req.context?.company_id ?? '')
      sendSuccess(res, group, 'Menu group retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_menu_group', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const group = await menuGroupsService.create(req.context?.company_id ?? '', body, req.user?.id ?? '')
      sendSuccess(res, group, 'Menu group created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_menu_group' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const group = await menuGroupsService.update(params.id, req.context?.company_id ?? '', body, req.user?.id ?? '')
      sendSuccess(res, group, 'Menu group updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_menu_group', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await menuGroupsService.delete(id, req.context?.company_id ?? '', req.user?.id ?? '')
      sendSuccess(res, null, 'Menu group deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_menu_group', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await menuGroupsService.restore(id, req.context?.company_id ?? '', req.user?.id ?? '')
      sendSuccess(res, null, 'Menu group restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_menu_group', id: req.params.id })
    }
  }

  bulkDelete = async (req: Request, res: Response) => {
    try {
      const { ids } = (req as BulkDeleteReq).validated.body
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      for (const id of ids) await menuGroupsService.delete(id, companyId, userId)
      sendSuccess(res, null, `${ids.length} menu groups deleted`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_menu_groups' })
    }
  }
}

export const menuGroupsController = new MenuGroupsController()
