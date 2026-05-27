import type { Request, Response } from 'express'
import { menuBranchPricesService } from './menu-branch-prices.service'
import { menusService } from '../menus/menus.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { createMenuBranchPriceSchema, updateMenuBranchPriceSchema, menuBranchPriceIdSchema, listMenuBranchPricesSchema, syncFromPosSchema } from './menu-branch-prices.schema'
import { getBranchReadScope, getReadScope, getWriteScope, requireBranchAccess } from '../../../utils/branch-access.util'

type CreateReq = ValidatedAuthRequest<typeof createMenuBranchPriceSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateMenuBranchPriceSchema>
type IdReq = ValidatedAuthRequest<typeof menuBranchPriceIdSchema>
type ListReq = ValidatedAuthRequest<typeof listMenuBranchPricesSchema>
type SyncReq = ValidatedAuthRequest<typeof syncFromPosSchema>

export class MenuBranchPricesController {
  list = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const { menu_id } = (req as ListReq).validated.query
      const menu = await menusService.getById(menu_id, companyIds)
      const data = await menuBranchPricesService.listByMenu(menu_id, menu.company_id)
      sendSuccess(res, data, 'Menu branch prices retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_menu_branch_prices' })
    }
  }

  upsert = async (req: Request, res: Response) => {
    try {
      const [{ companyId, userId }, { branchIds }] = await Promise.all([
        getWriteScope(req),
        getBranchReadScope(req),
      ])
      const { body } = (req as CreateReq).validated
      await menusService.getById(body.menu_id, [companyId])
      requireBranchAccess(body.branch_id, branchIds)
      const result = await menuBranchPricesService.upsert(companyId, body, userId)
      sendSuccess(res, result, 'Menu branch price saved', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upsert_menu_branch_price' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { params, body } = (req as UpdateReq).validated
      const existing = await menuBranchPricesService.getById(params.id, companyIds)
      const result = await menuBranchPricesService.update(params.id, existing.company_id, body, userId, existing)
      sendSuccess(res, result, 'Menu branch price updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_menu_branch_price', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const existing = await menuBranchPricesService.getById(id, companyIds)
      await menuBranchPricesService.delete(id, existing.company_id, userId, existing)
      sendSuccess(res, null, 'Menu branch price deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_menu_branch_price', id: req.params.id })
    }
  }

  syncFromPos = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const { body } = (req as SyncReq).validated
      if (body.menu_id) await menusService.getById(body.menu_id, [companyId])
      const result = await menuBranchPricesService.syncFromPos(companyId, userId, body.menu_id)
      sendSuccess(res, result, `Sync completed: ${result.inserted} inserted, ${result.synced} updated, ${result.skipped_manual} skipped (manual), ${result.skipped_threshold} skipped (threshold)`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'sync_menu_branch_prices_from_pos' })
    }
  }
}

export const menuBranchPricesController = new MenuBranchPricesController()
