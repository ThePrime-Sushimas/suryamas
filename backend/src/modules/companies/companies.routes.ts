import { Router } from 'express'
import { companiesController } from './companies.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { exportLimiter } from '../../middleware/rateLimiter.middleware'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('companies', 'Company Management').catch((error) => {
  console.error('Failed to register companies module:', error.message)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('companies'), paginationMiddleware, sortMiddleware, filterMiddleware, (req, res) => 
  companiesController.list(req as AuthenticatedQueryRequest, res))

router.get('/search', canView('companies'), paginationMiddleware, sortMiddleware, filterMiddleware, (req, res) => 
  companiesController.search(req as AuthenticatedQueryRequest, res))

router.get('/filter-options', canView('companies'), (req, res) => 
  companiesController.getFilterOptions(req as AuthenticatedRequest, res))

router.get('/export/token', canView('companies'), exportLimiter, (req, res) => 
  companiesController.generateExportToken(req as AuthenticatedRequest, res))

router.get('/export', canView('companies'), exportLimiter, (req, res) => 
  companiesController.exportData(req as AuthenticatedQueryRequest, res))

router.post('/import/preview', canInsert('companies'), (req, res) => 
  companiesController.previewImport(req as AuthenticatedRequest, res))

router.post('/import', canInsert('companies'), (req, res) => 
  companiesController.importData(req as AuthenticatedRequest, res))

router.post('/bulk/status', canUpdate('companies'), (req, res) => 
  companiesController.bulkUpdateStatus(req as AuthenticatedRequest, res))

router.post('/bulk/delete', canDelete('companies'), (req, res) => 
  companiesController.bulkDelete(req as AuthenticatedRequest, res))

router.post('/', canInsert('companies'), (req, res) => 
  companiesController.create(req as AuthenticatedRequest, res))

router.get('/:id', canView('companies'), (req, res) => 
  companiesController.getById(req as AuthenticatedRequest, res))

router.put('/:id', canUpdate('companies'), (req, res) => 
  companiesController.update(req as AuthenticatedRequest, res))

router.delete('/:id', canDelete('companies'), (req, res) => 
  companiesController.delete(req as AuthenticatedRequest, res))

export default router
