import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { stockController } from './stock.controller'
import {
  createMovementSchema, createOpeningBalanceSchema, bulkOpeningBalanceSchema, adjustStockSchema,
  stockBalanceListSchema, stockMovementListSchema
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

export default router
