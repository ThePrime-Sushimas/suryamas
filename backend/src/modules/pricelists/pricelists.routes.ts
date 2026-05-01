import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { pricelistsController } from './pricelists.controller'
import { PermissionService } from '../../services/permission.service'
import {
  createPricelistSchema, updatePricelistSchema, pricelistIdSchema,
  pricelistListQuerySchema, approvalSchema, lookupPriceSchema,
} from './pricelists.schema'

const router = Router()

PermissionService.registerModule('pricelists', 'Pricelist Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

router.get('/lookup', canView('pricelists'), validateSchema(lookupPriceSchema), (req, res) => pricelistsController.lookupPrice(req, res))
router.get('/', canView('pricelists'), validateSchema(pricelistListQuerySchema), (req, res) => pricelistsController.list(req, res))
router.get('/:id', canView('pricelists'), validateSchema(pricelistIdSchema), (req, res) => pricelistsController.findById(req, res))
router.post('/', canInsert('pricelists'), validateSchema(createPricelistSchema), (req, res) => pricelistsController.create(req, res))
router.put('/:id', canUpdate('pricelists'), validateSchema(updatePricelistSchema), (req, res) => pricelistsController.update(req, res))
router.post('/:id/approve', canUpdate('pricelists'), validateSchema(approvalSchema), (req, res) => pricelistsController.approve(req, res))
router.post('/:id/restore', canUpdate('pricelists'), validateSchema(pricelistIdSchema), (req, res) => pricelistsController.restore(req, res))
router.delete('/:id', canDelete('pricelists'), validateSchema(pricelistIdSchema), (req, res) => pricelistsController.delete(req, res))

export default router
