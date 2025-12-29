import { Router } from 'express'
import { metricUnitsController } from './metricUnits.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import { logError } from '../../config/logger'

PermissionService.registerModule('metric-units', 'Metric Units Management').catch(err => {
  logError('Failed to register metric-units module', { error: err.message })
})

const router = Router()

router.get('/active', 
  authenticate, 
  canView('metric-units'), 
  paginationMiddleware, 
  sortMiddleware, 
  (req, res) => metricUnitsController.listActive(req as AuthenticatedQueryRequest, res)
)

router.get('/filter-options', 
  authenticate, 
  canView('metric-units'), 
  (req, res) => metricUnitsController.getFilterOptions(req as AuthenticatedRequest, res)
)

router.get('/', 
  authenticate, 
  canView('metric-units'), 
  paginationMiddleware, 
  sortMiddleware,
  filterMiddleware,
  (req, res) => metricUnitsController.list(req as AuthenticatedQueryRequest, res)
)

router.post('/bulk/status', 
  authenticate, 
  canUpdate('metric-units'), 
  (req, res) => metricUnitsController.bulkUpdateStatus(req as AuthenticatedRequest, res)
)

router.post('/', 
  authenticate, 
  canInsert('metric-units'), 
  (req, res) => metricUnitsController.create(req as AuthenticatedRequest, res)
)

router.get('/:id', 
  authenticate, 
  canView('metric-units'), 
  (req, res) => metricUnitsController.getById(req as AuthenticatedRequest, res)
)

router.put('/:id', 
  authenticate, 
  canUpdate('metric-units'), 
  (req, res) => metricUnitsController.update(req as AuthenticatedRequest, res)
)

router.delete('/:id', 
  authenticate, 
  canDelete('metric-units'), 
  (req, res) => metricUnitsController.delete(req as AuthenticatedRequest, res)
)

router.post('/:id/restore',
  authenticate,
  canUpdate('metric-units'),
  (req, res) => metricUnitsController.restore(req as AuthenticatedRequest, res)
)

export default router
