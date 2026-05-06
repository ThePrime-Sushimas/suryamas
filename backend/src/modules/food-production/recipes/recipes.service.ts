import { recipesRepository } from './recipes.repository'
import { menusRepository } from '../menus/menus.repository'
import { RecipeMenuNotFoundError, RecipeInvalidLineError } from './recipes.errors'
import { AuditService } from '../../monitoring/monitoring.service'
import type { MenuRecipe, SaveRecipeLineDto } from './recipes.types'

export class RecipesService {
  async getRecipe(menuId: string, companyId: string): Promise<MenuRecipe> {
    const menu = await menusRepository.findById(menuId, companyId)
    if (!menu) throw new RecipeMenuNotFoundError(menuId)

    const lines = await recipesRepository.getByMenuId(menuId)
    return {
      menu_id: menu.id,
      menu_name: menu.menu_name,
      menu_code: menu.menu_code,
      estimated_cost: Number(menu.estimated_cost),
      selling_price: Number(menu.selling_price),
      cost_percentage: Number(menu.cost_percentage),
      has_recipe: menu.has_recipe,
      lines,
    }
  }

  async saveRecipe(menuId: string, companyId: string, lines: SaveRecipeLineDto[], userId: string): Promise<MenuRecipe> {
    const menu = await menusRepository.findById(menuId, companyId)
    if (!menu) throw new RecipeMenuNotFoundError(menuId)

    // Defensive validation for internal callers (schema.refine already catches this for HTTP requests)
    for (const line of lines) {
      const hasProduct = !!line.product_id
      const hasWip = !!line.wip_id
      if (hasProduct === hasWip) throw new RecipeInvalidLineError()
    }

    const before = await recipesRepository.getByMenuId(menuId)
    await recipesRepository.saveRecipe(menuId, companyId, lines)
    const after = await recipesRepository.getByMenuId(menuId)

    await AuditService.log('UPDATE', 'recipe', menuId, userId, { lines: before }, { lines: after })

    return this.getRecipe(menuId, companyId)
  }

  async recalculateCostFromProduct(productId: string, companyId: string, userId: string): Promise<{ wipsUpdated: number; menusUpdated: number }> {
    const result = await recipesRepository.recalculateCostFromProduct(productId, companyId)
    if (result.wipsUpdated > 0 || result.menusUpdated > 0) {
      await AuditService.log('UPDATE', 'cost_propagation', productId, userId, undefined, result)
    }
    return result
  }

  async recalculateCostFromWip(wipId: string, companyId: string, userId: string): Promise<{ menusUpdated: number }> {
    const result = await recipesRepository.recalculateCostFromWip(wipId, companyId)
    if (result.menusUpdated > 0) {
      await AuditService.log('UPDATE', 'cost_propagation_wip', wipId, userId, undefined, result)
    }
    return result
  }
}

export const recipesService = new RecipesService()
