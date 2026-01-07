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
router.get('/me', (req, res, next) => 
  employeeBranchesController.getMyBranches(req as AuthenticatedRequest, res, next))

router.get('/', canView('employee_branches'), (req, res, next) => 
  employeeBranchesController.list(req, res, next))

router.get('/employee/:employeeId', canView('employee_branches'), validateSchema(employeeIdSchema), (req, res, next) => 
  employeeBranchesController.getByEmployeeId(req, res, next))

router.get('/employee/:employeeId/primary', canView('employee_branches'), validateSchema(employeeIdSchema), (req, res, next) => 
  employeeBranchesController.getPrimaryBranch(req, res, next))

router.get('/branch/:branchId', canView('employee_branches'), validateSchema(branchIdSchema), (req, res, next) => 
  employeeBranchesController.getByBranchId(req, res, next))

router.post('/', canInsert('employee_branches'), validateSchema(CreateEmployeeBranchSchema), (req, res, next) => 
  employeeBranchesController.create(req as ValidatedAuthRequest<typeof CreateEmployeeBranchSchema>, res, next))

router.post('/bulk/delete', canDelete('employee_branches'), validateSchema(BulkDeleteSchema), (req, res, next) => 
  employeeBranchesController.bulkDelete(req as ValidatedAuthRequest<typeof BulkDeleteSchema>, res, next))

router.put('/employee/:employeeId/branch/:branchId/primary', canUpdate('employee_branches'), validateSchema(employeeIdSchema), (req, res, next) =>
  employeeBranchesController.setPrimaryBranch(req as AuthenticatedRequest, res, next)
)

router.put('/:id', canUpdate('employee_branches'), validateSchema(UpdateEmployeeBranchSchema), (req, res, next) => 
  employeeBranchesController.update(req as ValidatedAuthRequest<typeof UpdateEmployeeBranchSchema>, res, next))

router.get('/:id', canView('employee_branches'), validateSchema(employeeBranchIdSchema), (req, res, next) => 
  employeeBranchesController.getById(req, res, next))

router.delete('/:id', canDelete('employee_branches'), validateSchema(employeeBranchIdSchema), (req, res, next) => 
  employeeBranchesController.delete(req as AuthenticatedRequest, res, next))

router.delete('/employee/:employeeId/branch/:branchId', canDelete('employee_branches'), validateSchema(employeeIdSchema), (req, res, next) =>
  employeeBranchesController.deleteByEmployeeAndBranch(req as AuthenticatedRequest, res, next)
)

export default router
