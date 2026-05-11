import type { Request, Response } from 'express'
import { stockService } from './stock.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type {
  createMovementSchema, createOpeningBalanceSchema, bulkOpeningBalanceSchema,
  adjustStockSchema
} from './stock.schema'

type CreateMovementReq = ValidatedAuthRequest<typeof createMovementSchema>
type OpeningBalanceReq = ValidatedAuthRequest<typeof createOpeningBalanceSchema>
type BulkOpeningReq = ValidatedAuthRequest<typeof bulkOpeningBalanceSchema>
type AdjustReq = ValidatedAuthRequest<typeof adjustStockSchema>

export class StockController {
  // ─── BALANCES ───────────────────────────────────────────────────────────────

  listBalances = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const search = req.query.search as string | undefined

      const filter: Record<string, unknown> = {}
      if (req.query.warehouse_id) filter.warehouse_id = req.query.warehouse_id as string
      if (req.query.branch_id) filter.branch_id = req.query.branch_id as string
      if (req.query.warehouse_type) filter.warehouse_type = req.query.warehouse_type as string
      if (req.query.product_id) filter.product_id = req.query.product_id as string
      if (req.query.has_stock === 'true') filter.has_stock = true

      const result = await stockService.listBalances(companyId, { page, limit }, filter, search)
      sendSuccess(res, result.data, 'Stock balances retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_stock_balances' })
    }
  }

  getProductHistory = async (req: Request, res: Response) => {
    try {
      const warehouseId = req.params.warehouseId as string
      const productId = req.params.productId as string
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50

      const result = await stockService.getProductHistory(warehouseId, productId, { page, limit })
      sendSuccess(res, result.data, 'Product movement history retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_product_history', id: `${req.params.warehouseId}/${req.params.productId}` })
    }
  }

  // ─── MOVEMENTS ──────────────────────────────────────────────────────────────

  listMovements = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50

      const filter: Record<string, unknown> = {}
      if (req.query.warehouse_id) filter.warehouse_id = req.query.warehouse_id as string
      if (req.query.product_id) filter.product_id = req.query.product_id as string
      if (req.query.movement_type) filter.movement_type = req.query.movement_type as string
      if (req.query.date_from) filter.date_from = req.query.date_from as string
      if (req.query.date_to) filter.date_to = req.query.date_to as string

      const result = await stockService.listMovements(companyId, { page, limit }, filter)
      sendSuccess(res, result.data, 'Stock movements retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_stock_movements' })
    }
  }

  createMovement = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateMovementReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const result = await stockService.createMovement(body, userId, companyId)
      sendSuccess(res, result, 'Stock movement created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_stock_movement' })
    }
  }

  // ─── OPENING BALANCE ────────────────────────────────────────────────────────

  createOpeningBalance = async (req: Request, res: Response) => {
    try {
      const { body } = (req as OpeningBalanceReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const result = await stockService.createOpeningBalance(body, userId, companyId)
      sendSuccess(res, result, 'Opening balance created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_opening_balance' })
    }
  }

  bulkOpeningBalance = async (req: Request, res: Response) => {
    try {
      const { body } = (req as BulkOpeningReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const result = await stockService.bulkOpeningBalance(body.warehouse_id, body.items, body.notes, userId, companyId)
      sendSuccess(res, result, `Opening balance: ${result.success} success, ${result.skipped} skipped`, 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_opening_balance' })
    }
  }

  // ─── ADJUSTMENT ─────────────────────────────────────────────────────────────

  adjustStock = async (req: Request, res: Response) => {
    try {
      const { body } = (req as AdjustReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const result = await stockService.adjustStock(body, userId, companyId)
      sendSuccess(res, result, 'Stock adjusted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'adjust_stock' })
    }
  }
}

export const stockController = new StockController()
