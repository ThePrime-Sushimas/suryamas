import { Router } from 'express'
import { employeesController } from './employees.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { upload } from '../../middleware/upload.middleware'
import { exportLimiter } from '../../middleware/rateLimiter.middleware'
import { PermissionService } from '../../services/permission.service'
import { validateSchema, ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { CreateEmployeeSchema, UpdateEmployeeSchema, UpdateProfileSchema, EmployeeSearchSchema, BulkUpdateActiveSchema, UpdateActiveSchema, BulkDeleteSchema } from './employees.schema'
import type { AuthenticatedPaginatedRequest, AuthenticatedRequest } from '../../types/request.types'
import './employees.openapi' // Register OpenAPI docs
import rateLimit from 'express-rate-limit'

// Auto-register employees module
PermissionService.registerModule('employees', 'Employee Management System')

const router = Router()

// Rate limiter for export/import operations
const exportImportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many export/import requests, please try again later'
})

// Apply branch context to all routes
router.use(authenticate, resolveBranchContext)

// ============================================
// LIST & SEARCH
// ============================================

router.get('/', canView('employees'), queryMiddleware({
  allowedSortFields: ['employee_id', 'full_name', 'job_position', 'email', 'mobile_phone', 'join_date', 'is_active', 'created_at', 'id']
}), (req, res) => 
  employeesController.list(req as AuthenticatedPaginatedRequest, res))

// Get unassigned employees
router.get('/unassigned', canView('employees'), queryMiddleware({
  allowedSortFields: ['employee_id', 'full_name', 'job_position', 'email', 'mobile_phone', 'join_date', 'is_active', 'created_at', 'id']
}), (req, res) => 
  employeesController.getUnassigned(req as AuthenticatedPaginatedRequest, res))

// Search with pagination
router.get('/search', canView('employees'), queryMiddleware({
  allowedSortFields: ['employee_id', 'full_name', 'job_position', 'email', 'mobile_phone', 'join_date', 'is_active', 'created_at', 'id']
}), validateSchema(EmployeeSearchSchema), (req, res) => 
  employeesController.search(req as AuthenticatedPaginatedRequest, res))

router.get('/autocomplete', canView('employees'), (req, res) => 
  employeesController.autocomplete(req as AuthenticatedRequest, res))

router.get('/filter-options', canView('employees'), (req, res) => 
  employeesController.getFilterOptions(req as AuthenticatedRequest, res))

// ============================================
// PROFILE (no permission check - user can view own profile)
// ============================================

router.get('/profile', (req, res) => 
  employeesController.getProfile(req as AuthenticatedRequest, res))

router.put('/profile', validateSchema(UpdateProfileSchema), (req, res) => 
  employeesController.updateProfile(req as ValidatedAuthRequest<typeof UpdateProfileSchema>, res))

router.post('/profile/picture', upload.single('picture'), (req, res) => 
  employeesController.uploadProfilePicture(req as AuthenticatedRequest, res))

// ============================================
// EXPORT & IMPORT (JOB-BASED)
// ============================================

// Create export job - returns job ID immediately
router.post('/export/job', 
  canView('employees'),
  exportImportLimiter,
  (req, res) => employeesController.createExportJob(req as AuthenticatedRequest, res)
)

// Create import job - returns job ID immediately
router.post('/import/job', 
  canInsert('employees'),
  upload.single('file'),
  exportImportLimiter,
  (req, res) => employeesController.createImportJob(req as AuthenticatedRequest, res)
)

// ============================================
// LEGACY EXPORT & IMPORT (for backward compatibility)
// ============================================

router.get('/export/token', canView('employees'), exportLimiter, (req, res) => 
  employeesController.generateExportToken(req as AuthenticatedRequest, res))

router.get('/export', canView('employees'), queryMiddleware({
  allowedSortFields: ['employee_id', 'full_name', 'job_position', 'email', 'mobile_phone', 'join_date', 'is_active', 'created_at', 'id'],
  pagination: false
}), exportLimiter, (req, res) => 
  employeesController.exportData(req as AuthenticatedPaginatedRequest, res))

router.post('/import/preview', canInsert('employees'), upload.single('file'), (req, res) => 
  employeesController.previewImport(req as AuthenticatedRequest, res))

router.post('/import', canInsert('employees'), upload.single('file'), exportLimiter, (req, res) => 
  employeesController.importData(req as AuthenticatedRequest, res))

// ============================================
// BULK ACTIONS
// ============================================

router.post('/bulk/update-active', canUpdate('employees'), validateSchema(BulkUpdateActiveSchema), (req, res) => 
  employeesController.bulkUpdateActive(req as ValidatedAuthRequest<typeof BulkUpdateActiveSchema>, res))

router.post('/bulk/delete', canDelete('employees'), validateSchema(BulkDeleteSchema), (req, res) => 
  employeesController.bulkDelete(req as ValidatedAuthRequest<typeof BulkDeleteSchema>, res))

router.post('/bulk/restore', canUpdate('employees'), validateSchema(BulkDeleteSchema), (req, res) => 
  employeesController.bulkRestore(req as ValidatedAuthRequest<typeof BulkDeleteSchema>, res))

// ============================================
// EMPLOYEE CRUD
// ============================================

router.post('/', canInsert('employees'), upload.single('profile_picture'), validateSchema(CreateEmployeeSchema), (req, res) => 
  employeesController.create(req as ValidatedAuthRequest<typeof CreateEmployeeSchema>, res))

router.get('/:id', canView('employees'), (req, res) => 
  employeesController.getById(req as AuthenticatedRequest, res))

router.put('/:id', canUpdate('employees'), upload.single('profile_picture'), validateSchema(UpdateEmployeeSchema), (req, res) => 
  employeesController.update(req as ValidatedAuthRequest<typeof UpdateEmployeeSchema>, res))

router.delete('/:id', canDelete('employees'), (req, res) => 
  employeesController.delete(req as AuthenticatedRequest, res))

router.post('/:id/restore', canUpdate('employees'), (req, res) => 
  employeesController.restore(req as AuthenticatedRequest, res))

router.patch('/:id/active', canUpdate('employees'), validateSchema(UpdateActiveSchema), (req, res) => 
  employeesController.updateActive(req as ValidatedAuthRequest<typeof UpdateActiveSchema>, res))

export default router

