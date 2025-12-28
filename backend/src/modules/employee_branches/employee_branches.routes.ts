import { Router } from 'express'
import { employeeBranchesController } from './employee_branches.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('employee_branches', 'Employee Branch Management')

const router = Router()

router.use(authenticate)

router.get('/', canView('employee_branches'), (req, res, next) => 
  employeeBranchesController.list(req, res, next))

router.get('/employee/:employeeId', canView('employee_branches'), (req, res, next) => 
  employeeBranchesController.getByEmployeeId(req, res, next))

router.get('/employee/:employeeId/primary', canView('employee_branches'), (req, res, next) => 
  employeeBranchesController.getPrimaryBranch(req, res, next))

router.get('/branch/:branchId', canView('employee_branches'), (req, res, next) => 
  employeeBranchesController.getByBranchId(req, res, next))

router.post('/', canInsert('employee_branches'), (req, res, next) => 
  employeeBranchesController.create(req, res, next))

router.post('/bulk/delete', canDelete('employee_branches'), (req, res, next) => 
  employeeBranchesController.bulkDelete(req, res, next))

router.put('/employee/:employeeId/branch/:branchId/primary', canUpdate('employee_branches'), (req, res, next) =>
  employeeBranchesController.setPrimaryBranch(req, res, next)
)

router.put('/:id', canUpdate('employee_branches'), (req, res, next) => 
  employeeBranchesController.update(req, res, next))

router.get('/:id', canView('employee_branches'), (req, res, next) => 
  employeeBranchesController.getById(req, res, next))

router.delete('/:id', canDelete('employee_branches'), (req, res, next) => 
  employeeBranchesController.delete(req, res, next))

router.delete('/employee/:employeeId/branch/:branchId', canDelete('employee_branches'), (req, res, next) =>
  employeeBranchesController.deleteByEmployeeAndBranch(req, res, next)
)

export default router
