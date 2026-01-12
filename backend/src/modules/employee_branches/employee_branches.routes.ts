import { Router } from 'express'
import { employeeBranchesController } from './employee_branches.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema, ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import { CreateEmployeeBranchSchema, UpdateEmployeeBranchSchema, employeeBranchIdSchema, BulkDeleteSchema, employeeIdSchema, branchIdSchema } from './employee_branches.schema'
import type { AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('employee_branches', 'Employee Branch Management')

const router = Router()

router.use(authenticate, resolveBranchContext)

// Public endpoint - get current user's branches (no permission check)
router.get('/me', (req, res) => 
  employeeBranchesController.getMyBranches(req as AuthenticatedRequest, res))

router.get('/', canView('employee_branches'), (req, res) => 
  employeeBranchesController.list(req, res))

router.get('/employee/:employeeId', canView('employee_branches'), validateSchema(employeeIdSchema), (req, res) => 
  employeeBranchesController.getByEmployeeId(req, res))

router.get('/employee/:employeeId/primary', canView('employee_branches'), validateSchema(employeeIdSchema), (req, res) => 
  employeeBranchesController.getPrimaryBranch(req, res))

router.get('/branch/:branchId', canView('employee_branches'), validateSchema(branchIdSchema), (req, res) => 
  employeeBranchesController.getByBranchId(req, res))

router.post('/', canInsert('employee_branches'), validateSchema(CreateEmployeeBranchSchema), (req, res) => 
  employeeBranchesController.create(req as ValidatedAuthRequest<typeof CreateEmployeeBranchSchema>, res))

router.post('/bulk/delete', canDelete('employee_branches'), validateSchema(BulkDeleteSchema), (req, res) => 
  employeeBranchesController.bulkDelete(req as ValidatedAuthRequest<typeof BulkDeleteSchema>, res))

router.put('/employee/:employeeId/branch/:branchId/primary', canUpdate('employee_branches'), validateSchema(employeeIdSchema), (req, res) =>
  employeeBranchesController.setPrimaryBranch(req as AuthenticatedRequest, res)
)

router.put('/:id', canUpdate('employee_branches'), validateSchema(UpdateEmployeeBranchSchema), (req, res) => 
  employeeBranchesController.update(req as ValidatedAuthRequest<typeof UpdateEmployeeBranchSchema>, res))

router.put('/:id/suspend', canUpdate('employee_branches'), validateSchema(employeeBranchIdSchema), (req, res) => 
  employeeBranchesController.suspend(req as AuthenticatedRequest, res))

router.put('/:id/activate', canUpdate('employee_branches'), validateSchema(employeeBranchIdSchema), (req, res) => 
  employeeBranchesController.activate(req as AuthenticatedRequest, res))

router.get('/:id', canView('employee_branches'), validateSchema(employeeBranchIdSchema), (req, res) => 
  employeeBranchesController.getById(req, res))

router.delete('/:id', canDelete('employee_branches'), validateSchema(employeeBranchIdSchema), (req, res) => 
  employeeBranchesController.delete(req as AuthenticatedRequest, res))

router.delete('/employee/:employeeId/branch/:branchId', canDelete('employee_branches'), validateSchema(employeeIdSchema), (req, res) =>
  employeeBranchesController.deleteByEmployeeAndBranch(req as AuthenticatedRequest, res)
)

export default router
