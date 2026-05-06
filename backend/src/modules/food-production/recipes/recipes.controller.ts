import type { Request, Response } from 'express'
import { recipesService } from './recipes.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { saveRecipeSchema, getRecipeSchema } from './recipes.schema'

type SaveReq = ValidatedAuthRequest<typeof saveRecipeSchema>
type GetReq = ValidatedAuthRequest<typeof getRecipeSchema>

export class RecipesController {
  getRecipe = async (req: Request, res: Response) => {
    try {
      const { menuId } = (req as GetReq).validated.params
      const recipe = await recipesService.getRecipe(menuId, req.context?.company_id ?? '')
      sendSuccess(res, recipe, 'Recipe retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_recipe', id: req.params.menuId })
    }
  }

  saveRecipe = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as SaveReq).validated
      const recipe = await recipesService.saveRecipe(params.menuId, req.context?.company_id ?? '', body.lines, req.user?.id ?? '')
      sendSuccess(res, recipe, 'Recipe saved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'save_recipe', id: req.params.menuId })
    }
  }

  recalculateFromProduct = async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string
      const result = await recipesService.recalculateCostFromProduct(productId, req.context?.company_id ?? '', req.user?.id ?? '')
      sendSuccess(res, result, `Cost propagated: ${result.wipsUpdated} WIPs, ${result.menusUpdated} menus updated`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'recalculate_cost_from_product', id: req.params.productId })
    }
  }

  recalculateFromWip = async (req: Request, res: Response) => {
    try {
      const wipId = req.params.wipId as string
      const result = await recipesService.recalculateCostFromWip(wipId, req.context?.company_id ?? '', req.user?.id ?? '')
      sendSuccess(res, result, `Cost propagated: ${result.menusUpdated} menus updated`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'recalculate_cost_from_wip', id: req.params.wipId })
    }
  }
}

export const recipesController = new RecipesController()
