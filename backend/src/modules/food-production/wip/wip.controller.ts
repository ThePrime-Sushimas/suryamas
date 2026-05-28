import type { Request, Response } from 'express'
import { wipService } from './wip.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { createWipItemSchema, updateWipItemSchema, wipItemIdSchema, bulkDeleteWipSchema } from './wip.schema'
import {
  getAccessibleBranchIds, getCompanyIdForBranch, getReadScope, getWriteScope,
  requireBranchAccess, requireCompanyAccess,
} from '../../../utils/branch-access.util'
import { resolveUserWipAccess, resolveUserWipAccessForBranch } from './wip-access.util'

type CreateReq = ValidatedAuthRequest<typeof createWipItemSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateWipItemSchema>
type IdReq = ValidatedAuthRequest<typeof wipItemIdSchema>
type BulkDeleteReq = ValidatedAuthRequest<typeof bulkDeleteWipSchema>

export class WipController {
  list = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const is_active = req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined

      const branchId = typeof req.query.branch_id === 'string' ? req.query.branch_id : undefined
      let companyIdFilter = typeof req.query.company_id === 'string' ? req.query.company_id : undefined

      if (branchId) {
        const branchIds = await getAccessibleBranchIds(userId)
        requireBranchAccess(branchId, branchIds)
        const branchCompanyId = await getCompanyIdForBranch(branchId)
        if (!branchCompanyId) {
          sendSuccess(res, [], 'WIP items retrieved', 200, { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false })
          return
        }
        companyIdFilter = branchCompanyId
      }

      if (companyIdFilter) requireCompanyAccess(companyIdFilter, companyIds)

      let positionIds: string[] | undefined
      let canAccessAll = false
      if (req.query.filter_by_position === 'true' && req.user?.id) {
        const access = branchId
          ? await resolveUserWipAccessForBranch(req.user.id, branchId)
          : await resolveUserWipAccess(req.user.id)
        positionIds = access.positionIds
        canAccessAll = access.canAccessAll
      }

      const result = await wipService.list(companyIds, { page, limit }, {
        is_active, positionIds, canAccessAll, companyId: companyIdFilter,
      })
      sendSuccess(res, result.data, 'WIP items retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_wip_items' })
    }
  }

  search = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const q = (req.query.q as string) || ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const result = await wipService.search(companyIds, q, { page, limit })
      sendSuccess(res, result.data, 'Search completed', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_wip_items' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const item = await wipService.getById(id, companyIds)
      sendSuccess(res, item, 'WIP item retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_wip_item', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const { body } = (req as CreateReq).validated
      const item = await wipService.create(companyId, body, userId)
      sendSuccess(res, item, 'WIP item created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_wip_item' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { params, body } = (req as UpdateReq).validated
      const existing = await wipService.getById(params.id, companyIds)
      const item = await wipService.update(params.id, existing.company_id, body, userId, existing)
      sendSuccess(res, item, 'WIP item updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_wip_item', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const existing = await wipService.getById(id, companyIds)
      await wipService.delete(id, existing.company_id, userId, existing)
      sendSuccess(res, null, 'WIP item deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_wip_item', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const { id } = (req as IdReq).validated.params
      await wipService.restore(id, companyId, userId)
      sendSuccess(res, null, 'WIP item restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_wip_item', id: req.params.id })
    }
  }

  bulkDelete = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { ids } = (req as BulkDeleteReq).validated.body
      for (const id of ids) {
        const existing = await wipService.getById(id, companyIds)
        await wipService.delete(id, existing.company_id, userId, existing)
      }
      sendSuccess(res, null, `${ids.length} WIP items deleted`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete_wip_items' })
    }
  }
}

export const wipController = new WipController()
