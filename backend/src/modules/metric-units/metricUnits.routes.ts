import { Router } from 'express'
import { metricUnitsController } from './metricUnits.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('metric-units', 'Metric Units Management').catch(err => {
  console.error('Failed to register metric-units module:', err.message)
})

const router = Router()

router.get('/', authenticate, canView('metric-units'), paginationMiddleware, sortMiddleware, filterMiddleware, (req, res) => metricUnitsController.list(req as any, res))

router.get('/active', authenticate, canView('metric-units'), paginationMiddleware, sortMiddleware, (req, res) => metricUnitsController.listActive(req as any, res))

router.get('/filter-options', authenticate, canView('metric-units'), (req, res) => metricUnitsController.getFilterOptions(req, res))

router.post('/bulk/status', authenticate, canUpdate('metric-units'), (req, res) => metricUnitsController.bulkUpdateStatus(req, res))

router.post('/', authenticate, canInsert('metric-units'), (req, res) => metricUnitsController.create(req, res))

router.get('/:id', authenticate, canView('metric-units'), (req, res) => metricUnitsController.getById(req, res))

router.put('/:id', authenticate, canUpdate('metric-units'), (req, res) => metricUnitsController.update(req, res))

router.delete('/:id', authenticate, canDelete('metric-units'), (req, res) => metricUnitsController.delete(req, res))

export default router
