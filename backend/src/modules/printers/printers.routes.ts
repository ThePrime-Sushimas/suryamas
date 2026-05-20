import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { printersController } from './printers.controller'
import {
  createPrinterSchema,
  updatePrinterSchema,
  printerIdSchema,
  printPurchaseRequestSchema,
  printGoodsReceiptSchema,
} from './printers.schema'
import { PermissionService } from '../../services/permission.service'

const router = Router()

PermissionService.registerModule('printers', 'Printer Management')
  .catch((err) => console.error('Failed to register printers module:', err))

router.use(authenticate, resolveBranchContext)

router.get('/', canView('printers'), (req, res) => printersController.list(req, res))

// Static routes BEFORE dynamic :id routes
router.post('/print/purchase-request/:id', canView('purchase_requests'), validateSchema(printPurchaseRequestSchema), (req, res) => printersController.printPurchaseRequest(req, res))
router.post('/print/goods-receipt/:id', canView('goods_receipts'), validateSchema(printGoodsReceiptSchema), (req, res) => printersController.printGoodsReceipt(req, res))

router.get('/:id', canView('printers'), validateSchema(printerIdSchema), (req, res) => printersController.getById(req, res))
router.post('/', canInsert('printers'), validateSchema(createPrinterSchema), (req, res) => printersController.create(req, res))
router.put('/:id', canUpdate('printers'), validateSchema(updatePrinterSchema), (req, res) => printersController.update(req, res))
router.delete('/:id', canDelete('printers'), validateSchema(printerIdSchema), (req, res) => printersController.delete(req, res))
router.post('/:id/test', canView('printers'), validateSchema(printerIdSchema), (req, res) => printersController.testConnection(req, res))

export default router
