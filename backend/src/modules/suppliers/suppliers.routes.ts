import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { suppliersController } from './suppliers.controller'
import { PermissionService } from '../../services/permission.service'
import { createSupplierSchema, updateSupplierSchema, supplierIdSchema, supplierListQuerySchema } from './suppliers.schema'

const router = Router()

// Register module for permissions
PermissionService.registerModule('suppliers', 'Supplier Management').catch(() => {})

// Apply auth middleware to all routes
router.use(authenticate, resolveBranchContext)

// Routes
router.get('/options', canView('suppliers'), suppliersController.getOptions)

router.get('/', canView('suppliers'), validateSchema(supplierListQuerySchema), suppliersController.list)

router.get('/:id', canView('suppliers'), validateSchema(supplierIdSchema), suppliersController.findById)

router.post('/', canInsert('suppliers'), validateSchema(createSupplierSchema), suppliersController.create)

router.put('/:id', canUpdate('suppliers'), validateSchema(updateSupplierSchema), suppliersController.update)

router.delete('/:id', canDelete('suppliers'), validateSchema(supplierIdSchema), suppliersController.delete)

export default router