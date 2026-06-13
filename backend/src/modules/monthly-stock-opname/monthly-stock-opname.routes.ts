import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { monthlyStockOpnameController } from './monthly-stock-opname.controller'
import {
  listSchema, getByIdSchema, createSchema, updateLineSchema,
  bulkUpdateLinesSchema, createReopenRequestSchema, respondReopenRequestSchema,
  getReopenRequestsSchema, listReopenRequestsSchema,
} from './monthly-stock-opname.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('monthly_stock_opname', 'Monthly Stock Opname').catch((err) => {
  console.error('Failed to register monthly_stock_opname module:', err instanceof Error ? err.message : err)
})

const router = Router()
router.use(authenticate, resolveBranchContext)

// ─── REOPEN REQUEST (approve/reject uses /reopen-requests/:requestId prefix) ──

router.post('/reopen-requests/:requestId/approve', canUpdate('monthly_stock_opname'), validateSchema(respondReopenRequestSchema), (req, res) => monthlyStockOpnameController.approveReopenRequest(req, res))
router.post('/reopen-requests/:requestId/reject', canUpdate('monthly_stock_opname'), validateSchema(respondReopenRequestSchema), (req, res) => monthlyStockOpnameController.rejectReopenRequest(req, res))

// ─── LIST / CREATE ────────────────────────────────────────────────────────────

router.get('/', canView('monthly_stock_opname'), validateSchema(listSchema), (req, res) => monthlyStockOpnameController.list(req, res))
router.post('/', canInsert('monthly_stock_opname'), validateSchema(createSchema), (req, res) => monthlyStockOpnameController.create(req, res))
router.get('/reopen-requests', canView('monthly_stock_opname'), validateSchema(listReopenRequestsSchema), (req, res) => monthlyStockOpnameController.listReopenRequests(req, res))

// ─── DETAIL ───────────────────────────────────────────────────────────────────

router.get('/:id', canView('monthly_stock_opname'), validateSchema(getByIdSchema), (req, res) => monthlyStockOpnameController.getById(req, res))

// ─── LINE UPDATES ─────────────────────────────────────────────────────────────

router.post('/:id/lines/bulk', canUpdate('monthly_stock_opname'), validateSchema(bulkUpdateLinesSchema), (req, res) => monthlyStockOpnameController.bulkUpdateLines(req, res))
router.patch('/:id/lines/:lineId', canUpdate('monthly_stock_opname'), validateSchema(updateLineSchema), (req, res) => monthlyStockOpnameController.updateLine(req, res))

// ─── ACTIONS ──────────────────────────────────────────────────────────────────

router.post('/:id/recalculate', canUpdate('monthly_stock_opname'), validateSchema(getByIdSchema), (req, res) => monthlyStockOpnameController.recalculate(req, res))
router.post('/:id/confirm', canUpdate('monthly_stock_opname'), validateSchema(getByIdSchema), (req, res) => monthlyStockOpnameController.confirm(req, res))
router.delete('/:id', canDelete('monthly_stock_opname'), validateSchema(getByIdSchema), (req, res) => monthlyStockOpnameController.cancel(req, res))

// ─── THERMAL ──────────────────────────────────────────────────────────────────

router.get('/:id/thermal', canView('monthly_stock_opname'), validateSchema(getByIdSchema), (req, res) => monthlyStockOpnameController.getThermalPrintData(req, res))

// ─── REOPEN REQUEST (session-scoped) ──────────────────────────────────────────

router.post('/:id/reopen-requests', canUpdate('monthly_stock_opname'), validateSchema(createReopenRequestSchema), (req, res) => monthlyStockOpnameController.createReopenRequest(req, res))
router.get('/:id/reopen-requests', canView('monthly_stock_opname'), validateSchema(getReopenRequestsSchema), (req, res) => monthlyStockOpnameController.getReopenRequests(req, res))

export default router
