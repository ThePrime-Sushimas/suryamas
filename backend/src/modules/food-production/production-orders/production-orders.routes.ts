import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { requireWriteAccess } from '../../../middleware/write-guard.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { productionOrdersController } from './production-orders.controller'
import {
  createProductionOrderSchema, completeProductionOrderSchema,
  voidProductionOrderSchema, listProductionOrdersSchema,
  summarySchema, materialsReportSchema, idParamSchema
} from './production-orders.schema'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule('production_orders', 'Production Order / Produksi Harian').catch((err) => {
  console.error('Failed to register production_orders module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

// Static routes BEFORE /:id
router.get('/summary', canView('production_orders'), validateSchema(summarySchema), (req, res) => productionOrdersController.summary(req, res))
router.get('/materials-report', canView('production_orders'), validateSchema(materialsReportSchema), (req, res) => productionOrdersController.materialsReport(req, res))

// List
router.get('/', canView('production_orders'), validateSchema(listProductionOrdersSchema), (req, res) => productionOrdersController.list(req, res))

// Create
router.post('/', requireWriteAccess, canInsert('production_orders'), validateSchema(createProductionOrderSchema), (req, res) => productionOrdersController.create(req, res))

// Detail
router.get('/:id', canView('production_orders'), validateSchema(idParamSchema), (req, res) => productionOrdersController.getById(req, res))

// Complete
router.post('/:id/complete', requireWriteAccess, canUpdate('production_orders'), validateSchema(completeProductionOrderSchema), (req, res) => productionOrdersController.complete(req, res))

// Generate Journal
router.post('/:id/generate-journal', requireWriteAccess, canUpdate('production_orders'), validateSchema(idParamSchema), (req, res) => productionOrdersController.generateJournal(req, res))

// Void
router.post('/:id/void', requireWriteAccess, canDelete('production_orders'), validateSchema(voidProductionOrderSchema), (req, res) => productionOrdersController.voidOrder(req, res))

// Soft Delete (DRAFT only)
router.delete('/:id', requireWriteAccess, canDelete('production_orders'), validateSchema(idParamSchema), (req, res) => productionOrdersController.delete(req, res))

export default router
