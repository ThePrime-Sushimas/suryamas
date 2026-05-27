import { stockRepository } from './stock.repository'
import { getCompanyIdForBranch, requireBranchAccess } from '../../utils/branch-access.util'
import { InsufficientStockError, DuplicateOpeningBalanceError, InvalidMovementError, WarehouseAccessDeniedError, InvalidReferenceError } from './stock.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { isPostgresError } from '../../utils/postgres-error.util'
import type {
  CreateMovementDto, CreateOpeningBalanceDto, AdjustStockDto,
  StockBalanceFilter, StockMovementFilter, MovementType, StockMovement,
  UpsertStockConfigDto
} from './stock.types'

export class StockService {
  // ─── BALANCES ───────────────────────────────────────────────────────────────

  async listBalances(branchIds: string[], pagination: { page: number; limit: number }, filter?: StockBalanceFilter, search?: string) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await stockRepository.findBalances(branchIds, { limit: pagination.limit, offset }, filter, search)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  // ─── MOVEMENTS ──────────────────────────────────────────────────────────────

  async listMovements(branchIds: string[], pagination: { page: number; limit: number }, filter?: StockMovementFilter) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await stockRepository.findMovements(branchIds, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  private async verifyWarehouseAccess(warehouseId: string, branchIds: string[]): Promise<void> {
    const exists = await stockRepository.warehouseBelongsToAccessibleBranches(warehouseId, branchIds)
    if (!exists) throw new WarehouseAccessDeniedError(warehouseId)
  }

  /**
   * Core function: create a stock movement and update balance atomically.
   * Used by all other modules (PO, Transfer, Daily Requisition, etc.)
   */
  async createMovement(dto: CreateMovementDto, userId: string, branchIds?: string[]): Promise<{ movement: StockMovement; newBalance: number }> {
    if (branchIds) await this.verifyWarehouseAccess(dto.warehouse_id, branchIds)

    try {
      const result = await stockRepository.withTransaction(async (client) => {
        const currentBalance = await stockRepository.getBalanceForUpdate(client, dto.warehouse_id, dto.product_id)

        const currentQty = currentBalance ? Number(currentBalance.qty) : 0
        const currentAvgCost = currentBalance ? Number(currentBalance.avg_cost) : 0

        const isInbound = dto.movement_type.startsWith('IN_')
        const effectiveCost = isInbound ? dto.cost_per_unit : currentAvgCost
        const movementQty = isInbound ? Math.abs(dto.qty) : -Math.abs(dto.qty)

        if (!isInbound && currentQty < Math.abs(dto.qty)) {
          throw new InsufficientStockError('Product', currentQty, Math.abs(dto.qty))
        }

        const newQty = currentQty + movementQty

        let newAvgCost = currentAvgCost
        if (isInbound && effectiveCost > 0) {
          const totalExistingValue = currentQty * currentAvgCost
          const incomingValue = Math.abs(dto.qty) * effectiveCost
          newAvgCost = newQty > 0 ? (totalExistingValue + incomingValue) / newQty : effectiveCost
        }

        const movement = await stockRepository.createMovement(
          client,
          { ...dto, qty: movementQty, cost_per_unit: effectiveCost, created_by: userId },
          newQty,
        )

        await stockRepository.upsertBalance(client, dto.warehouse_id, dto.product_id, newQty, newAvgCost)

        return { movement, newBalance: newQty }
      })

      await AuditService.log('CREATE', 'stock_movement', result.movement.id, userId, undefined, {
        warehouse_id: dto.warehouse_id,
        product_id: dto.product_id,
        movement_type: dto.movement_type,
        qty: result.movement.qty,
        balance_after: result.newBalance,
      })

      return result
    } catch (e) {
      if (isPostgresError(e, '23503')) throw new InvalidReferenceError('warehouse_id or product_id does not exist')
      throw e
    }
  }

  // ─── OPENING BALANCE ────────────────────────────────────────────────────────

  async createOpeningBalance(dto: CreateOpeningBalanceDto, userId: string, branchIds?: string[]) {
    if (branchIds) await this.verifyWarehouseAccess(dto.warehouse_id, branchIds)

    if (await stockRepository.hasOpeningBalanceMovement(dto.warehouse_id, dto.product_id)) {
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
    }, userId, branchIds)
  }

  async bulkOpeningBalance(
    warehouseId: string,
    items: { product_id: string; qty: number; cost_per_unit: number }[],
    notes: string | undefined,
    userId: string,
    branchIds?: string[],
  ) {
    if (branchIds) await this.verifyWarehouseAccess(warehouseId, branchIds)

    try {
      const results = await stockRepository.withTransaction(async (client) => {
        const details: { product_id: string; balance_after: number }[] = []

        for (const item of items) {
          await stockRepository.lockBalanceRow(client, warehouseId, item.product_id)

          if (await stockRepository.hasOpeningBalanceMovement(warehouseId, item.product_id, client)) {
            continue
          }

          const currentQty = await stockRepository.getBalanceQty(client, warehouseId, item.product_id)
          const newQty = currentQty + item.qty

          await stockRepository.createMovement(
            client,
            {
              warehouse_id: warehouseId,
              product_id: item.product_id,
              movement_type: 'IN_OPENING',
              qty: item.qty,
              cost_per_unit: item.cost_per_unit,
              reference_type: 'opening',
              notes: notes ?? 'Opening balance',
              created_by: userId,
            },
            newQty,
          )

          await stockRepository.upsertBalance(client, warehouseId, item.product_id, newQty, item.cost_per_unit)

          details.push({ product_id: item.product_id, balance_after: newQty })
        }

        return details
      })

      await AuditService.log('CREATE', 'stock_opening_balance_bulk', warehouseId, userId, undefined, {
        warehouse_id: warehouseId,
        count: results.length,
      })

      return {
        total: items.length,
        success: results.length,
        skipped: items.length - results.length,
        details: results,
      }
    } catch (e) {
      if (isPostgresError(e, '23503')) throw new InvalidReferenceError('One or more product_id does not exist')
      throw e
    }
  }

  // ─── ADJUSTMENT ─────────────────────────────────────────────────────────────

  async adjustStock(dto: AdjustStockDto, userId: string, branchIds?: string[]) {
    if (branchIds) await this.verifyWarehouseAccess(dto.warehouse_id, branchIds)

    const existing = await stockRepository.findBalanceByWarehouseProduct(dto.warehouse_id, dto.product_id)
    const currentQty = existing ? Number(existing.qty) : 0
    const currentAvgCost = existing ? Number(existing.avg_cost) : 0
    const diff = dto.new_qty - currentQty

    if (diff === 0) throw new InvalidMovementError('New qty is the same as current qty')

    const movementType: MovementType = diff > 0 ? 'IN_ADJUSTMENT' : 'OUT_ADJUSTMENT'
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
    }, userId, branchIds)
  }

  async getProductHistory(
    warehouseId: string,
    productId: string,
    pagination: { page: number; limit: number },
    branchIds?: string[],
  ) {
    if (branchIds) await this.verifyWarehouseAccess(warehouseId, branchIds)
    return this.getProductHistoryUnchecked(warehouseId, productId, pagination)
  }

  private async getProductHistoryUnchecked(
    warehouseId: string,
    productId: string,
    pagination: { page: number; limit: number },
  ) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await stockRepository.findMovementsByProduct(warehouseId, productId, { limit: pagination.limit, offset })
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  // ─── STOCK CONFIG ─────────────────────────────────────────────────────────────

  async getStockConfigGrid(companyIds: string[]) {
    return stockRepository.findStockConfigGrid(companyIds)
  }

  async upsertStockConfig(companyIds: string[], branchIds: string[], dto: UpsertStockConfigDto, userId: string) {
    requireBranchAccess(dto.branch_id, branchIds)
    const companyId = (await getCompanyIdForBranch(dto.branch_id)) ?? ''
    if (!companyIds.includes(companyId)) throw new WarehouseAccessDeniedError(dto.branch_id)
    return stockRepository.upsertStockConfig(companyId, dto, userId)
  }

  // ─── REORDER SUGGESTIONS ────────────────────────────────────────────────────

  async getReorderSuggestions(branchIds: string[]) {
    return stockRepository.findReorderSuggestions(branchIds)
  }
}

export const stockService = new StockService()
