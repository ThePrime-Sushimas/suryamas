import { stockAdjustmentsRepository } from './stock-adjustments.repository'
import { stockRepository } from '../stock/stock.repository'
import {
  StockAdjustmentNotFoundError,
  StockAdjustmentInvalidStatusError,
  StockAdjustmentInsufficientStockError,
  StockAdjustmentOutputExceedsInputError,
} from './stock-adjustments.errors'
import { BusinessRuleError } from '../../utils/errors.base'
import { AuditService } from '../monitoring/monitoring.service'
import type {
  CreateStockAdjustmentDto, ConfirmStockAdjustmentDto, CancelStockAdjustmentDto,
  StockAdjustmentDetail
} from './stock-adjustments.types'

export class StockAdjustmentsService {

  // ─── LIST ─────────────────────────────────────────────────────────────────────

  async list(
    branchIds: string[],
    pagination: { page: number; limit: number },
    filter?: {
      adjustment_type?: string; status?: string; branch_id?: string
      date_from?: string; date_to?: string; search?: string
    }
  ) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await stockAdjustmentsRepository.findAll(branchIds, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return {
      data,
      pagination: {
        page: pagination.page, limit: pagination.limit, total, totalPages,
        hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1,
      },
    }
  }

  // ─── GET BY ID ────────────────────────────────────────────────────────────────

  async getById(id: string, branchIds: string[]): Promise<StockAdjustmentDetail> {
    const detail = await stockAdjustmentsRepository.findById(id, branchIds)
    if (!detail) throw new StockAdjustmentNotFoundError(id)
    return detail
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────────

  async create(branchIds: string[], dto: CreateStockAdjustmentDto): Promise<StockAdjustmentDetail> {
    const companyId = await stockAdjustmentsRepository.getWarehouseCompanyId(dto.warehouse_id)
    if (!companyId) throw new Error('Gudang tidak ditemukan')

    // Validate BREAKDOWN outputs don't exceed input
    if (dto.adjustment_type === 'BREAKDOWN' && dto.outputs && dto.input_qty) {
      const totalOutputQty = dto.outputs.reduce((sum, o) => sum + o.qty, 0)
      if (totalOutputQty > dto.input_qty) {
        throw new StockAdjustmentOutputExceedsInputError()
      }
    }

    const adjustmentId = await stockRepository.withTransaction(async (client) => {
      const branchId = await stockAdjustmentsRepository.getWarehouseBranchId(client, dto.warehouse_id)
      if (!branchId) throw new Error('Gudang tidak ditemukan')
      if (!branchIds.includes(branchId)) throw new Error('Anda tidak memiliki akses ke cabang gudang ini')

      const branchCode = await stockAdjustmentsRepository.getBranchCode(client, branchId)
      if (!branchCode) throw new Error('Branch code tidak ditemukan')

      const adjustmentNumber = await stockAdjustmentsRepository.generateAdjustmentNumber(
        client, companyId, branchCode, dto.adjustment_date, dto.adjustment_type
      )

      const { id } = await stockAdjustmentsRepository.create(client, companyId, branchId, dto, adjustmentNumber)

      // Create lines for WASTE
      if (dto.adjustment_type === 'WASTE' && dto.lines && dto.lines.length > 0) {
        await stockAdjustmentsRepository.createLines(client, id, dto.lines)
      }

      // Create outputs for BREAKDOWN
      if (dto.adjustment_type === 'BREAKDOWN' && dto.outputs && dto.outputs.length > 0) {
        await stockAdjustmentsRepository.createOutputs(client, id, dto.outputs)
      }

      await AuditService.log('CREATE', 'stock_adjustment', id, dto.created_by ?? '', undefined, {
        adjustment_number: adjustmentNumber,
        adjustment_type: dto.adjustment_type,
      })

      return id
    })

    return this.getById(adjustmentId, branchIds)
  }

  // ─── CONFIRM ──────────────────────────────────────────────────────────────────

  async confirm(id: string, branchIds: string[], dto: ConfirmStockAdjustmentDto): Promise<StockAdjustmentDetail> {
    let totalWasteValue = 0

    await stockRepository.withTransaction(async (client) => {
      const detail = await stockAdjustmentsRepository.lockAndFindById(client, id, branchIds)
      if (!detail) throw new StockAdjustmentNotFoundError(id)
      if (detail.status !== 'DRAFT') {
        throw new StockAdjustmentInvalidStatusError(detail.status, 'DRAFT')
      }

      if (detail.adjustment_type === 'WASTE') {
        totalWasteValue = await this.confirmWaste(client, detail, dto.confirmed_by)
      } else {
        totalWasteValue = await this.confirmBreakdown(client, detail, dto.confirmed_by)
      }

      await stockAdjustmentsRepository.confirmAdjustment(client, id, dto.confirmed_by)

      // Generate journal for waste value
      if (totalWasteValue > 0) {
        await this.generateWasteJournal(client, detail, totalWasteValue, dto.confirmed_by)
      }
    })

    await AuditService.log('UPDATE', 'stock_adjustment', id, dto.confirmed_by, { status: 'DRAFT' }, { status: 'CONFIRMED' })
    return this.getById(id, branchIds)
  }

  // ─── CONFIRM WASTE (multi-line) ───────────────────────────────────────────────

  private async confirmWaste(
    client: import('pg').PoolClient,
    detail: StockAdjustmentDetail,
    userId: string,
  ): Promise<number> {
    let totalWasteValue = 0

    for (const line of detail.lines) {
      const qty = Number(line.qty)

      const balance = await stockRepository.getBalanceForUpdate(client, detail.warehouse_id, line.product_id)
      const currentQty = balance ? Number(balance.qty) : 0
      if (currentQty < qty) {
        throw new StockAdjustmentInsufficientStockError(line.product_name, currentQty, qty)
      }
      const avgCost = balance ? Number(balance.avg_cost) : 0

      const newQty = currentQty - qty
      const outMovement = await stockRepository.createMovement(
        client,
        {
          warehouse_id: detail.warehouse_id,
          product_id: line.product_id,
          movement_type: 'OUT_WASTE',
          qty,
          cost_per_unit: avgCost,
          reference_type: 'adjustment',
          reference_id: detail.id,
          notes: `${detail.adjustment_number} - ${detail.reason ?? 'WASTE'} - ${line.product_name}`,
          created_by: userId,
        },
        newQty
      )
      await stockRepository.upsertBalance(client, detail.warehouse_id, line.product_id, newQty, avgCost)
      await stockAdjustmentsRepository.updateLineMovement(client, line.id, outMovement.id, avgCost)

      totalWasteValue += qty * avgCost
    }

    // Update waste_qty on header (sum of all line qtys for reporting)
    const totalWasteQty = detail.lines.reduce((sum, l) => sum + Number(l.qty), 0)
    await client.query(
      `UPDATE stock_adjustments SET waste_qty = $2, updated_at = now() WHERE id = $1`,
      [detail.id, totalWasteQty]
    )

    return totalWasteValue
  }

  // ─── CONFIRM BREAKDOWN (single input → multiple outputs) ──────────────────────

  private async confirmBreakdown(
    client: import('pg').PoolClient,
    detail: StockAdjustmentDetail,
    userId: string,
  ): Promise<number> {
    const inputQty = Number(detail.input_qty!)

    // Lock & check input stock
    const balance = await stockRepository.getBalanceForUpdate(client, detail.warehouse_id, detail.input_product_id!)
    const currentQty = balance ? Number(balance.qty) : 0
    if (currentQty < inputQty) {
      throw new StockAdjustmentInsufficientStockError(detail.input_product_name ?? '', currentQty, inputQty)
    }
    const avgCost = balance ? Number(balance.avg_cost) : 0

    // OUT movement for input
    const newQty = currentQty - inputQty
    const outMovement = await stockRepository.createMovement(
      client,
      {
        warehouse_id: detail.warehouse_id,
        product_id: detail.input_product_id!,
        movement_type: 'OUT_WASTE',
        qty: inputQty,
        cost_per_unit: avgCost,
        reference_type: 'adjustment',
        reference_id: detail.id,
        notes: `${detail.adjustment_number} - Breakdown ${detail.input_product_name}`,
        created_by: userId,
      },
      newQty
    )
    await stockRepository.upsertBalance(client, detail.warehouse_id, detail.input_product_id!, newQty, avgCost)
    await stockAdjustmentsRepository.updateInputMovement(client, detail.id, outMovement.id, avgCost)

    // IN movements for outputs
    const totalOutputQty = detail.outputs.reduce((sum, o) => sum + Number(o.qty), 0)
    const totalInputValue = inputQty * avgCost

    for (const output of detail.outputs) {
      const outputQty = Number(output.qty)
      // Distribute cost proportionally
      const outputCostPerUnit = totalOutputQty > 0
        ? (totalInputValue * (outputQty / totalOutputQty)) / outputQty
        : avgCost

      const outputBalance = await stockRepository.getBalanceForUpdate(client, detail.warehouse_id, output.product_id)
      const outputCurrentQty = outputBalance ? Number(outputBalance.qty) : 0
      const outputAvgCost = outputBalance ? Number(outputBalance.avg_cost) : 0
      const newOutputQty = outputCurrentQty + outputQty

      const newOutputAvgCost = newOutputQty > 0
        ? (outputCurrentQty * outputAvgCost + outputQty * outputCostPerUnit) / newOutputQty
        : outputCostPerUnit

      const inMovement = await stockRepository.createMovement(
        client,
        {
          warehouse_id: detail.warehouse_id,
          product_id: output.product_id,
          movement_type: 'IN_PRODUCTION',
          qty: outputQty,
          cost_per_unit: outputCostPerUnit,
          reference_type: 'adjustment',
          reference_id: detail.id,
          notes: `${detail.adjustment_number} - Breakdown dari ${detail.input_product_name}`,
          created_by: userId,
        },
        newOutputQty
      )
      await stockRepository.upsertBalance(client, detail.warehouse_id, output.product_id, newOutputQty, newOutputAvgCost)
      await stockAdjustmentsRepository.updateOutputMovement(client, output.id, inMovement.id, outputCostPerUnit)
    }

    // Calculate waste (susut)
    const wasteQty = inputQty - totalOutputQty
    const wasteValue = wasteQty * avgCost

    // Update waste_qty on header
    await client.query(
      `UPDATE stock_adjustments SET waste_qty = $2, updated_at = now() WHERE id = $1`,
      [detail.id, wasteQty]
    )

    return wasteValue // Only waste portion gets journaled
  }

  // ─── CANCEL ───────────────────────────────────────────────────────────────────

  async cancel(id: string, branchIds: string[], dto: CancelStockAdjustmentDto): Promise<StockAdjustmentDetail> {
    const detail = await this.getById(id, branchIds)
    if (detail.status !== 'DRAFT') {
      throw new StockAdjustmentInvalidStatusError(detail.status, 'DRAFT')
    }
    await stockAdjustmentsRepository.cancelDirect(id, dto.cancelled_by)
    await AuditService.log('UPDATE', 'stock_adjustment', id, dto.cancelled_by, { status: 'DRAFT' }, { status: 'CANCELLED' })
    return this.getById(id, branchIds)
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────────

  async softDelete(id: string, branchIds: string[], userId: string): Promise<void> {
    const detail = await this.getById(id, branchIds)
    if (detail.status !== 'DRAFT' && detail.status !== 'CANCELLED') {
      throw new StockAdjustmentInvalidStatusError(detail.status, 'DRAFT atau CANCELLED')
    }
    await stockAdjustmentsRepository.softDelete(id, userId)
    await AuditService.log('DELETE', 'stock_adjustment', id, userId)
  }

  // ─── DELETE JOURNAL (release-only) ──────────────────────────────────────────

  async deleteJournal(id: string, branchIds: string[], userId: string): Promise<StockAdjustmentDetail> {
    const detail = await this.getById(id, branchIds)
    if (!detail.journal_id) {
      throw new BusinessRuleError('Adjustment ini tidak memiliki jurnal')
    }

    await stockRepository.withTransaction(async (client) => {
      await client.query(`DELETE FROM journal_lines WHERE journal_header_id = $1`, [detail.journal_id])
      await client.query(`DELETE FROM journal_headers WHERE id = $1`, [detail.journal_id])
      await stockAdjustmentsRepository.saveJournalId(client, id, null)
    })

    await AuditService.log('DELETE', 'stock_adjustment_journal', id, userId, undefined, { journal_id: detail.journal_id })
    return this.getById(id, branchIds)
  }

  // ─── JOURNAL GENERATION (private) ──────────────────────────────────────────

  private async generateWasteJournal(
    client: import('pg').PoolClient,
    detail: StockAdjustmentDetail,
    wasteValue: number,
    userId: string,
  ): Promise<void> {
    const companyId = detail.company_id
    if (wasteValue <= 0) return

    const fiscalPeriod = await stockAdjustmentsRepository.findOpenFiscalPeriod(companyId, detail.adjustment_date, client)
    if (!fiscalPeriod) return

    const selisihHpp = await stockAdjustmentsRepository.findCoaByCode(companyId, '510301', client)
    const bahanBaku = await stockAdjustmentsRepository.findCoaByCode(companyId, '110501', client)
    if (!selisihHpp || !bahanBaku) return

    const period = fiscalPeriod.period
    const seq = await stockAdjustmentsRepository.getNextJournalSequence(client, companyId, period)
    const journalNumber = `JI-${period}-${String(seq).padStart(4, '0')}`

    const typeLabel = detail.adjustment_type === 'WASTE' ? 'Waste' : 'Breakdown susut'
    const description = `${typeLabel} ${detail.adjustment_number} (${detail.reason ?? '-'})`

    const journalId = await stockAdjustmentsRepository.insertJournalHeader(client, {
      companyId,
      branchId: detail.branch_id,
      journalNumber,
      sequenceNumber: seq,
      journalDate: detail.adjustment_date,
      period,
      description,
      totalAmount: wasteValue,
      referenceId: detail.id,
      referenceNumber: detail.adjustment_number,
      createdBy: userId,
    })

    await stockAdjustmentsRepository.insertJournalLine(client, {
      journalHeaderId: journalId,
      lineNumber: 1,
      accountId: selisihHpp.id,
      description: `${typeLabel} - ${detail.adjustment_number}`,
      debitAmount: wasteValue,
      creditAmount: 0,
    })

    await stockAdjustmentsRepository.insertJournalLine(client, {
      journalHeaderId: journalId,
      lineNumber: 2,
      accountId: bahanBaku.id,
      description: `${typeLabel} - ${detail.adjustment_number}`,
      debitAmount: 0,
      creditAmount: wasteValue,
    })

    await stockAdjustmentsRepository.saveJournalId(client, detail.id, journalId)
  }
}

export const stockAdjustmentsService = new StockAdjustmentsService()
