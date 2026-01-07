import { Router } from 'express'
import { metricUnitsController } from './metricUnits.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { validateSchema, ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import { CreateMetricUnitSchema, UpdateMetricUnitSchema, metricUnitIdSchema, BulkUpdateStatusSchema } from './metricUnits.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import { logError } from '../../config/logger'

PermissionService.registerModule('metric-units', 'Metric Units Management').catch(err => {
  logError('Failed to register metric-units module', { error: err.message })
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/active', 
  canView('metric-units'), 
  paginationMiddleware, 
  sortMiddleware, 
  (req, res) => metricUnitsController.listActive(req as AuthenticatedQueryRequest, res)
)

router.get('/filter-options', 
  canView('metric-units'), 
  (req, res) => metricUnitsController.getFilterOptions(req as AuthenticatedRequest, res)
)

router.get('/', 
  canView('metric-units'), 
  paginationMiddleware, 
  sortMiddleware,
  filterMiddleware,
  (req, res) => metricUnitsController.list(req as AuthenticatedQueryRequest, res)
)

router.post('/bulk/status', 
  canUpdate('metric-units'), 
  validateSchema(BulkUpdateStatusSchema),
  (req, res) => metricUnitsController.bulkUpdateStatus(req as ValidatedAuthRequest<typeof BulkUpdateStatusSchema>, res)
)

router.post('/', 
  canInsert('metric-units'), 
  validateSchema(CreateMetricUnitSchema),
  (req, res) => metricUnitsController.create(req as ValidatedAuthRequest<typeof CreateMetricUnitSchema>, res)
)

router.get('/:id', 
  canView('metric-units'), 
  validateSchema(metricUnitIdSchema),
  (req, res) => metricUnitsController.getById(req as AuthenticatedRequest, res)
)

router.put('/:id', 
  canUpdate('metric-units'), 
  validateSchema(UpdateMetricUnitSchema),
  (req, res) => metricUnitsController.update(req as ValidatedAuthRequest<typeof UpdateMetricUnitSchema>, res)
)

router.delete('/:id', 
  canDelete('metric-units'), 
  validateSchema(metricUnitIdSchema),
  (req, res) => metricUnitsController.delete(req as AuthenticatedRequest, res)
)

router.post('/:id/restore',
  canUpdate('metric-units'),
  validateSchema(metricUnitIdSchema),
  (req, res) => metricUnitsController.restore(req as AuthenticatedRequest, res)
)

export default router
