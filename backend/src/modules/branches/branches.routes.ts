import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { branchesController } from './branches.controller'
import { PermissionService } from '../../services/permission.service'

const router = Router()

// Register module
PermissionService.registerModule('branches', 'Branch Management').catch(() => {})

// All routes require authentication
router.use(authenticate)

// List branches
router.get(
  '/',
  canView('branches'),
  paginationMiddleware,
  sortMiddleware,
  filterMiddleware,
  branchesController.list
)

// Search branches
router.get(
  '/search',
  canView('branches'),
  paginationMiddleware,
  sortMiddleware,
  filterMiddleware,
  branchesController.search
)

// Get minimal active branches (for dropdown)
router.get(
  '/minimal/active',
  authenticate,
  branchesController.minimalActive
)

// Get filter options
router.get(
  '/filter-options',
  canView('branches'),
  branchesController.getFilterOptions
)

// Get branch by ID
router.get(
  '/:id',
  canView('branches'),
  branchesController.getById
)

// Create branch
router.post(
  '/',
  canInsert('branches'),
  branchesController.create
)

// Update branch
router.put(
  '/:id',
  canUpdate('branches'),
  branchesController.update
)

// Delete branch
router.delete(
  '/:id',
  canDelete('branches'),
  branchesController.delete
)

// Bulk update status
router.post(
  '/bulk/update-status',
  canUpdate('branches'),
  branchesController.bulkUpdateStatus
)

export default router
