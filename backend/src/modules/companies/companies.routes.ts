import { Router } from 'express'
import { companiesController } from './companies.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { exportLimiter } from '../../middleware/rateLimiter.middleware'
import { validateSchema, ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import { createCompanySchema, updateCompanySchema, companyIdSchema, bulkUpdateStatusSchema, bulkDeleteSchema } from './companies.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import rateLimit from 'express-rate-limit'

PermissionService.registerModule('companies', 'Company Management').catch((error) => {
  console.error('Failed to register companies module:', error.message)
})

const router = Router()

// Rate limiter for export/import operations
const exportImportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many export/import requests, please try again later'
})

router.use(authenticate, resolveBranchContext)

// ============================================
// LIST & SEARCH
// ============================================

router.get('/', canView('companies'), queryMiddleware({
  allowedSortFields: ['company_name', 'company_code', 'city', 'status', 'created_at', 'updated_at', 'id']
}), (req, res) => 
  companiesController.list(req as AuthenticatedQueryRequest, res))

router.get('/search', canView('companies'), queryMiddleware({
  allowedSortFields: ['company_name', 'company_code', 'city', 'status', 'created_at', 'updated_at', 'id']
}), (req, res) => 
  companiesController.search(req as AuthenticatedQueryRequest, res))

router.get('/filter-options', canView('companies'), (req, res) => 
  companiesController.getFilterOptions(req as AuthenticatedRequest, res))

// ============================================
// EXPORT & IMPORT (JOB-BASED)
// ============================================

// Create export job - returns job ID immediately
router.post('/export/job', 
  canView('companies'),
  exportImportLimiter,
  (req, res) => companiesController.createExportJob(req as AuthenticatedRequest, res)
)

// Create import job - returns job ID immediately
router.post('/import/job', 
  canInsert('companies'),
  exportImportLimiter,
  (req, res) => companiesController.createImportJob(req as AuthenticatedRequest, res)
)

// ============================================
// LEGACY EXPORT & IMPORT (for backward compatibility)
// ============================================

router.get('/export/token', canView('companies'), exportLimiter, (req, res) => 
  companiesController.generateExportToken(req as AuthenticatedRequest, res))

router.get('/export', canView('companies'), exportLimiter, (req, res) => 
  companiesController.exportData(req as AuthenticatedQueryRequest, res))

router.post('/import/preview', canInsert('companies'), (req, res) => 
  companiesController.previewImport(req as AuthenticatedRequest, res))

router.post('/import', canInsert('companies'), exportLimiter, (req, res) => 
  companiesController.importData(req as AuthenticatedRequest, res))

// ============================================
// BULK OPERATIONS
// ============================================

router.post('/bulk/status', canUpdate('companies'), validateSchema(bulkUpdateStatusSchema), (req, res) => 
  companiesController.bulkUpdateStatus(req as ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res))

router.post('/bulk/delete', canDelete('companies'), validateSchema(bulkDeleteSchema), (req, res) => 
  companiesController.bulkDelete(req as ValidatedAuthRequest<typeof bulkDeleteSchema>, res))

// ============================================
// COMPANY CRUD
// ============================================

router.post('/', canInsert('companies'), validateSchema(createCompanySchema), (req, res) => 
  companiesController.create(req as ValidatedAuthRequest<typeof createCompanySchema>, res))

router.get('/:id', canView('companies'), validateSchema(companyIdSchema), (req, res) => 
  companiesController.getById(req as AuthenticatedRequest, res))

router.put('/:id', canUpdate('companies'), validateSchema(updateCompanySchema), (req, res) => 
  companiesController.update(req as ValidatedAuthRequest<typeof updateCompanySchema>, res))

router.delete('/:id', canDelete('companies'), validateSchema(companyIdSchema), (req, res) => 
  companiesController.delete(req as AuthenticatedRequest, res))

export default router

