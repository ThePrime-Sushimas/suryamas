import type { Request, Response } from 'express'
import { stockService } from './stock.service'
import { stockAnalysisService } from './stock-analysis.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { getAccessibleBranchIds, getAccessibleCompanyIds } from '../../utils/branch-access.util'
import {
  createMovementSchema, createOpeningBalanceSchema, bulkOpeningBalanceSchema,
  adjustStockSchema, stockAnalysisSchema
} from './stock.schema'

type CreateMovementReq = ValidatedAuthRequest<typeof createMovementSchema>
type OpeningBalanceReq = ValidatedAuthRequest<typeof createOpeningBalanceSchema>
type BulkOpeningReq = ValidatedAuthRequest<typeof bulkOpeningBalanceSchema>
type AdjustReq = ValidatedAuthRequest<typeof adjustStockSchema>
type AnalysisReq = ValidatedAuthRequest<typeof stockAnalysisSchema>

async function stockScope(req: Request) {
  const userId = req.user?.id ?? ''
  const [branchIds, companyIds] = await Promise.all([
    getAccessibleBranchIds(userId),
    getAccessibleCompanyIds(userId),
  ])
  return { userId, branchIds, companyIds }
}

function resolveBranchFilter(accessible: string[], branchId?: string): string[] {
  if (!branchId) return accessible
  if (!accessible.includes(branchId)) {
    throw Object.assign(new Error('No access to this branch'), { statusCode: 403 })
  }
  return [branchId]
}

export class StockController {
  // ─── BALANCES ───────────────────────────────────────────────────────────────

  listBalances = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await stockScope(req)
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50
      const search = req.query.search as string | undefined

      let scopeBranchIds: string[]
      try {
        scopeBranchIds = resolveBranchFilter(branchIds, req.query.branch_id as string | undefined)
      } catch {
        res.status(403).json({ success: false, message: 'No access to this branch' })
        return
      }

      const filter: Record<string, unknown> = {}
      if (req.query.warehouse_id) filter.warehouse_id = req.query.warehouse_id as string
      if (req.query.branch_id) filter.branch_id = req.query.branch_id as string
      if (req.query.warehouse_type) filter.warehouse_type = req.query.warehouse_type as string
      if (req.query.product_id) filter.product_id = req.query.product_id as string
      if (req.query.has_stock === 'true') filter.has_stock = true

      const result = await stockService.listBalances(scopeBranchIds, { page, limit }, filter, search)
      sendSuccess(res, result.data, 'Stock balances retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_stock_balances' })
    }
  }

  getProductHistory = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await stockScope(req)
      const warehouseId = req.params.warehouseId as string
      const productId = req.params.productId as string
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50

      const result = await stockService.getProductHistory(warehouseId, productId, { page, limit }, branchIds)
      sendSuccess(res, result.data, 'Product movement history retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_product_history', id: `${req.params.warehouseId}/${req.params.productId}` })
    }
  }

  // ─── MOVEMENTS ──────────────────────────────────────────────────────────────

  listMovements = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await stockScope(req)
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50

      let scopeBranchIds: string[]
      try {
        scopeBranchIds = resolveBranchFilter(branchIds, req.query.branch_id as string | undefined)
      } catch {
        res.status(403).json({ success: false, message: 'No access to this branch' })
        return
      }

      const filter: Record<string, unknown> = {}
      if (req.query.warehouse_id) filter.warehouse_id = req.query.warehouse_id as string
      if (req.query.product_id) filter.product_id = req.query.product_id as string
      if (req.query.movement_type) filter.movement_type = req.query.movement_type as string
      if (req.query.date_from) filter.date_from = req.query.date_from as string
      if (req.query.date_to) filter.date_to = req.query.date_to as string

      const result = await stockService.listMovements(scopeBranchIds, { page, limit }, filter)
      sendSuccess(res, result.data, 'Stock movements retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_stock_movements' })
    }
  }

  createMovement = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateMovementReq).validated
      const { branchIds, userId } = await stockScope(req)
      const result = await stockService.createMovement(body, userId, branchIds)
      sendSuccess(res, result, 'Stock movement created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_stock_movement' })
    }
  }

  // ─── OPENING BALANCE ────────────────────────────────────────────────────────

  createOpeningBalance = async (req: Request, res: Response) => {
    try {
      const { body } = (req as OpeningBalanceReq).validated
      const { branchIds, userId } = await stockScope(req)
      const result = await stockService.createOpeningBalance(body, userId, branchIds)
      sendSuccess(res, result, 'Opening balance created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_opening_balance' })
    }
  }

  bulkOpeningBalance = async (req: Request, res: Response) => {
    try {
      const { body } = (req as BulkOpeningReq).validated
      const { branchIds, userId } = await stockScope(req)
      const result = await stockService.bulkOpeningBalance(body.warehouse_id, body.items, body.notes, userId, branchIds)
      sendSuccess(res, result, `Opening balance: ${result.success} success, ${result.skipped} skipped`, 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_opening_balance' })
    }
  }

  // ─── ADJUSTMENT ─────────────────────────────────────────────────────────────

  adjustStock = async (req: Request, res: Response) => {
    try {
      const { body } = (req as AdjustReq).validated
      const { branchIds, userId } = await stockScope(req)
      const result = await stockService.adjustStock(body, userId, branchIds)
      sendSuccess(res, result, 'Stock adjusted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'adjust_stock' })
    }
  }

  // ─── STOCK CONFIG ─────────────────────────────────────────────────────────────

  getStockConfigGrid = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await stockScope(req)
      const result = await stockService.getStockConfigGrid(companyIds)
      sendSuccess(res, result, 'Stock config grid retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_stock_config_grid' })
    }
  }

  upsertStockConfig = async (req: Request, res: Response) => {
    try {
      const { companyIds, branchIds, userId } = await stockScope(req)
      const result = await stockService.upsertStockConfig(companyIds, branchIds, req.body, userId)
      sendSuccess(res, result, 'Stock config saved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upsert_stock_config' })
    }
  }

  // ─── REORDER SUGGESTIONS ────────────────────────────────────────────────────

  getReorderSuggestions = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await stockScope(req)
      const queryBranchIds = req.query.branch_ids
        ? (req.query.branch_ids as string).split(',').filter(Boolean)
        : req.query.branch_id
          ? [req.query.branch_id as string]
          : undefined

      let scopeBranchIds = branchIds
      if (queryBranchIds?.length) {
        scopeBranchIds = queryBranchIds.filter((id) => branchIds.includes(id))
        if (scopeBranchIds.length === 0) {
          res.status(403).json({ success: false, message: 'No access to selected branches' })
          return
        }
      }

      const result = await stockService.getReorderSuggestions(scopeBranchIds)
      sendSuccess(res, result, 'Reorder suggestions retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_reorder_suggestions' })
    }
  }

  // ─── STOCK ANALYSIS CENTER ────────────────────────────────────────────────────

  getAnalysis = async (req: Request, res: Response) => {
    try {
      const { query } = (req as AnalysisReq).validated
      const { branchIds } = await stockScope(req)

      const result = await stockAnalysisService.getAnalysis(branchIds, {
        branch_id: query.branch_id,
        date_from: query.date_from,
        date_to: query.date_to,
        warehouse_type: query.warehouse_type,
        product_id: query.product_id,
        category_id: query.category_id,
        only_with_variance: query.only_with_variance,
        page: query.page,
        limit: query.limit,
      })

      sendSuccess(res, { rows: result.data, summary: result.summary, warehouse_name: result.warehouse_name }, 'Stock analysis retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_stock_analysis' })
    }
  }
}

export const stockController = new StockController()
