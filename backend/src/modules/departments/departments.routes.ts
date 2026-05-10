import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { departmentsController } from './departments.controller'
import { createDepartmentSchema, updateDepartmentSchema, departmentIdSchema } from './departments.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('departments', 'Department Management').catch((err) => {
  console.error('Failed to register departments module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('departments'), (req, res) => departmentsController.list(req, res))
router.post('/', requireWriteAccess, canInsert('departments'), validateSchema(createDepartmentSchema), (req, res) => departmentsController.create(req, res))
router.get('/:id', canView('departments'), validateSchema(departmentIdSchema), (req, res) => departmentsController.getById(req, res))
router.put('/:id', requireWriteAccess, canUpdate('departments'), validateSchema(updateDepartmentSchema), (req, res) => departmentsController.update(req, res))
router.delete('/:id', requireWriteAccess, canDelete('departments'), validateSchema(departmentIdSchema), (req, res) => departmentsController.delete(req, res))

export default router
