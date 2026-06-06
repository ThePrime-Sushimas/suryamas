import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { stockController } from './stock.controller'
import {
  createMovementSchema, createOpeningBalanceSchema, bulkOpeningBalanceSchema, adjustStockSchema,
  stockBalanceListSchema, stockMovementListSchema, upsertStockConfigSchema, stockAnalysisSchema
} from './stock.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('stock', 'Stock / Inventory Management').catch((err) => {
  console.error('Failed to register stock module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

// ─── BALANCES ───────────────────────────────────────────────────────────────
router.get('/balances', canView('stock'), validateSchema(stockBalanceListSchema), (req, res) => stockController.listBalances(req, res))
router.get('/balances/:warehouseId/:productId/history', canView('stock'), (req, res) => stockController.getProductHistory(req, res))

// ─── MOVEMENTS ──────────────────────────────────────────────────────────────
router.get('/movements', canView('stock'), validateSchema(stockMovementListSchema), (req, res) => stockController.listMovements(req, res))
router.post('/movements', canInsert('stock'), validateSchema(createMovementSchema), (req, res) => stockController.createMovement(req, res))

// ─── OPENING BALANCE ────────────────────────────────────────────────────────
router.post('/opening-balance', canInsert('stock'), validateSchema(createOpeningBalanceSchema), (req, res) => stockController.createOpeningBalance(req, res))
router.post('/opening-balance/bulk', canInsert('stock'), validateSchema(bulkOpeningBalanceSchema), (req, res) => stockController.bulkOpeningBalance(req, res))

// ─── ADJUSTMENT ─────────────────────────────────────────────────────────────
router.post('/adjust', canUpdate('stock'), validateSchema(adjustStockSchema), (req, res) => stockController.adjustStock(req, res))

// ─── STOCK CONFIG ──────────────────────────────────────────────────────────────
router.get('/configs/grid', canView('stock'), (req, res) => stockController.getStockConfigGrid(req, res))
router.put('/configs', canUpdate('stock'), validateSchema(upsertStockConfigSchema), (req, res) => stockController.upsertStockConfig(req, res))

// ─── REORDER SUGGESTIONS ────────────────────────────────────────────────────
router.get('/reorder-suggestions', canView('stock'), (req, res) => stockController.getReorderSuggestions(req, res))

// ─── STOCK ANALYSIS CENTER ────────────────────────────────────────────────────
router.get('/analysis', canView('stock'), validateSchema(stockAnalysisSchema), (req, res) => stockController.getAnalysis(req, res))

export default router
