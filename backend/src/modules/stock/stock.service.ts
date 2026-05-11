import { pool } from '../../config/db'
import { stockRepository } from './stock.repository'
import { InsufficientStockError, DuplicateOpeningBalanceError, InvalidMovementError, WarehouseAccessDeniedError, InvalidReferenceError } from './stock.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { isPostgresError } from '../../utils/postgres-error.util'
import type {
  CreateMovementDto, CreateOpeningBalanceDto, AdjustStockDto,
  StockBalanceWithRelations, StockMovementWithRelations,
  StockBalanceFilter, StockMovementFilter, MovementType, StockMovement
} from './stock.types'

export class StockService {
  // ─── BALANCES ───────────────────────────────────────────────────────────────

  async listBalances(companyId: string, pagination: { page: number; limit: number }, filter?: StockBalanceFilter, search?: string) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await stockRepository.findBalances(companyId, { limit: pagination.limit, offset }, filter, search)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async getProductHistory(warehouseId: string, productId: string, pagination: { page: number; limit: number }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await stockRepository.findMovementsByProduct(warehouseId, productId, { limit: pagination.limit, offset })
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  // ─── MOVEMENTS ──────────────────────────────────────────────────────────────

  async listMovements(companyId: string, pagination: { page: number; limit: number }, filter?: StockMovementFilter) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await stockRepository.findMovements(companyId, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  /**
   * Verify warehouse belongs to the given company. Throws if not.
   */
  private async verifyWarehouseOwnership(warehouseId: string, companyId: string): Promise<void> {
    const { rows } = await pool.query(
      'SELECT id FROM warehouses WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [warehouseId, companyId]
    )
    if (rows.length === 0) throw new WarehouseAccessDeniedError(warehouseId)
  }

  /**
   * Core function: create a stock movement and update balance atomically.
   * Used by all other modules (PO, Transfer, Daily Requisition, etc.)
   */
  async createMovement(dto: CreateMovementDto, userId: string, companyId?: string): Promise<{ movement: StockMovement; newBalance: number }> {
    // Cross-tenant guard
    if (companyId) await this.verifyWarehouseOwnership(dto.warehouse_id, companyId)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Lock balance row for update
      const { rows: lockRows } = await client.query(
        'SELECT * FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
        [dto.warehouse_id, dto.product_id]
      )

      const currentBalance = lockRows[0]
      const currentQty = currentBalance ? Number(currentBalance.qty) : 0
      const currentAvgCost = currentBalance ? Number(currentBalance.avg_cost) : 0

      const isInbound = dto.movement_type.startsWith('IN_')

      // For outbound: force cost_per_unit to current avg_cost (ignore user input)
      const effectiveCost = isInbound ? dto.cost_per_unit : currentAvgCost
      const movementQty = isInbound ? Math.abs(dto.qty) : -Math.abs(dto.qty)

      // Check sufficient stock for outbound
      if (!isInbound && currentQty < Math.abs(dto.qty)) {
        await client.query('ROLLBACK')
        throw new InsufficientStockError('Product', currentQty, Math.abs(dto.qty))
      }

      const newQty = currentQty + movementQty

      // Weighted average cost calculation (only for inbound)
      let newAvgCost = currentAvgCost
      if (isInbound && effectiveCost > 0) {
        const totalExistingValue = currentQty * currentAvgCost
        const incomingValue = Math.abs(dto.qty) * effectiveCost
        newAvgCost = newQty > 0 ? (totalExistingValue + incomingValue) / newQty : effectiveCost
      }

      // Create movement record
      const movement = await stockRepository.createMovement(client, { ...dto, qty: movementQty, cost_per_unit: effectiveCost, created_by: userId }, newQty)

      // Update balance
      await stockRepository.upsertBalance(client, dto.warehouse_id, dto.product_id, newQty, newAvgCost)

      await client.query('COMMIT')

      await AuditService.log('CREATE', 'stock_movement', movement.id, userId, undefined, {
        warehouse_id: dto.warehouse_id, product_id: dto.product_id,
        movement_type: dto.movement_type, qty: movementQty, balance_after: newQty,
      })

      return { movement, newBalance: newQty }
    } catch (e) {
      if (isPostgresError(e, '23503')) throw new InvalidReferenceError('warehouse_id or product_id does not exist')
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  // ─── OPENING BALANCE ────────────────────────────────────────────────────────

  async createOpeningBalance(dto: CreateOpeningBalanceDto, userId: string, companyId?: string) {
    // Cross-tenant guard
    if (companyId) await this.verifyWarehouseOwnership(dto.warehouse_id, companyId)

    // Check if opening balance movement already exists for this warehouse+product
    const { rows } = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM stock_movements
        WHERE warehouse_id = $1 AND product_id = $2 AND movement_type = 'IN_OPENING'
      ) AS has_opening`,
      [dto.warehouse_id, dto.product_id]
    )
    if (rows[0].has_opening) {
      throw new DuplicateOpeningBalanceError('Product', 'Warehouse')
    }

    return this.createMovement({
      warehouse_id: dto.warehouse_id,
      product_id: dto.product_id,
      movement_type: 'IN_OPENING',
      qty: dto.qty,
      cost_per_unit: dto.cost_per_unit,
      reference_type: 'opening',
      notes: dto.notes ?? 'Opening balance',
      created_by: userId,
    }, userId, companyId)
  }

  async bulkOpeningBalance(warehouseId: string, items: { product_id: string; qty: number; cost_per_unit: number }[], notes: string | undefined, userId: string, companyId?: string) {
    // Cross-tenant guard
    if (companyId) await this.verifyWarehouseOwnership(warehouseId, companyId)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const results: { product_id: string; balance_after: number }[] = []

      for (const item of items) {
        // Lock balance row FIRST to prevent race condition
        await client.query(
          'SELECT 1 FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
          [warehouseId, item.product_id]
        )

        // Then check duplicate opening
        const { rows: checkRows } = await client.query(
          `SELECT EXISTS(
            SELECT 1 FROM stock_movements
            WHERE warehouse_id = $1 AND product_id = $2 AND movement_type = 'IN_OPENING'
          ) AS has_opening`,
          [warehouseId, item.product_id]
        )
        if (checkRows[0].has_opening) continue // skip already opened

        // Get current balance
        const { rows: balRows } = await client.query(
          'SELECT qty FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2',
          [warehouseId, item.product_id]
        )
        const currentQty = balRows[0] ? Number(balRows[0].qty) : 0
        const newQty = currentQty + item.qty

        // Create movement
        await stockRepository.createMovement(client, {
          warehouse_id: warehouseId,
          product_id: item.product_id,
          movement_type: 'IN_OPENING',
          qty: item.qty,
          cost_per_unit: item.cost_per_unit,
          reference_type: 'opening',
          notes: notes ?? 'Opening balance',
          created_by: userId,
        }, newQty)

        // Upsert balance
        await stockRepository.upsertBalance(client, warehouseId, item.product_id, newQty, item.cost_per_unit)

        results.push({ product_id: item.product_id, balance_after: newQty })
      }

      await client.query('COMMIT')

      await AuditService.log('CREATE', 'stock_opening_balance_bulk', warehouseId, userId, undefined, {
        warehouse_id: warehouseId, count: results.length,
      })

      return { total: items.length, success: results.length, skipped: items.length - results.length, details: results }
    } catch (e) {
      if (isPostgresError(e, '23503')) throw new InvalidReferenceError('One or more product_id does not exist')
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  // ─── ADJUSTMENT ─────────────────────────────────────────────────────────────

  async adjustStock(dto: AdjustStockDto, userId: string, companyId?: string) {
    // Cross-tenant guard
    if (companyId) await this.verifyWarehouseOwnership(dto.warehouse_id, companyId)

    const existing = await stockRepository.findBalanceByWarehouseProduct(dto.warehouse_id, dto.product_id)
    const currentQty = existing ? Number(existing.qty) : 0
    const currentAvgCost = existing ? Number(existing.avg_cost) : 0
    const diff = dto.new_qty - currentQty

    if (diff === 0) throw new InvalidMovementError('New qty is the same as current qty')

    const movementType: MovementType = diff > 0 ? 'IN_ADJUSTMENT' : 'OUT_ADJUSTMENT'
    // For IN_ADJUSTMENT: use user-provided cost if available, fallback to avg_cost
    // For OUT_ADJUSTMENT: always use current avg_cost (enforced in createMovement)
    const costPerUnit = diff > 0 ? (dto.cost_per_unit ?? currentAvgCost) : currentAvgCost

    return this.createMovement({
      warehouse_id: dto.warehouse_id,
      product_id: dto.product_id,
      movement_type: movementType,
      qty: Math.abs(diff),
      cost_per_unit: costPerUnit,
      reference_type: 'adjustment',
      notes: dto.reason,
      created_by: userId,
    }, userId, companyId)
  }
}

export const stockService = new StockService()
