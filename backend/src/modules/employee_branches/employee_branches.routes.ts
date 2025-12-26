import { Router } from 'express'
import { employeeBranchesController } from './employee_branches.controller'
import { authenticate } from '../../middleware/auth.middleware'
import type { AuthenticatedRequest } from '../../types/request.types'

const router = Router()

// All routes require authentication
router.use(authenticate)

// List all employee branches (paginated)
router.get('/', (req, res, next) => 
  employeeBranchesController.list(req, res, next))

// Get all branches for an employee
router.get('/employee/:employeeId', (req, res, next) => 
  employeeBranchesController.getByEmployeeId(req, res, next))

// Get primary branch for an employee
router.get('/employee/:employeeId/primary', (req, res, next) => 
  employeeBranchesController.getPrimaryBranch(req, res, next))

// Get all employees in a branch (paginated)
router.get('/branch/:branchId', (req, res, next) => 
  employeeBranchesController.getByBranchId(req, res, next))

// Create employee branch assignment
router.post('/', (req, res, next) => 
  employeeBranchesController.create(req, res, next))

// Bulk delete
router.post('/bulk/delete', (req, res, next) => 
  employeeBranchesController.bulkDelete(req, res, next))

// Set primary branch for employee
router.put('/employee/:employeeId/branch/:branchId/primary', (req, res, next) =>
  employeeBranchesController.setPrimaryBranch(req, res, next)
)

// Update employee branch
router.put('/:id', (req, res, next) => 
  employeeBranchesController.update(req, res, next))

// Get by ID (must be after specific routes)
router.get('/:id', (req, res, next) => 
  employeeBranchesController.getById(req, res, next))

// Delete employee branch assignment
router.delete('/:id', (req, res, next) => 
  employeeBranchesController.delete(req, res, next))

// Delete by employee and branch
router.delete('/employee/:employeeId/branch/:branchId', (req, res, next) =>
  employeeBranchesController.deleteByEmployeeAndBranch(req, res, next)
)

export default router
