import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { dailyStockOpnameController } from './daily-stock-opname.controller'
import {
  listSchema, getByIdSchema, createOpnameSchema, updateLineSchema,
  bulkUpdateLinesSchema, photoUploadSchema, confirmSchema, resolveSchema,
  cancelSchema, configSchema, dashboardSchema, varianceReportSchema,
  analysisParamsSchema, classifyBodySchema, getClassificationsSchema,
  createReopenRequestSchema, respondReopenRequestSchema, getReopenRequestsSchema,
} from './daily-stock-opname.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('daily_stock_opname', 'Daily Stock Opname').catch((err) => {
  console.error('Failed to register daily_stock_opname module:', err instanceof Error ? err.message : err)
})

// Multer config for photo upload (max 10MB, JPEG/PNG only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png']
    cb(null, allowed.includes(file.mimetype))
  },
})

const router = Router()
router.use(authenticate, resolveBranchContext)

// ─── STATIC ROUTES (before /:id to avoid param conflicts) ─────────────────────

// Available positions for opname (user's positions that have WIP assignments)
router.get('/positions', canView('daily_stock_opname'), (req, res) => dailyStockOpnameController.getAvailablePositions(req, res))

// Dashboard
router.get('/dashboard', canView('daily_stock_opname'), validateSchema(dashboardSchema), (req, res) => dailyStockOpnameController.getDashboard(req, res))

// Variance report
router.get('/variance-report', canView('daily_stock_opname'), validateSchema(varianceReportSchema), (req, res) => dailyStockOpnameController.getVarianceReport(req, res))
router.get('/variance-report/export', canView('daily_stock_opname'), validateSchema(varianceReportSchema), (req, res) => dailyStockOpnameController.exportVarianceReportCsv(req, res))

// Config
router.get('/config/:branchId', canView('daily_stock_opname'), validateSchema(configSchema), (req, res) => dailyStockOpnameController.getConfig(req, res))
router.put('/config/:branchId', canUpdate('daily_stock_opname'), validateSchema(configSchema), (req, res) => dailyStockOpnameController.updateConfig(req, res))

// ─── REOPEN REQUEST (approve/reject uses /reopen-requests/:id prefix) ─────────

router.post('/reopen-requests/:id/approve', canUpdate('daily_stock_opname'), validateSchema(respondReopenRequestSchema), (req, res) => dailyStockOpnameController.approveReopenRequest(req, res))
router.post('/reopen-requests/:id/reject', canUpdate('daily_stock_opname'), validateSchema(respondReopenRequestSchema), (req, res) => dailyStockOpnameController.rejectReopenRequest(req, res))

// ─── LIST / CREATE ────────────────────────────────────────────────────────────

router.get('/', canView('daily_stock_opname'), validateSchema(listSchema), (req, res) => dailyStockOpnameController.list(req, res))
router.post('/', canInsert('daily_stock_opname'), validateSchema(createOpnameSchema), (req, res) => dailyStockOpnameController.create(req, res))

// ─── DETAIL (dynamic /:id) ────────────────────────────────────────────────────

router.get('/:id', canView('daily_stock_opname'), validateSchema(getByIdSchema), (req, res) => dailyStockOpnameController.getById(req, res))

// ─── ANALYSIS ─────────────────────────────────────────────────────────────────

router.get('/:id/analysis', canView('daily_stock_opname'), validateSchema(analysisParamsSchema), (req, res) => dailyStockOpnameController.getAnalysis(req, res))

// ─── CLASSIFICATION ───────────────────────────────────────────────────────────

router.post('/:id/classify', canUpdate('daily_stock_opname'), validateSchema(classifyBodySchema), (req, res) => dailyStockOpnameController.classify(req, res))
router.get('/:id/classifications', canView('daily_stock_opname'), validateSchema(getClassificationsSchema), (req, res) => dailyStockOpnameController.getClassifications(req, res))

// ─── LINE UPDATES ─────────────────────────────────────────────────────────────

router.patch('/:id/lines/bulk', canUpdate('daily_stock_opname'), validateSchema(bulkUpdateLinesSchema), (req, res) => dailyStockOpnameController.bulkUpdateLines(req, res))
router.patch('/:id/lines/:lineId', canUpdate('daily_stock_opname'), validateSchema(updateLineSchema), (req, res) => dailyStockOpnameController.updateLine(req, res))
router.post('/:id/lines/:lineId/photo', canUpdate('daily_stock_opname'), validateSchema(photoUploadSchema), upload.single('photo'), (req, res) => dailyStockOpnameController.uploadPhoto(req, res))
router.delete('/:id/lines/:lineId/photo', canUpdate('daily_stock_opname'), validateSchema(photoUploadSchema), (req, res) => dailyStockOpnameController.deletePhoto(req, res))

// ─── ACTIONS ──────────────────────────────────────────────────────────────────

router.post('/:id/confirm', canUpdate('daily_stock_opname'), validateSchema(confirmSchema), (req, res) => dailyStockOpnameController.confirm(req, res))
router.post('/:id/resolve', canUpdate('daily_stock_opname'), validateSchema(resolveSchema), (req, res) => dailyStockOpnameController.resolve(req, res))
router.post('/:id/request-backdate', canUpdate('daily_stock_opname'), validateSchema(getByIdSchema), (req, res) => dailyStockOpnameController.requestBackdate(req, res))
router.delete('/:id', canUpdate('daily_stock_opname'), validateSchema(cancelSchema), (req, res) => dailyStockOpnameController.cancel(req, res))

// ─── REOPEN REQUEST (session-scoped routes) ───────────────────────────────────

router.post('/:id/reopen-request', canUpdate('daily_stock_opname'), validateSchema(createReopenRequestSchema), (req, res) => dailyStockOpnameController.createReopenRequest(req, res))
router.get('/:id/reopen-requests', canView('daily_stock_opname'), validateSchema(getReopenRequestsSchema), (req, res) => dailyStockOpnameController.getReopenRequests(req, res))

export default router
