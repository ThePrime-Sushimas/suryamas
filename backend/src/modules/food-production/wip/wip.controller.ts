import type { Request, Response } from 'express'
import { wipService } from './wip.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { createWipItemSchema, updateWipItemSchema, wipItemIdSchema, bulkDeleteWipSchema } from './wip.schema'

type CreateReq = ValidatedAuthRequest<typeof createWipItemSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateWipItemSchema>
type IdReq = ValidatedAuthRequest<typeof wipItemIdSchema>
type BulkDeleteReq = ValidatedAuthRequest<typeof bulkDeleteWipSchema>

export class WipController {
  list = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const is_active = req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined
      const result = await wipService.list(companyId, { page, limit }, { is_active })
      sendSuccess(res, result.data, 'WIP items retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_wip_items' })
    }
  }

  search = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const result = await wipService.search(companyId, q, { page, limit })
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_wip_items' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const item = await wipService.getById(id, req.context?.company_id ?? '')
      sendSuccess(res, item, 'WIP item retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_wip_item', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const item = await wipService.create(req.context?.company_id ?? '', body, req.user?.id ?? '')
      sendSuccess(res, item, 'WIP item created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_wip_item' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const item = await wipService.update(params.id, req.context?.company_id ?? '', body, req.user?.id ?? '')
      sendSuccess(res, item, 'WIP item updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_wip_item', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await wipService.delete(id, req.context?.company_id ?? '', req.user?.id ?? '')
      sendSuccess(res, null, 'WIP item deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_wip_item', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await wipService.restore(id, req.context?.company_id ?? '', req.user?.id ?? '')
      sendSuccess(res, null, 'WIP item restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_wip_item', id: req.params.id })
    }
  }

  bulkDelete = async (req: Request, res: Response) => {
    try {
      const { ids } = (req as BulkDeleteReq).validated.body
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      for (const id of ids) await wipService.delete(id, companyId, userId)
      sendSuccess(res, null, `${ids.length} WIP items deleted`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_wip_items' })
    }
  }
}

export const wipController = new WipController()
