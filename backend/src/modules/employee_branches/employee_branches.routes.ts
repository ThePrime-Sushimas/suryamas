import { Router } from 'express'
import { employeeBranchesController } from './employee_branches.controller'
import { authenticate } from '../../middleware/auth.middleware'
import type { AuthenticatedRequest } from '../../types/request.types'

const router = Router()

// List all employee branches
router.get('/', authenticate, (req, res) => 
  employeeBranchesController.list(req as AuthenticatedRequest, res))

// Get by ID (must be before /employee/:employeeId)
router.get('/:id', authenticate, (req, res) => 
  employeeBranchesController.getById(req as AuthenticatedRequest, res))

// Get all branches for an employee
router.get('/employee/:employeeId', authenticate, (req, res) => 
  employeeBranchesController.getByEmployeeId(req as AuthenticatedRequest, res))

// Get primary branch for an employee
router.get('/employee/:employeeId/primary', authenticate, (req, res) => 
  employeeBranchesController.getPrimaryBranch(req as AuthenticatedRequest, res))

// Get all employees in a branch
router.get('/branch/:branchId', authenticate, (req, res) => 
  employeeBranchesController.getByBranchId(req as AuthenticatedRequest, res))

// Create employee branch assignment
router.post('/', authenticate, (req, res) => 
  employeeBranchesController.create(req as AuthenticatedRequest, res))

// Update employee branch
router.put('/:id', authenticate, (req, res) => 
  employeeBranchesController.update(req as AuthenticatedRequest, res))

// Set primary branch for employee
router.put('/employee/:employeeId/branch/:branchId/primary', authenticate, (req, res) =>
  employeeBranchesController.setPrimaryBranch(req as AuthenticatedRequest, res)
)

// Delete employee branch assignment
router.delete('/:id', authenticate, (req, res) => 
  employeeBranchesController.delete(req as AuthenticatedRequest, res))

// Delete by employee and branch
router.delete('/employee/:employeeId/branch/:branchId', authenticate, (req, res) =>
  employeeBranchesController.deleteByEmployeeAndBranch(req as AuthenticatedRequest, res)
)

// Bulk delete
router.post('/bulk/delete', authenticate, (req, res) => 
  employeeBranchesController.bulkDelete(req as AuthenticatedRequest, res))

export default router
