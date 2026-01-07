import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { branchesController } from './branches.controller'
import { PermissionService } from '../../services/permission.service'
import { CreateBranchSchema, UpdateBranchSchema, BulkUpdateStatusSchema, branchIdSchema } from './branches.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'

const router = Router()

// Register module
PermissionService.registerModule('branches', 'Branch Management').catch(() => {})

// All routes require authentication
router.use(authenticate, resolveBranchContext)

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
  validateSchema(branchIdSchema),
  (req, res) => branchesController.getById(req as AuthenticatedRequest, res)
)

// Create branch
router.post(
  '/',
  canInsert('branches'),
  validateSchema(CreateBranchSchema),
  (req, res) => branchesController.create(req as ValidatedAuthRequest<typeof CreateBranchSchema>, res)
)

// Update branch
router.put(
  '/:id',
  canUpdate('branches'),
  validateSchema(UpdateBranchSchema),
  (req, res) => branchesController.update(req as ValidatedAuthRequest<typeof UpdateBranchSchema>, res)
)

// Delete branch
router.delete(
  '/:id',
  canDelete('branches'),
  validateSchema(branchIdSchema),
  (req, res) => branchesController.delete(req as AuthenticatedRequest, res)
)

// Bulk update status
router.post(
  '/bulk/update-status',
  canUpdate('branches'),
  validateSchema(BulkUpdateStatusSchema),
  (req, res) => branchesController.bulkUpdateStatus(req as ValidatedAuthRequest<typeof BulkUpdateStatusSchema>, res)
)

export default router
