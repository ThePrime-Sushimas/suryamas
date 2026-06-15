import { monthlyStockOpnameRepository } from './monthly-stock-opname.repository'
import { stockRepository } from '../stock/stock.repository'
import { AuditService } from '../monitoring/monitoring.service'
import { requireBranchAccess, getCompanyIdForBranch } from '../../utils/branch-access.util'
import { BusinessRuleError } from '../../utils/errors.base'
import {
  MonthlyOpnameNotFoundError,
  MonthlyOpnameDuplicateError,
  MonthlyOpnameNotEditableError,
  MonthlyOpnameIncompleteError,
  MonthlyOpnameInvestigasiRequiredError,
  MonthlyOpnameCannotCancelError,
} from './monthly-stock-opname.errors'
import type {
  MonthlyStockOpnameDetail,
  MonthlyStockOpnameWithRelations,
  MonthlyStockOpnameLine,
  CreateMonthlyOpnameDto,
  UpdateLineDto,
  BulkUpdateLinesDto,
  MonthlyOpnameListFilter,
  MonthlyOpnameThermalData,
} from './monthly-stock-opname.types'

// ─── SERVICE CLASS ────────────────────────────────────────────────────────────

export class MonthlyStockOpnameService {

  // ─── SESSION CREATION ───────────────────────────────────────────────────────

  async createSession(
    dto: CreateMonthlyOpnameDto,
    branchIds: string[],
    userId: string,
  ): Promise<MonthlyStockOpnameDetail> {
    requireBranchAccess(dto.branch_id, branchIds)

    const companyId = await getCompanyIdForBranch(dto.branch_id) ?? ''
    if (!companyId) {
      throw new BusinessRuleError('Branch tidak ditemukan atau tidak memiliki company')
    }

    // Validate warehouse exists for this branch
    const warehouse = await monthlyStockOpnameRepository.findWarehouseById(dto.warehouse_id, dto.branch_id)
    if (!warehouse) {
      throw new BusinessRuleError('Warehouse tidak ditemukan untuk cabang ini')
    }

    // Get branch name for error messages
    const branchName = await monthlyStockOpnameRepository.getBranchName(dto.branch_id) ?? dto.branch_id

    // Validate scope
    const positionId = dto.scope === 'BY_POSITION' ? (dto.position_id ?? null) : null
    if (dto.scope === 'BY_POSITION' && !positionId) {
      throw new BusinessRuleError('Position wajib dipilih untuk scope BY_POSITION')
    }

    // Check for duplicate
    const existing = await monthlyStockOpnameRepository.findDuplicate(
      dto.branch_id, dto.warehouse_id, dto.opname_date, positionId,
    )
    if (existing) {
      throw new MonthlyOpnameDuplicateError(
        branchName, warehouse.warehouse_name, dto.opname_date,
      )
    }

    // Get products with stock in the warehouse
    let productsWithStock = await monthlyStockOpnameRepository.getProductsWithStock(dto.warehouse_id)

    // Filter by position if scope is BY_POSITION
    if (dto.scope === 'BY_POSITION' && positionId) {
      const positionProductIds = await monthlyStockOpnameRepository.getProductsByPosition(positionId, companyId)
      if (positionProductIds.size === 0) {
        throw new BusinessRuleError('Tidak ada produk yang terkait dengan position ini.')
      }
      productsWithStock = productsWithStock.filter(p => positionProductIds.has(p.product_id))
    }

    if (productsWithStock.length === 0) {
      throw new BusinessRuleError('Tidak ada produk dengan stok di warehouse ini.')
    }

    // Snapshot current time
    const snapshotTakenAt = new Date().toISOString()

    // Build lines from snapshot
    const lines = productsWithStock.map((product, index) => ({
      product_id: product.product_id,
      product_code: product.product_code,
      product_name: product.product_name,
      uom: product.uom,
      snapshot_qty: product.qty,
      cost_per_unit: product.avg_cost,
      sort_order: index + 1,
    }))

    // Insert within transaction
    const sessionId = await monthlyStockOpnameRepository.withTransaction(async (client) => {
      const branchCode = await monthlyStockOpnameRepository.getBranchCode(dto.branch_id) ?? 'UNK'
      const opnameNumber = await monthlyStockOpnameRepository.generateOpnameNumber(client, companyId, branchCode, dto.opname_date)

      const header = await monthlyStockOpnameRepository.insertHeader(client, {
        company_id: companyId,
        branch_id: dto.branch_id,
        warehouse_id: dto.warehouse_id,
        opname_number: opnameNumber,
        opname_date: dto.opname_date,
        scope: dto.scope,
        position_id: positionId,
        pic_user_id: userId,
        snapshot_taken_at: snapshotTakenAt,
        notes: dto.notes ?? null,
        total_lines: lines.length,
        created_by: userId,
      })

      await monthlyStockOpnameRepository.insertLines(client, header.id, lines)

      return header.id
    })

    // Audit log
    await AuditService.log('CREATE', 'monthly_stock_opname', sessionId, userId, undefined, {
      branch_id: dto.branch_id,
      warehouse_id: dto.warehouse_id,
      opname_date: dto.opname_date,
      scope: dto.scope,
      total_lines: lines.length,
    })

    // Fetch and return full detail
    const detail = await monthlyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!detail) throw new MonthlyOpnameNotFoundError(sessionId)
    return detail
  }

  // ─── LIST ───────────────────────────────────────────────────────────────────

  async list(
    branchIds: string[],
    pagination: { page: number; limit: number },
    filter?: MonthlyOpnameListFilter,
    search?: string,
  ) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await monthlyStockOpnameRepository.findAll(
      branchIds, { limit: pagination.limit, offset }, filter, search,
    )
    return { data, total, page: pagination.page, limit: pagination.limit }
  }

  // ─── GET BY ID ──────────────────────────────────────────────────────────────

  async getById(id: string, branchIds: string[]): Promise<MonthlyStockOpnameDetail> {
    const detail = await monthlyStockOpnameRepository.findByIdAccessible(id, branchIds)
    if (!detail) throw new MonthlyOpnameNotFoundError(id)
    return detail
  }

  // ─── UPDATE LINE ────────────────────────────────────────────────────────────

  async updateLine(
    opnameId: string,
    lineId: string,
    dto: UpdateLineDto,
    branchIds: string[],
    userId: string,
  ): Promise<MonthlyStockOpnameLine> {
    const session = await this.getEditableSession(opnameId, branchIds)

    const line = await monthlyStockOpnameRepository.getLineById(opnameId, lineId)
    if (!line) throw new BusinessRuleError('Line tidak ditemukan')

    // Calculate selisih
    const selisihQty = dto.actual_qty - line.expected_qty
    const selisihValue = selisihQty * line.cost_per_unit

    const updated = await monthlyStockOpnameRepository.updateLine(lineId, {
      actual_qty: dto.actual_qty,
      investigasi_note: dto.investigasi_note ?? line.investigasi_note,
      selisih_qty: selisihQty,
      selisih_value: selisihValue,
    })
    if (!updated) throw new BusinessRuleError('Gagal mengupdate line')

    // Update completed_lines count on header
    const allLines = await monthlyStockOpnameRepository.getLinesByOpnameId(opnameId)
    const completedCount = allLines.filter(l => l.actual_qty !== null).length
    await monthlyStockOpnameRepository.updateHeaderDirect(opnameId, {
      completed_lines: completedCount,
      updated_by: userId,
    })

    return updated
  }

  // ─── BULK UPDATE LINES ──────────────────────────────────────────────────────

  async bulkUpdateLines(
    opnameId: string,
    dto: BulkUpdateLinesDto,
    branchIds: string[],
    userId: string,
  ): Promise<MonthlyStockOpnameLine[]> {
    await this.getEditableSession(opnameId, branchIds)

    // Fetch all lines upfront (1 query instead of N)
    const allLines = await monthlyStockOpnameRepository.getLinesByOpnameId(opnameId)
    const lineMap = new Map(allLines.map(l => [l.id, l]))

    // Build batch updates
    const updates = dto.lines
      .map(lineDto => {
        const line = lineMap.get(lineDto.line_id)
        if (!line) return null
        const selisihQty = lineDto.actual_qty - Number(line.expected_qty)
        const selisihValue = selisihQty * Number(line.cost_per_unit)
        return {
          lineId: lineDto.line_id,
          actual_qty: lineDto.actual_qty,
          investigasi_note: lineDto.investigasi_note ?? null,
          selisih_qty: selisihQty,
          selisih_value: selisihValue,
        }
      })
      .filter((u): u is NonNullable<typeof u> => u !== null)

    // Single batch update (1 round trip)
    await monthlyStockOpnameRepository.bulkUpdateActual(opnameId, updates)

    // Refresh and return updated lines
    const refreshedLines = await monthlyStockOpnameRepository.getLinesByOpnameId(opnameId)
    const completedCount = refreshedLines.filter(l => l.actual_qty !== null).length
    await monthlyStockOpnameRepository.updateHeaderDirect(opnameId, {
      completed_lines: completedCount,
      updated_by: userId,
    })

    const updatedIds = new Set(updates.map(u => u.lineId))
    return refreshedLines.filter(l => updatedIds.has(l.id))
  }

  // ─── RECALCULATE EXPECTED ───────────────────────────────────────────────────

  async recalculateExpected(
    opnameId: string,
    branchIds: string[],
    userId: string,
  ): Promise<MonthlyStockOpnameDetail> {
    const session = await this.getEditableSession(opnameId, branchIds)

    const lines = await monthlyStockOpnameRepository.getLinesByOpnameId(opnameId)
    if (lines.length === 0) throw new BusinessRuleError('Tidak ada lines untuk direcalculate')

    // Get net movements since snapshot
    const header = await monthlyStockOpnameRepository.findHeaderById(opnameId)
    if (!header || !header.snapshot_taken_at) {
      throw new BusinessRuleError('Snapshot timestamp tidak ditemukan')
    }

    const productIds = lines.map(l => l.product_id)
    const movementMap = await monthlyStockOpnameRepository.getNetMovementsSince(
      header.warehouse_id, header.snapshot_taken_at, productIds,
    )

    // Build bulk update
    const updates = lines.map(line => {
      const movementDuringSo = movementMap.get(line.product_id) ?? 0
      const expectedQty = Number(line.snapshot_qty) + movementDuringSo

      // Recalculate selisih if actual_qty is set
      let selisihQty: number | null = null
      let selisihValue: number | null = null
      if (line.actual_qty !== null) {
        selisihQty = Number(line.actual_qty) - expectedQty
        selisihValue = selisihQty * Number(line.cost_per_unit)
      }

      return {
        lineId: line.id,
        movement_during_so: movementDuringSo,
        expected_qty: expectedQty,
        selisih_qty: selisihQty,
        selisih_value: selisihValue,
      }
    })

    await monthlyStockOpnameRepository.bulkUpdateExpected(opnameId, updates)

    // Update total_selisih_value on header
    const totalSelisih = updates.reduce((sum, u) => sum + Math.abs(u.selisih_value ?? 0), 0)
    await monthlyStockOpnameRepository.withTransaction(async (client) => {
      await monthlyStockOpnameRepository.updateHeaderStatus(client, opnameId, {
        total_selisih_value: totalSelisih,
        updated_by: userId,
      })
    })

    // Return refreshed detail
    const detail = await monthlyStockOpnameRepository.findByIdAccessible(opnameId, branchIds)
    if (!detail) throw new MonthlyOpnameNotFoundError(opnameId)
    return detail
  }

  // ─── CONFIRM SESSION ────────────────────────────────────────────────────────

  async confirmSession(
    opnameId: string,
    branchIds: string[],
    userId: string,
  ): Promise<MonthlyStockOpnameDetail> {
    const session = await this.getEditableSession(opnameId, branchIds)

    const lines = await monthlyStockOpnameRepository.getLinesByOpnameId(opnameId)

    // Validate all lines have actual_qty
    const incompleteLines = lines.filter(l => l.actual_qty === null)
    if (incompleteLines.length > 0) {
      throw new MonthlyOpnameIncompleteError(
        lines.length - incompleteLines.length,
        lines.length,
      )
    }

    const header = await monthlyStockOpnameRepository.findHeaderById(opnameId)
    if (!header || !header.snapshot_taken_at) {
      throw new BusinessRuleError('Snapshot timestamp tidak ditemukan')
    }

    // Pre-validate investigasi_note (quick UX check — final validation inside transaction)
    const productIds = lines.map(l => l.product_id)
    const snapshotAt = header.snapshot_taken_at
    const preCheckMovementMap = await monthlyStockOpnameRepository.getNetMovementsSince(
      header.warehouse_id, snapshotAt, productIds,
    )
    const preCheckMissing: string[] = []
    for (const line of lines) {
      const movementDuringSo = preCheckMovementMap.get(line.product_id) ?? 0
      const expectedQty = Number(line.snapshot_qty) + movementDuringSo
      const selisihQty = Number(line.actual_qty) - expectedQty
      if (Math.abs(selisihQty) > 0.0001 && !line.investigasi_note) {
        preCheckMissing.push(line.product_name)
      }
    }
    if (preCheckMissing.length > 0) {
      throw new MonthlyOpnameInvestigasiRequiredError(preCheckMissing)
    }

    // Execute confirm — recalculate + movements in ONE transaction (no race condition)
    let totalSelisihValue = 0

    await monthlyStockOpnameRepository.withTransaction(async (client) => {
      const deptId = await monthlyStockOpnameRepository.getPositionDepartmentId(client, header.position_id)
      // Recalculate inside transaction to get consistent movement data
      const movementMap = await monthlyStockOpnameRepository.getNetMovementsSince(
        header.warehouse_id, snapshotAt, productIds,
      )

      // Final investigasi validation INSIDE transaction (authoritative check)
      const missingInvestigasi: string[] = []
      for (const line of lines) {
        const movementDuringSo = movementMap.get(line.product_id) ?? 0
        const expectedQty = Number(line.snapshot_qty) + movementDuringSo
        const selisihQty = Number(line.actual_qty) - expectedQty
        if (Math.abs(selisihQty) > 0.0001 && !line.investigasi_note) {
          missingInvestigasi.push(line.product_name)
        }
      }
      if (missingInvestigasi.length > 0) {
        throw new MonthlyOpnameInvestigasiRequiredError(missingInvestigasi)
      }

      for (const line of lines) {
        const movementDuringSo = movementMap.get(line.product_id) ?? 0
        const expectedQty = Number(line.snapshot_qty) + movementDuringSo
        const selisihQty = Number(line.actual_qty) - expectedQty
        const selisihValue = selisihQty * Number(line.cost_per_unit)

        // Update line with final values
        await client.query(
          `UPDATE monthly_stock_opname_lines
           SET movement_during_so = $1, expected_qty = $2, selisih_qty = $3, selisih_value = $4, updated_at = now()
           WHERE id = $5`,
          [movementDuringSo, expectedQty, selisihQty, selisihValue, line.id],
        )

        totalSelisihValue += Math.abs(selisihValue)

        // Skip if no meaningful selisih (floating point safe)
        if (Math.abs(selisihQty) <= 0.0001) continue

        // Get current stock balance
        const currentBalance = await stockRepository.getBalanceForUpdate(
          client, header.warehouse_id, line.product_id,
        )
        const currentQty = currentBalance ? Number(currentBalance.qty) : 0
        const currentAvgCost = currentBalance ? Number(currentBalance.avg_cost) : 0
        const costPerUnit = Number(line.cost_per_unit)

        let outMovementId: string | null = null
        let inMovementId: string | null = null

        if (selisihQty < 0) {
          // Selisih negatif → shortage queue (stock OUT_ADJUSTMENT, bukan waste)
          const absSelisih = Math.abs(selisihQty)
          const newQty = currentQty - absSelisih

          const movement = await stockRepository.createMovement(client, {
            warehouse_id: header.warehouse_id,
            product_id: line.product_id,
            movement_type: 'OUT_ADJUSTMENT',
            qty: absSelisih,
            cost_per_unit: costPerUnit,
            reference_type: 'monthly_stock_opname',
            reference_id: opnameId,
            notes: `SO Bulanan ${header.opname_date} - shortage: ${line.product_name}`,
            movement_date: header.opname_date,
            created_by: userId,
          }, newQty)
          outMovementId = movement.id

          await stockRepository.upsertBalance(client, header.warehouse_id, line.product_id, newQty, currentAvgCost)

          await monthlyStockOpnameRepository.insertMonthlyShortageEntry(client, {
            monthly_opname_id: opnameId,
            monthly_opname_line_id: line.id,
            qty: absSelisih,
            shortage_note: line.investigasi_note,
            classified_by: userId,
            company_id: header.company_id,
            branch_id: header.branch_id,
            department_id: deptId,
          })
        } else {
          // Selisih positif → IN_ADJUSTMENT
          const newQty = currentQty + selisihQty
          const newAvgCost = newQty > 0
            ? (currentQty * currentAvgCost + selisihQty * costPerUnit) / newQty
            : costPerUnit

          const movement = await stockRepository.createMovement(client, {
            warehouse_id: header.warehouse_id,
            product_id: line.product_id,
            movement_type: 'IN_ADJUSTMENT',
            qty: selisihQty,
            cost_per_unit: costPerUnit,
            reference_type: 'monthly_stock_opname',
            reference_id: opnameId,
            notes: `SO Bulanan ${header.opname_date} - adjustment in: ${line.product_name}`,
            movement_date: header.opname_date,
            created_by: userId,
          }, newQty)
          inMovementId = movement.id

          await stockRepository.upsertBalance(client, header.warehouse_id, line.product_id, newQty, newAvgCost)
        }

        // Save movement IDs on line
        await monthlyStockOpnameRepository.updateLineMovements(client, line.id, {
          out_movement_id: outMovementId,
          in_movement_id: inMovementId,
        })
      }

      // Update header status
      await monthlyStockOpnameRepository.updateHeaderStatus(client, opnameId, {
        status: 'CONFIRMED',
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
        total_selisih_value: totalSelisihValue,
        completed_lines: lines.length,
        updated_by: userId,
      })
    })

    // Audit log
    await AuditService.log('UPDATE', 'monthly_stock_opname', opnameId, userId, { status: 'DRAFT' }, { status: 'CONFIRMED' })

    const detail = await monthlyStockOpnameRepository.findByIdAccessible(opnameId, branchIds)
    if (!detail) throw new MonthlyOpnameNotFoundError(opnameId)
    return detail
  }

  // ─── CANCEL SESSION ─────────────────────────────────────────────────────────

  async cancelSession(
    opnameId: string,
    branchIds: string[],
    userId: string,
  ): Promise<void> {
    const detail = await monthlyStockOpnameRepository.findByIdAccessible(opnameId, branchIds)
    if (!detail) throw new MonthlyOpnameNotFoundError(opnameId)

    if (detail.status !== 'DRAFT') {
      throw new MonthlyOpnameCannotCancelError(detail.status)
    }

    await monthlyStockOpnameRepository.softDelete(opnameId, userId)

    await AuditService.log('DELETE', 'monthly_stock_opname', opnameId, userId, { status: 'DRAFT' }, { is_deleted: true })
  }

  // ─── THERMAL PRINT DATA ────────────────────────────────────────────────────

  async getThermalPrintData(
    opnameId: string,
    branchIds: string[],
  ): Promise<MonthlyOpnameThermalData> {
    const detail = await monthlyStockOpnameRepository.findByIdAccessible(opnameId, branchIds)
    if (!detail) throw new MonthlyOpnameNotFoundError(opnameId)

    const linesWithSelisih = detail.lines.filter(l => l.selisih_qty !== null && l.selisih_qty !== 0)

    return {
      opname_number: detail.opname_number,
      warehouse_name: detail.warehouse_name,
      branch_name: detail.branch_name,
      opname_date: detail.opname_date,
      pic_name: detail.pic_name,
      confirmed_at: detail.confirmed_at ?? '',
      lines: detail.lines.map(l => ({
        product_code: l.product_code,
        product_name: l.product_name,
        uom: l.uom,
        snapshot_qty: Number(l.snapshot_qty),
        expected_qty: Number(l.expected_qty),
        actual_qty: Number(l.actual_qty ?? 0),
        selisih_qty: Number(l.selisih_qty ?? 0),
        selisih_value: Number(l.selisih_value ?? 0),
        investigasi_note: l.investigasi_note,
      })),
      summary: {
        total_products: detail.lines.length,
        products_with_selisih: linesWithSelisih.length,
        total_selisih_value: Number(detail.total_selisih_value),
      },
    }
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────────

  private async getEditableSession(opnameId: string, branchIds: string[]): Promise<MonthlyStockOpnameDetail> {
    const detail = await monthlyStockOpnameRepository.findByIdAccessible(opnameId, branchIds)
    if (!detail) throw new MonthlyOpnameNotFoundError(opnameId)

    if (detail.status !== 'DRAFT' && detail.status !== 'REOPENED') {
      throw new MonthlyOpnameNotEditableError(detail.status)
    }

    return detail
  }
}

export const monthlyStockOpnameService = new MonthlyStockOpnameService()
