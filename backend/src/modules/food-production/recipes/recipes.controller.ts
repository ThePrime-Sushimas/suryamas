import type { Request, Response } from 'express'
import { recipesService } from './recipes.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { saveRecipeSchema, getRecipeSchema } from './recipes.schema'
import { getReadScope, getWriteScope } from '../../../utils/branch-access.util'
import { menusService } from '../menus/menus.service'

type SaveReq = ValidatedAuthRequest<typeof saveRecipeSchema>
type GetReq = ValidatedAuthRequest<typeof getRecipeSchema>

export class RecipesController {
  getRecipe = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const { menuId } = (req as GetReq).validated.params
      const existing = await menusService.getById(menuId, companyIds)
      const recipe = await recipesService.getRecipe(menuId, existing.company_id)
      sendSuccess(res, recipe, 'Recipe retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_recipe', id: req.params.menuId })
    }
  }

  saveRecipe = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const { params, body } = (req as SaveReq).validated
      await menusService.getById(params.menuId, [companyId])
      const recipe = await recipesService.saveRecipe(params.menuId, companyId, body.lines, userId)
      sendSuccess(res, recipe, 'Recipe saved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'save_recipe', id: req.params.menuId })
    }
  }

  recalculateFromProduct = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const productId = req.params.productId as string
      const result = await recipesService.recalculateCostFromProduct(productId, companyId, userId)
      sendSuccess(res, result, `Cost propagated: ${result.wipsUpdated} WIPs, ${result.menusUpdated} menus updated`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'recalculate_cost_from_product', id: req.params.productId })
    }
  }

  recalculateFromWip = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const wipId = req.params.wipId as string
      const result = await recipesService.recalculateCostFromWip(wipId, companyId, userId)
      sendSuccess(res, result, `Cost propagated: ${result.menusUpdated} menus updated`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'recalculate_cost_from_wip', id: req.params.wipId })
    }
  }
}

export const recipesController = new RecipesController()
