import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete, canApprove } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { productionRequestsController } from './production-requests.controller'
import {
  productionRequestIdSchema, productionRequestListSchema,
  createProductionRequestSchema, updateProductionRequestSchema,
  acceptProductionRequestSchema, receiveProductionRequestSchema,
  cancelProductionRequestSchema,
} from './production-requests.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('production_requests', 'Production Requests (Request Produksi ke Central)').catch((err) => {
  console.error('Failed to register production_requests module:', err instanceof Error ? err.message : err)
})

const router = Router()
router.use(authenticate, resolveBranchContext)

// List
router.get('/', canView('production_requests'), validateSchema(productionRequestListSchema), (req, res) => productionRequestsController.list(req, res))

// Summary (rekap total batch per WIP dari semua cabang)
router.get('/summary', canView('production_requests'), (req, res) => productionRequestsController.summary(req, res))

// Detail
router.get('/:id', canView('production_requests'), validateSchema(productionRequestIdSchema), (req, res) => productionRequestsController.getById(req, res))

// Create
router.post('/', canInsert('production_requests'), validateSchema(createProductionRequestSchema), (req, res) => productionRequestsController.create(req, res))

// Update (DRAFT only)
router.put('/:id', canUpdate('production_requests'), validateSchema(updateProductionRequestSchema), (req, res) => productionRequestsController.update(req, res))

// Accept (Central receives & approves — requires approve permission)
router.post('/:id/accept', canApprove('production_requests'), validateSchema(acceptProductionRequestSchema), (req, res) => productionRequestsController.accept(req, res))

// Receive (Branch confirms receipt)
router.post('/:id/receive', canUpdate('production_requests'), validateSchema(receiveProductionRequestSchema), (req, res) => productionRequestsController.receive(req, res))

// Cancel
router.post('/:id/cancel', canUpdate('production_requests'), validateSchema(cancelProductionRequestSchema), (req, res) => productionRequestsController.cancel(req, res))

// Delete (DRAFT only)
router.delete('/:id', canDelete('production_requests'), validateSchema(productionRequestIdSchema), (req, res) => productionRequestsController.softDelete(req, res))

export default router
