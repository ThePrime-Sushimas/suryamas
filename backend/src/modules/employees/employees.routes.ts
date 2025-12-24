import { Router } from 'express'
import { employeesController } from './employees.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { upload } from '../../middleware/upload.middleware'
import { exportLimiter } from '../../middleware/rateLimiter.middleware'
import { PermissionService } from '../../services/permission.service'

// Auto-register employees module
PermissionService.registerModule('employees', 'Employee Management System')

const router = Router()

// List with pagination
router.get('/', authenticate, canView('employees'), paginationMiddleware, (req, res) => employeesController.list(req as any, res))

// Get unassigned employees
router.get('/unassigned', authenticate, canView('employees'), paginationMiddleware, (req, res) => employeesController.getUnassigned(req as any, res))

// Search with pagination
router.get('/search', authenticate, canView('employees'), paginationMiddleware, (req, res) => employeesController.search(req as any, res))
router.get('/autocomplete', authenticate, canView('employees'), (req, res) => employeesController.autocomplete(req, res))
router.get('/filter-options', authenticate, canView('employees'), (req, res) => employeesController.getFilterOptions(req, res))

// Profile (no permission check - user can view own profile)
router.get('/profile', authenticate, (req, res) => employeesController.getProfile(req, res))
router.put('/profile', authenticate, (req, res) => employeesController.updateProfile(req, res))
router.post('/profile/picture', authenticate, upload.single('picture'), (req, res) => employeesController.uploadProfilePicture(req, res))

// Export & Import
router.get('/export/token', authenticate, canView('employees'), exportLimiter, (req, res) => employeesController.generateExportToken(req, res))
router.get('/export', authenticate, canView('employees'), (req, res) => employeesController.exportData(req as any, res))
router.post('/import/preview', authenticate, canInsert('employees'), upload.single('file'), (req, res) => employeesController.previewImport(req, res))
router.post('/import', authenticate, canInsert('employees'), upload.single('file'), (req, res) => employeesController.importData(req, res))

// Bulk Actions
router.post('/bulk/update-active', authenticate, canUpdate('employees'), (req, res) => employeesController.bulkUpdateActive(req, res))
router.post('/bulk/delete', authenticate, canDelete('employees'), (req, res) => employeesController.bulkDelete(req, res))

// Employee CRUD
router.post('/', authenticate, canInsert('employees'), upload.single('profile_picture'), (req, res) => employeesController.create(req, res))
router.get('/:id', authenticate, canView('employees'), (req, res) => employeesController.getById(req, res))
router.put('/:id', authenticate, canUpdate('employees'), upload.single('profile_picture'), (req, res) => employeesController.update(req, res))
router.delete('/:id', authenticate, canDelete('employees'), (req, res) => employeesController.delete(req, res))

export default router
