import { Router } from 'express'
import { employeeBranchesController } from './employee_branches.controller'
import { authenticate } from '../../middleware/auth.middleware'

const router = Router()

// List all employee branches
router.get('/', authenticate, (req, res) => employeeBranchesController.list(req, res))

// Get by ID (must be before /employee/:employeeId)
router.get('/:id', authenticate, (req, res) => employeeBranchesController.getById(req, res))

// Get all branches for an employee
router.get('/employee/:employeeId', authenticate, (req, res) => employeeBranchesController.getByEmployeeId(req, res))

// Get primary branch for an employee
router.get('/employee/:employeeId/primary', authenticate, (req, res) => employeeBranchesController.getPrimaryBranch(req, res))

// Get all employees in a branch
router.get('/branch/:branchId', authenticate, (req, res) => employeeBranchesController.getByBranchId(req, res))

// Create employee branch assignment
router.post('/', authenticate, (req, res) => employeeBranchesController.create(req, res))

// Update employee branch
router.put('/:id', authenticate, (req, res) => employeeBranchesController.update(req, res))

// Set primary branch for employee
router.put('/employee/:employeeId/branch/:branchId/primary', authenticate, (req, res) =>
  employeeBranchesController.setPrimaryBranch(req, res)
)

// Delete employee branch assignment
router.delete('/:id', authenticate, (req, res) => employeeBranchesController.delete(req, res))

// Delete by employee and branch
router.delete('/employee/:employeeId/branch/:branchId', authenticate, (req, res) =>
  employeeBranchesController.deleteByEmployeeAndBranch(req, res)
)

// Bulk delete
router.post('/bulk/delete', authenticate, (req, res) => employeeBranchesController.bulkDelete(req, res))

export default router
