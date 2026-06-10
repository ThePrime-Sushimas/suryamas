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

    // WASTE & BREAKDOWN: warehouse must be READY
    const warehouseType = await stockAdjustmentsRepository.getWarehouseType(dto.warehouse_id)
    if (!['WASTE', 'BREAKDOWN'].includes(dto.adjustment_type)) {
      throw new BusinessRuleError(`Tipe adjustment '${dto.adjustment_type}' tidak valid`)
    }
    if (warehouseType !== 'READY') {
      throw new BusinessRuleError(`Adjustment hanya dapat dilakukan di gudang tipe READY, bukan ${warehouseType}`)
    }

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

  async confirm(id: string, branchIds: string[], dto: ConfirmStockAdjustmentDto): Promise<StockAdjustmentDetail & { journal_pending?: boolean }> {
    let totalWasteValue = 0
    const lineCosts = new Map<string, number>()
    let journalPending = false

    await stockRepository.withTransaction(async (client) => {
      const detail = await stockAdjustmentsRepository.lockAndFindById(client, id, branchIds)
      if (!detail) throw new StockAdjustmentNotFoundError(id)
      if (detail.status !== 'DRAFT') {
        throw new StockAdjustmentInvalidStatusError(detail.status, 'DRAFT')
      }

      if (detail.adjustment_type === 'WASTE') {
        totalWasteValue = await this.confirmWaste(client, detail, dto.confirmed_by, lineCosts)
      } else {
        totalWasteValue = await this.confirmBreakdown(client, detail, dto.confirmed_by)
      }

      await stockAdjustmentsRepository.confirmAdjustment(client, id, dto.confirmed_by)

      // Generate journal for waste value (non-blocking: if fails, just log it)
      try {
        if (totalWasteValue > 0) {
          await this.generateWasteJournal(client, detail, totalWasteValue, dto.confirmed_by, lineCosts, false)
        }
      } catch (err) {
        console.warn(`[StockAdjustmentConfirm] Journal generation failed for ${detail.adjustment_number}:`, err)
        journalPending = true
        // Don't re-throw: allow confirm to succeed even if journal fails
      }
    })

    await AuditService.log('UPDATE', 'stock_adjustment', id, dto.confirmed_by, { status: 'DRAFT' }, { status: 'CONFIRMED' })
    const result = await this.getById(id, branchIds)
    
    // Attach flag for frontend to show warning
    return { ...result, journal_pending: journalPending }
  }

  // ─── CONFIRM WASTE (multi-line) ───────────────────────────────────────────────

  private async confirmWaste(
    client: import('pg').PoolClient,
    detail: StockAdjustmentDetail,
    userId: string,
    lineCosts: Map<string, number>,
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

      // Store cost for journal generation
      lineCosts.set(line.id, avgCost)

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
          movement_date: detail.adjustment_date,
          notes: `${detail.adjustment_number} - ${detail.reason ?? 'WASTE'} - ${line.product_name}`,
          created_by: userId,
        },
        newQty
      )
      await stockRepository.upsertBalance(client, detail.warehouse_id, line.product_id, newQty, avgCost)
      await stockAdjustmentsRepository.updateLineMovement(client, line.id, outMovement.id, avgCost)

      totalWasteValue += qty * avgCost
    }

    // Update waste_qty and waste_value on header
    const totalWasteQty = detail.lines.reduce((sum, l) => sum + Number(l.qty), 0)
    await client.query(
      `UPDATE stock_adjustments SET waste_qty = $2, waste_value = $3, updated_at = now() WHERE id = $1`,
      [detail.id, totalWasteQty, totalWasteValue]
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
        movement_date: detail.adjustment_date,
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
          movement_date: detail.adjustment_date,
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

    // Update waste_qty and waste_value on header
    await client.query(
      `UPDATE stock_adjustments SET waste_qty = $2, waste_value = $3, updated_at = now() WHERE id = $1`,
      [detail.id, wasteQty, wasteValue]
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

  // ─── GENERATE JOURNAL (manual retry) ──────────────────────────────────────

  async generateJournal(id: string, branchIds: string[], userId: string): Promise<StockAdjustmentDetail> {
    const detail = await this.getById(id, branchIds)

    if (detail.status !== 'CONFIRMED') {
      throw new BusinessRuleError('Hanya adjustment yang sudah CONFIRMED yang bisa di-post journal')
    }

    if (detail.journal_id) {
      throw new BusinessRuleError('Adjustment ini sudah memiliki journal')
    }

    // Use saved waste_value from confirm, not recalculate
    const wasteValue = Number(detail.waste_value ?? 0)
    if (wasteValue <= 0) {
      throw new BusinessRuleError('Adjustment ini tidak memiliki waste value untuk di-journal')
    }

    // Build lineCosts only for WASTE (needed for per-product journal lines)
    const lineCosts = new Map<string, number>()
    if (detail.adjustment_type === 'WASTE') {
      for (const line of detail.lines) {
        lineCosts.set(line.id, Number(line.cost_per_unit ?? 0))
      }
    }
    // For BREAKDOWN: lineCosts not used (journal uses wasteValue directly)

    await stockRepository.withTransaction(async (client) => {
      await this.generateWasteJournal(client, detail, wasteValue, userId, lineCosts, true)
    })

    await AuditService.log('UPDATE', 'stock_adjustment_journal', id, userId, undefined, { action: 'generate_journal' })
    return this.getById(id, branchIds)
  }

  // ─── JOURNAL GENERATION (private) ──────────────────────────────────────────

  /**
   * Generate waste journal with:
   * - WASTE: DR grouped by station (1 line per station), CR per product (1 line per product)
   *   Requires lineCosts map to be populated from detail.lines
   * - BREAKDOWN: DR 1 line (susut), CR 1 line (input product)
   *   lineCosts map is not used for BREAKDOWN
   */
  private async generateWasteJournal(
    client: import('pg').PoolClient,
    detail: StockAdjustmentDetail,
    wasteValue: number,
    userId: string,
    lineCosts: Map<string, number>,
    isManualRetry = false,
  ): Promise<void> {
    const companyId = detail.company_id
    if (wasteValue <= 0) {
      console.log(`[StockAdjustmentJournal] Skipped: waste value <= 0 (${wasteValue})`)
      return
    }

    const fiscalPeriod = await stockAdjustmentsRepository.findOpenFiscalPeriod(companyId, detail.adjustment_date, client)
    if (!fiscalPeriod) {
      if (isManualRetry) {
        // Manual retry: user explicitly clicked button, so fiscal period MUST be open
        throw new BusinessRuleError(`Fiscal period untuk tanggal ${detail.adjustment_date} belum dibuka`)
      } else {
        // Auto-generation during confirm: silently skip if fiscal period not open yet
        console.warn(`[StockAdjustmentJournal] No open fiscal period found for company ${companyId} on date ${detail.adjustment_date}`)
        return
      }
    }

    const selisihHpp = await stockAdjustmentsRepository.findCoaByCode(companyId, '510301', client)
    const persediaanCabang = await stockAdjustmentsRepository.findCoaByCode(companyId, '110505', client)
    if (!selisihHpp) {
      const msg = `COA 510301 (Selisih HPP) tidak ditemukan untuk perusahaan ini`
      if (isManualRetry) throw new BusinessRuleError(msg)
      console.warn(`[StockAdjustmentJournal] ${msg}`)
      return
    }
    if (!persediaanCabang) {
      const msg = `COA 110505 (Persediaan Cabang) tidak ditemukan untuk perusahaan ini`
      if (isManualRetry) throw new BusinessRuleError(msg)
      console.warn(`[StockAdjustmentJournal] ${msg}`)
      return
    }

    console.log(`[StockAdjustmentJournal] Generating journal for adjustment ${detail.adjustment_number}, waste value: ${wasteValue}`)

    const period = fiscalPeriod.period
    const seq = await stockAdjustmentsRepository.getNextJournalSequence(client, companyId, period)
    const journalNumber = `JI-${period}-${String(seq).padStart(4, '0')}`

    const typeLabel = detail.adjustment_type === 'WASTE' ? 'Waste' : 'Breakdown susut'
    const reasonLabel = detail.reason ?? '-'
    const description = `${typeLabel} ${detail.adjustment_number} (${reasonLabel})`

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

    let lineNumber = 1

    if (detail.adjustment_type === 'WASTE') {
      // ─── WASTE: DR grouped by station, CR per product ─────────────────

      // Group lines by station for DR side
      const stationGroups = new Map<string, number>()
      for (const line of detail.lines) {
        const station = line.station || 'GENERAL'
        const cost = lineCosts.get(line.id) ?? 0
        const value = Number(line.qty) * cost
        stationGroups.set(station, (stationGroups.get(station) ?? 0) + value)
      }

      // DR lines — 1 per station
      for (const [station, value] of stationGroups) {
        if (value <= 0) continue
        await stockAdjustmentsRepository.insertJournalLine(client, {
          journalHeaderId: journalId,
          lineNumber: lineNumber++,
          accountId: selisihHpp.id,
          description: `${typeLabel} - Station ${station} (${detail.adjustment_number})`,
          debitAmount: value,
          creditAmount: 0,
        })
      }

      // CR lines — 1 per product
      for (const line of detail.lines) {
        const cost = lineCosts.get(line.id) ?? 0
        const value = Number(line.qty) * cost
        if (value <= 0) continue
        const fmtQty = parseFloat(Number(line.qty).toFixed(4)).toString()
        await stockAdjustmentsRepository.insertJournalLine(client, {
          journalHeaderId: journalId,
          lineNumber: lineNumber++,
          accountId: persediaanCabang.id,
          description: `${line.product_name} - ${fmtQty} ${line.base_unit_name ?? ''}`.trim(),
          debitAmount: 0,
          creditAmount: value,
        })
      }
    } else {
      // ─── BREAKDOWN: DR 1 line (susut), CR 1 line (input product) ──────

      await stockAdjustmentsRepository.insertJournalLine(client, {
        journalHeaderId: journalId,
        lineNumber: lineNumber++,
        accountId: selisihHpp.id,
        description: `Breakdown susut - ${detail.input_product_name} (${detail.adjustment_number})`,
        debitAmount: wasteValue,
        creditAmount: 0,
      })

      await stockAdjustmentsRepository.insertJournalLine(client, {
        journalHeaderId: journalId,
        lineNumber: lineNumber++,
        accountId: persediaanCabang.id,
        description: `Breakdown susut - ${detail.input_product_name}`,
        debitAmount: 0,
        creditAmount: wasteValue,
      })
    }

    await stockAdjustmentsRepository.saveJournalId(client, detail.id, journalId)
  }
}

export const stockAdjustmentsService = new StockAdjustmentsService()
