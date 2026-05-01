import { Router } from 'express'
import { companiesController } from './companies.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { exportLimiter } from '../../middleware/rateLimiter.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import { createCompanySchema, updateCompanySchema, companyIdSchema, bulkUpdateStatusSchema, bulkDeleteSchema } from './companies.schema'
import rateLimit from 'express-rate-limit'

PermissionService.registerModule('companies', 'Company Management').catch((error) => {
  console.error('Failed to register companies module:', error.message)
})

const router = Router()

const exportImportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many export/import requests, please try again later'
})

router.use(authenticate, resolveBranchContext)

// LIST & SEARCH
router.get('/', canView('companies'), queryMiddleware({
  allowedSortFields: ['company_name', 'company_code', 'city', 'status', 'created_at', 'updated_at', 'id']
}), (req, res) => companiesController.list(req, res))

router.get('/search', canView('companies'), queryMiddleware({
  allowedSortFields: ['company_name', 'company_code', 'city', 'status', 'created_at', 'updated_at', 'id']
}), (req, res) => companiesController.search(req, res))

router.get('/filter-options', canView('companies'), (req, res) => companiesController.getFilterOptions(req, res))

// EXPORT & IMPORT (JOB-BASED)
router.post('/export/job', canView('companies'), exportImportLimiter, (req, res) => companiesController.createExportJob(req, res))
router.post('/import/job', canInsert('companies'), exportImportLimiter, (req, res) => companiesController.createImportJob(req, res))

// LEGACY EXPORT & IMPORT
router.get('/export/token', canView('companies'), exportLimiter, (req, res) => companiesController.generateExportToken(req, res))
router.get('/export', canView('companies'), exportLimiter, (req, res) => companiesController.exportData(req, res))
router.post('/import/preview', canInsert('companies'), (req, res) => companiesController.previewImport(req, res))
router.post('/import', canInsert('companies'), exportLimiter, (req, res) => companiesController.importData(req, res))

// BULK OPERATIONS
router.post('/bulk/status', canUpdate('companies'), validateSchema(bulkUpdateStatusSchema), (req, res) =>
  companiesController.bulkUpdateStatus(req, res))

router.post('/bulk/delete', canDelete('companies'), validateSchema(bulkDeleteSchema), (req, res) =>
  companiesController.bulkDelete(req, res))

// COMPANY CRUD
router.post('/', canInsert('companies'), validateSchema(createCompanySchema), (req, res) =>
  companiesController.create(req, res))

router.get('/:id', canView('companies'), validateSchema(companyIdSchema), (req, res) => companiesController.getById(req, res))

router.put('/:id', canUpdate('companies'), validateSchema(updateCompanySchema), (req, res) =>
  companiesController.update(req, res))

router.delete('/:id', canDelete('companies'), validateSchema(companyIdSchema), (req, res) => companiesController.delete(req, res))

export default router
