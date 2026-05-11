import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { warehousesController } from './warehouses.controller'
import { createWarehouseSchema, updateWarehouseSchema, warehouseIdSchema, bulkDeleteWarehouseSchema } from './warehouses.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('warehouses', 'Warehouse Management').catch((err) => {
  console.error('Failed to register warehouses module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

// Static routes BEFORE /:id
router.get('/search', canView('warehouses'), (req, res) => warehousesController.search(req, res))
router.post('/bulk/delete', canDelete('warehouses'), validateSchema(bulkDeleteWarehouseSchema), (req, res) => warehousesController.bulkDelete(req, res))
router.get('/branch/:branchId', canView('warehouses'), (req, res) => warehousesController.getByBranch(req, res))

// CRUD
router.get('/', canView('warehouses'), (req, res) => warehousesController.list(req, res))
router.post('/', canInsert('warehouses'), validateSchema(createWarehouseSchema), (req, res) => warehousesController.create(req, res))
router.get('/:id', canView('warehouses'), validateSchema(warehouseIdSchema), (req, res) => warehousesController.getById(req, res))
router.put('/:id', canUpdate('warehouses'), validateSchema(updateWarehouseSchema), (req, res) => warehousesController.update(req, res))
router.delete('/:id', canDelete('warehouses'), validateSchema(warehouseIdSchema), (req, res) => warehousesController.delete(req, res))
router.patch('/:id/restore', canUpdate('warehouses'), validateSchema(warehouseIdSchema), (req, res) => warehousesController.restore(req, res))

export default router
