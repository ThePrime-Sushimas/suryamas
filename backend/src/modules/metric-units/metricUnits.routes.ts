import { Router } from 'express'
import { metricUnitsController } from './metricUnits.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import { CreateMetricUnitSchema, UpdateMetricUnitSchema, metricUnitIdSchema, BulkUpdateStatusSchema } from './metricUnits.schema'

PermissionService.registerModule('metric_units', 'Metric Units Management').catch((err) => {
  console.error('Failed to register metric_units module:', err instanceof Error ? err.message : err)
})

const sortFields = ['unit_code', 'unit_name', 'sort_order', 'created_at', 'updated_at', 'id']

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/active', canView('metric_units'), queryMiddleware({ allowedSortFields: sortFields }), (req, res) => metricUnitsController.listActive(req, res))
router.get('/filter-options', canView('metric_units'), (req, res) => metricUnitsController.getFilterOptions(req, res))
router.get('/', canView('metric_units'), queryMiddleware({ allowedSortFields: sortFields }), (req, res) => metricUnitsController.list(req, res))
router.post('/bulk/status', canUpdate('metric_units'), validateSchema(BulkUpdateStatusSchema), (req, res) => metricUnitsController.bulkUpdateStatus(req, res))
router.post('/', canInsert('metric_units'), validateSchema(CreateMetricUnitSchema), (req, res) => metricUnitsController.create(req, res))
router.get('/:id', canView('metric_units'), validateSchema(metricUnitIdSchema), (req, res) => metricUnitsController.getById(req, res))
router.put('/:id', canUpdate('metric_units'), validateSchema(UpdateMetricUnitSchema), (req, res) => metricUnitsController.update(req, res))
router.delete('/:id', canDelete('metric_units'), validateSchema(metricUnitIdSchema), (req, res) => metricUnitsController.delete(req, res))
router.post('/:id/restore', canUpdate('metric_units'), validateSchema(metricUnitIdSchema), (req, res) => metricUnitsController.restore(req, res))

export default router
