import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { pricelistsController } from './pricelists.controller'
import { PermissionService } from '../../services/permission.service'
import {
  createPricelistSchema,
  updatePricelistSchema,
  pricelistIdSchema,
  pricelistListQuerySchema,
  approvalSchema,
  lookupPriceSchema,
} from './pricelists.schema'

const router = Router()

PermissionService.registerModule('pricelists', 'Pricelist Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

router.get('/lookup', canView('pricelists'), validateSchema(lookupPriceSchema), pricelistsController.lookupPrice)

router.get('/', canView('pricelists'), validateSchema(pricelistListQuerySchema), pricelistsController.list)

router.get('/:id', canView('pricelists'), validateSchema(pricelistIdSchema), pricelistsController.findById)

router.post('/', canInsert('pricelists'), validateSchema(createPricelistSchema), pricelistsController.create)

router.put('/:id', canUpdate('pricelists'), validateSchema(updatePricelistSchema), pricelistsController.update)

router.post('/:id/approve', canUpdate('pricelists'), validateSchema(approvalSchema), pricelistsController.approve)

router.post('/:id/restore', canUpdate('pricelists'), validateSchema(pricelistIdSchema), pricelistsController.restore)

router.delete('/:id', canDelete('pricelists'), validateSchema(pricelistIdSchema), pricelistsController.delete)

export default router
