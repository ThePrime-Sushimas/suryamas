import type { Request, Response } from 'express'
import { menuBranchPricesService } from './menu-branch-prices.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { createMenuBranchPriceSchema, updateMenuBranchPriceSchema, menuBranchPriceIdSchema, listMenuBranchPricesSchema, syncFromPosSchema } from './menu-branch-prices.schema'

type CreateReq = ValidatedAuthRequest<typeof createMenuBranchPriceSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateMenuBranchPriceSchema>
type IdReq = ValidatedAuthRequest<typeof menuBranchPriceIdSchema>
type ListReq = ValidatedAuthRequest<typeof listMenuBranchPricesSchema>
type SyncReq = ValidatedAuthRequest<typeof syncFromPosSchema>

export class MenuBranchPricesController {
  list = async (req: Request, res: Response) => {
    try {
      const { menu_id } = (req as ListReq).validated.query
      const data = await menuBranchPricesService.listByMenu(menu_id, req.context?.company_id ?? '')
      sendSuccess(res, data, 'Menu branch prices retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_menu_branch_prices' })
    }
  }

  upsert = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const result = await menuBranchPricesService.upsert(req.context?.company_id ?? '', body, req.user?.id ?? '')
      sendSuccess(res, result, 'Menu branch price saved', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upsert_menu_branch_price' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const result = await menuBranchPricesService.update(params.id, req.context?.company_id ?? '', body, req.user?.id ?? '')
      sendSuccess(res, result, 'Menu branch price updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_menu_branch_price', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await menuBranchPricesService.delete(id, req.context?.company_id ?? '', req.user?.id ?? '')
      sendSuccess(res, null, 'Menu branch price deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_menu_branch_price', id: req.params.id })
    }
  }

  syncFromPos = async (req: Request, res: Response) => {
    try {
      const { body } = (req as SyncReq).validated
      const result = await menuBranchPricesService.syncFromPos(req.context?.company_id ?? '', req.user?.id ?? '', body.menu_id)
      sendSuccess(res, result, `Sync completed: ${result.inserted} inserted, ${result.synced} updated, ${result.skipped_manual} skipped (manual), ${result.skipped_threshold} skipped (threshold)`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'sync_menu_branch_prices_from_pos' })
    }
  }
}

export const menuBranchPricesController = new MenuBranchPricesController()
