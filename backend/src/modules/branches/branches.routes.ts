import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { branchesController } from './branches.controller'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

const router = Router()

// Register module
PermissionService.registerModule('branches', 'Branch Management').catch(() => {})

// All routes require authentication
router.use(authenticate)

// Get filter options (must be before /:id route)
router.get(
  '/filter-options',
  canView('branches'),
  (req, res) => branchesController.getFilterOptions(req as AuthenticatedRequest, res)
)

// Get minimal active branches (for dropdown)
router.get(
  '/minimal/active',
  canView('branches'),
  (req, res) => branchesController.minimalActive(req as AuthenticatedRequest, res)
)

// Search branches
router.get(
  '/search',
  canView('branches'),
  paginationMiddleware,
  sortMiddleware,
  filterMiddleware,
  (req, res) => branchesController.search(req as AuthenticatedQueryRequest, res)
)

// List branches
router.get(
  '/',
  canView('branches'),
  paginationMiddleware,
  sortMiddleware,
  filterMiddleware,
  (req, res) => branchesController.list(req as AuthenticatedQueryRequest, res)
)

// Get branch by ID
router.get(
  '/:id',
  canView('branches'),
  (req, res) => branchesController.getById(req as AuthenticatedRequest, res)
)

// Create branch
router.post(
  '/',
  canInsert('branches'),
  (req, res) => branchesController.create(req as AuthenticatedRequest, res)
)

// Update branch
router.put(
  '/:id',
  canUpdate('branches'),
  (req, res) => branchesController.update(req as AuthenticatedRequest, res)
)

// Delete branch
router.delete(
  '/:id',
  canDelete('branches'),
  (req, res) => branchesController.delete(req as AuthenticatedRequest, res)
)

// Bulk update status
router.post(
  '/bulk/update-status',
  canUpdate('branches'),
  (req, res) => branchesController.bulkUpdateStatus(req as AuthenticatedRequest, res)
)

export default router
