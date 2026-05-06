import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canUpdate } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { recipesController } from './recipes.controller'
import { saveRecipeSchema, getRecipeSchema, recalculateProductSchema, recalculateWipSchema } from './recipes.schema'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule('recipes', 'Recipe / BOM Management').catch((err) => {
  console.error('Failed to register recipes module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

// Cost propagation triggers (admin/system)
router.post('/recalculate/product/:productId', canUpdate('recipes'), validateSchema(recalculateProductSchema), (req, res) => recipesController.recalculateFromProduct(req, res))
router.post('/recalculate/wip/:wipId', canUpdate('recipes'), validateSchema(recalculateWipSchema), (req, res) => recipesController.recalculateFromWip(req, res))

// Recipe per menu
router.get('/:menuId', canView('recipes'), validateSchema(getRecipeSchema), (req, res) => recipesController.getRecipe(req, res))
router.put('/:menuId', canUpdate('recipes'), validateSchema(saveRecipeSchema), (req, res) => recipesController.saveRecipe(req, res))

export default router
