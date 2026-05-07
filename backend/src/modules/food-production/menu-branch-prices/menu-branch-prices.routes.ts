import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { menuBranchPricesController } from './menu-branch-prices.controller'
import { createMenuBranchPriceSchema, updateMenuBranchPriceSchema, menuBranchPriceIdSchema, listMenuBranchPricesSchema, syncFromPosSchema } from './menu-branch-prices.schema'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule('menu_branch_prices', 'Menu Branch Prices').catch((err) => {
  console.error('Failed to register menu_branch_prices module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('menu_branch_prices'), validateSchema(listMenuBranchPricesSchema), (req, res) => menuBranchPricesController.list(req, res))
router.post('/sync-from-pos', canUpdate('menu_branch_prices'), validateSchema(syncFromPosSchema), (req, res) => menuBranchPricesController.syncFromPos(req, res))
router.post('/', canInsert('menu_branch_prices'), validateSchema(createMenuBranchPriceSchema), (req, res) => menuBranchPricesController.upsert(req, res))
router.put('/:id', canUpdate('menu_branch_prices'), validateSchema(updateMenuBranchPriceSchema), (req, res) => menuBranchPricesController.update(req, res))
router.delete('/:id', canDelete('menu_branch_prices'), validateSchema(menuBranchPriceIdSchema), (req, res) => menuBranchPricesController.delete(req, res))

export default router
