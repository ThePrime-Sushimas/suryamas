import { Router } from 'express'
import { companiesController } from './companies.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { exportLimiter } from '../../middleware/rateLimiter.middleware'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('companies', 'Company Management').catch((error) => {
  console.error('Failed to register companies module:', error.message)
})

const router = Router()

router.get('/', authenticate, canView('companies'), paginationMiddleware, sortMiddleware, filterMiddleware, (req, res) => companiesController.list(req as any, res))

router.get('/search', authenticate, canView('companies'), paginationMiddleware, sortMiddleware, filterMiddleware, (req, res) => companiesController.search(req as any, res))

router.get('/filter-options', authenticate, canView('companies'), (req, res) => companiesController.getFilterOptions(req, res))

router.get('/export/token', authenticate, canView('companies'), exportLimiter, (req, res) => companiesController.generateExportToken(req, res))
router.get('/export', authenticate, canView('companies'), filterMiddleware, (req, res) => companiesController.exportData(req as any, res))
router.post('/import/preview', authenticate, canInsert('companies'), (req, res) => companiesController.previewImport(req, res))
router.post('/import', authenticate, canInsert('companies'), (req, res) => companiesController.importData(req, res))

router.post('/bulk/status', authenticate, canUpdate('companies'), (req, res) => companiesController.bulkUpdateStatus(req, res))
router.post('/bulk/delete', authenticate, canDelete('companies'), (req, res) => companiesController.bulkDelete(req, res))

router.post('/', authenticate, canInsert('companies'), (req, res) => companiesController.create(req, res))
router.get('/:id', authenticate, canView('companies'), (req, res) => companiesController.getById(req, res))
router.put('/:id', authenticate, canUpdate('companies'), (req, res) => companiesController.update(req, res))
router.delete('/:id', authenticate, canDelete('companies'), (req, res) => companiesController.delete(req, res))

export default router
