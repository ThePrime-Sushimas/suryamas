import { Router } from 'express'
import { companiesController } from './companies.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { exportLimiter } from '../../middleware/rateLimiter.middleware'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('companies', 'Company Management').catch((error) => {
  console.error('Failed to register companies module:', error.message)
})

const router = Router()

router.get('/', authenticate, canView('companies'), paginationMiddleware, sortMiddleware, (req, res) => 
  companiesController.list(req as AuthenticatedQueryRequest, res))

router.get('/search', authenticate, canView('companies'), paginationMiddleware, sortMiddleware, (req, res) => 
  companiesController.search(req as AuthenticatedQueryRequest, res))

router.get('/filter-options', authenticate, canView('companies'), (req, res) => 
  companiesController.getFilterOptions(req as AuthenticatedRequest, res))

router.get('/export/token', authenticate, canView('companies'), exportLimiter, (req, res) => 
  companiesController.generateExportToken(req as AuthenticatedRequest, res))

router.get('/export', authenticate, canView('companies'), (req, res) => 
  companiesController.exportData(req as AuthenticatedQueryRequest, res))

router.post('/import/preview', authenticate, canInsert('companies'), (req, res) => 
  companiesController.previewImport(req as AuthenticatedRequest, res))

router.post('/import', authenticate, canInsert('companies'), (req, res) => 
  companiesController.importData(req as AuthenticatedRequest, res))

router.post('/bulk/status', authenticate, canUpdate('companies'), (req, res) => 
  companiesController.bulkUpdateStatus(req as AuthenticatedRequest, res))

router.post('/bulk/delete', authenticate, canDelete('companies'), (req, res) => 
  companiesController.bulkDelete(req as AuthenticatedRequest, res))

router.post('/', authenticate, canInsert('companies'), (req, res) => 
  companiesController.create(req as AuthenticatedRequest, res))

router.get('/:id', authenticate, canView('companies'), (req, res) => 
  companiesController.getById(req as AuthenticatedRequest, res))

router.put('/:id', authenticate, canUpdate('companies'), (req, res) => 
  companiesController.update(req as AuthenticatedRequest, res))

router.delete('/:id', authenticate, canDelete('companies'), (req, res) => 
  companiesController.delete(req as AuthenticatedRequest, res))

export default router
