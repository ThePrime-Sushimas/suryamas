import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { dailyPrepOrdersController } from './daily-prep-orders.controller'
import {
  dpoIdSchema, dpoLineIdSchema, dpoListSchema, generateDpoSchema,
  updateDpoLinesSchema, confirmDpoSchema, cancelDpoSchema,
  branchIdParamSchema, upsertForecastConfigSchema, upsertHolidaySchema, holidayIdSchema,
  createManualDpoSchema,
} from './daily-prep-orders.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('daily_prep_orders', 'Daily Prep Orders').catch((err) => {
  console.error('Failed to register daily_prep_orders module:', err instanceof Error ? err.message : err)
})

const router = Router()
router.use(authenticate, resolveBranchContext)

// ─── STATIC ROUTES (harus di atas /:id agar tidak tertangkap dynamic segment) ─

// Generate
router.post('/generate', canInsert('daily_prep_orders'), validateSchema(generateDpoSchema), (req, res) => dailyPrepOrdersController.generate(req, res))

// Forecast config
router.get('/config/:branchId', canView('daily_prep_orders'), validateSchema(branchIdParamSchema), (req, res) => dailyPrepOrdersController.getForecastConfig(req, res))
router.put('/config', canUpdate('daily_prep_orders'), validateSchema(upsertForecastConfigSchema), (req, res) => dailyPrepOrdersController.upsertForecastConfig(req, res))

// Holidays
router.get('/holidays', canView('daily_prep_orders'), (req, res) => dailyPrepOrdersController.getHolidays(req, res))
router.put('/holidays', canInsert('daily_prep_orders'), validateSchema(upsertHolidaySchema), (req, res) => dailyPrepOrdersController.upsertHoliday(req, res))
router.delete('/holidays/:holidayId', canDelete('daily_prep_orders'), validateSchema(holidayIdSchema), (req, res) => dailyPrepOrdersController.deleteHoliday(req, res))

// Manual DPO creation
router.post('/manual', canInsert('daily_prep_orders'), validateSchema(createManualDpoSchema), (req, res) => dailyPrepOrdersController.createManual(req, res))

// ─── DPO LIST / DETAIL (dynamic /:id terakhir) ───────────────────────────────
router.get('/', canView('daily_prep_orders'), validateSchema(dpoListSchema), (req, res) => dailyPrepOrdersController.list(req, res))
router.get('/:id', canView('daily_prep_orders'), validateSchema(dpoIdSchema), (req, res) => dailyPrepOrdersController.getById(req, res))

// ─── LINES ────────────────────────────────────────────────────────────────────
router.put('/:id/lines', canUpdate('daily_prep_orders'), validateSchema(updateDpoLinesSchema), (req, res) => dailyPrepOrdersController.updateLines(req, res))
router.delete('/:id/lines/:lineId', canUpdate('daily_prep_orders'), validateSchema(dpoLineIdSchema), (req, res) => dailyPrepOrdersController.deleteLine(req, res))

// ─── LOCK / CONFIRM / CANCEL ──────────────────────────────────────────────────
router.post('/:id/acquire-lock', canUpdate('daily_prep_orders'), validateSchema(dpoIdSchema), (req, res) => dailyPrepOrdersController.acquireLock(req, res))
router.post('/:id/confirm', canUpdate('daily_prep_orders'), validateSchema(confirmDpoSchema), (req, res) => dailyPrepOrdersController.confirm(req, res))
router.post('/:id/cancel', canUpdate('daily_prep_orders'), validateSchema(cancelDpoSchema), (req, res) => dailyPrepOrdersController.cancel(req, res))
router.delete('/:id', canDelete('daily_prep_orders'), validateSchema(dpoIdSchema), (req, res) => dailyPrepOrdersController.softDelete(req, res))

export default router
