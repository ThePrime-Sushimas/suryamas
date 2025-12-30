import { Router } from 'express'
import { employeesController } from './employees.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { upload } from '../../middleware/upload.middleware'
import { exportLimiter } from '../../middleware/rateLimiter.middleware'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedPaginatedRequest, AuthenticatedRequest } from '../../types/request.types'

// Auto-register employees module
PermissionService.registerModule('employees', 'Employee Management System')

const router = Router()

// Apply branch context to all routes
router.use(authenticate, resolveBranchContext)

// List with pagination
router.get('/', canView('employees'), paginationMiddleware, (req, res) => 
  employeesController.list(req as AuthenticatedPaginatedRequest, res))

// Get unassigned employees
router.get('/unassigned', canView('employees'), paginationMiddleware, (req, res) => 
  employeesController.getUnassigned(req as AuthenticatedPaginatedRequest, res))

// Search with pagination
router.get('/search', canView('employees'), paginationMiddleware, (req, res) => 
  employeesController.search(req as AuthenticatedPaginatedRequest, res))

router.get('/autocomplete', canView('employees'), (req, res) => 
  employeesController.autocomplete(req as AuthenticatedRequest, res))

router.get('/filter-options', canView('employees'), (req, res) => 
  employeesController.getFilterOptions(req as AuthenticatedRequest, res))

// Profile (no permission check - user can view own profile)
router.get('/profile', (req, res) => 
  employeesController.getProfile(req as AuthenticatedRequest, res))

router.put('/profile', (req, res) => 
  employeesController.updateProfile(req as AuthenticatedRequest, res))

router.post('/profile/picture', upload.single('picture'), (req, res) => 
  employeesController.uploadProfilePicture(req as AuthenticatedRequest, res))

// Export & Import
router.get('/export/token', canView('employees'), exportLimiter, (req, res) => 
  employeesController.generateExportToken(req as AuthenticatedRequest, res))

router.get('/export', canView('employees'), filterMiddleware, (req, res) => 
  employeesController.exportData(req as AuthenticatedPaginatedRequest, res))

router.post('/import/preview', canInsert('employees'), upload.single('file'), (req, res) => 
  employeesController.previewImport(req as AuthenticatedRequest, res))

router.post('/import', canInsert('employees'), upload.single('file'), (req, res) => 
  employeesController.importData(req as AuthenticatedRequest, res))

// Bulk Actions
router.post('/bulk/update-active', canUpdate('employees'), (req, res) => 
  employeesController.bulkUpdateActive(req as AuthenticatedRequest, res))

router.post('/bulk/delete', canDelete('employees'), (req, res) => 
  employeesController.bulkDelete(req as AuthenticatedRequest, res))

// Employee CRUD
router.post('/', canInsert('employees'), upload.single('profile_picture'), (req, res) => 
  employeesController.create(req as AuthenticatedRequest, res))

router.get('/:id', canView('employees'), (req, res) => 
  employeesController.getById(req as AuthenticatedRequest, res))

router.put('/:id', canUpdate('employees'), upload.single('profile_picture'), (req, res) => 
  employeesController.update(req as AuthenticatedRequest, res))

router.delete('/:id', canDelete('employees'), (req, res) => 
  employeesController.delete(req as AuthenticatedRequest, res))

export default router
