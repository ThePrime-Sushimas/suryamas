import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { productUomsController } from './product-uoms.controller'
import { PermissionService } from '../../services/permission.service'
import { createProductUomSchema, updateProductUomSchema, productUomIdSchema, productUomListSchema, purchaseUnitsBatchSchema } from './product-uoms.schema'

PermissionService.registerModule('product_uoms', 'Product UOM Management').catch(() => {})

const router = Router({ mergeParams: true })

router.use(authenticate, resolveBranchContext)

router.get('/', canView('product_uoms'), validateSchema(productUomListSchema), (req, res) => productUomsController.list(req, res))
router.get('/purchase-unit', canView('product_uoms'), validateSchema(productUomListSchema), (req, res) => productUomsController.getPurchaseUnit(req, res))
router.post('/purchase-units-batch', canView('product_uoms'), validateSchema(purchaseUnitsBatchSchema), (req, res) => productUomsController.getPurchaseUnitsBatch(req, res))
router.post('/transfer-units-batch', canView('product_uoms'), validateSchema(purchaseUnitsBatchSchema), (req, res) => productUomsController.getTransferUnitsBatch(req, res))
router.post('/conversions-batch', canView('product_uoms'), validateSchema(purchaseUnitsBatchSchema), (req, res) => productUomsController.getConversionsBatch(req, res))
router.post('/', canInsert('product_uoms'), validateSchema(createProductUomSchema), (req, res) => productUomsController.create(req, res))
router.put('/:uomId', canUpdate('product_uoms'), validateSchema(updateProductUomSchema), (req, res) => productUomsController.update(req, res))
router.delete('/:uomId', canDelete('product_uoms'), validateSchema(productUomIdSchema), (req, res) => productUomsController.delete(req, res))
router.post('/:uomId/restore', canUpdate('product_uoms'), validateSchema(productUomIdSchema), (req, res) => productUomsController.restore(req, res))

export default router
