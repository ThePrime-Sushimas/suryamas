import { stockTransfersRepository } from './stock-transfers.repository'
import { stockRepository } from '../stock/stock.repository'
import {
  StockTransferNotFoundError,
  StockTransferInvalidStatusError,
  StockTransferInsufficientStockError,
} from './stock-transfers.errors'
import { BusinessRuleError } from '../../utils/errors.base'
import { AuditService } from '../monitoring/monitoring.service'
import type { MovementType, ReferenceType } from '../stock/stock.types'
import type {
  CreateStockTransferDto, UpdateStockTransferDto, ConfirmStockTransferDto,
  ReturnLoanDto, CancelStockTransferDto,
  StockTransferDetail
} from './stock-transfers.types'

export class StockTransfersService {

  // ─── LIST ─────────────────────────────────────────────────────────────────────

  async list(
    branchIds: string[],
    pagination: { page: number; limit: number },
    filter?: {
      transfer_type?: string; status?: string
      source_branch_id?: string; target_branch_id?: string
      date_from?: string; date_to?: string; search?: string
    }
  ) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await stockTransfersRepository.findAll(branchIds, { limit: pagination.limit, offset }, filter)
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

  async getById(id: string, branchIds: string[]): Promise<StockTransferDetail> {
    const detail = await stockTransfersRepository.findById(id, branchIds)
    if (!detail) throw new StockTransferNotFoundError(id)
    return detail
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────────

  async create(branchIds: string[], dto: CreateStockTransferDto): Promise<StockTransferDetail> {
    // Resolve company from source warehouse
    const companyId = await stockTransfersRepository.getWarehouseCompanyId(dto.source_warehouse_id)
    if (!companyId) throw new Error('Gudang sumber tidak ditemukan')

    const transferId = await stockRepository.withTransaction(async (client) => {
      // Resolve branch IDs from warehouses
      const sourceBranchId = await stockTransfersRepository.getWarehouseBranchId(client, dto.source_warehouse_id)
      const targetBranchId = await stockTransfersRepository.getWarehouseBranchId(client, dto.target_warehouse_id)
      if (!sourceBranchId) throw new Error('Gudang sumber tidak ditemukan')
      if (!targetBranchId) throw new Error('Gudang tujuan tidak ditemukan')

      // User must have access to source branch
      if (!branchIds.includes(sourceBranchId)) {
        throw new Error('Anda tidak memiliki akses ke cabang gudang sumber')
      }

      const branchCode = await stockTransfersRepository.getBranchCode(client, sourceBranchId)
      if (!branchCode) throw new Error('Branch code tidak ditemukan')

      const transferNumber = await stockTransfersRepository.generateTransferNumber(
        client, companyId, branchCode, dto.transfer_date, dto.transfer_type ?? 'TRANSFER'
      )

      const { id } = await stockTransfersRepository.create(
        client, companyId, dto, transferNumber, sourceBranchId, targetBranchId
      )

      await stockTransfersRepository.createLines(client, id, dto.lines)

      await AuditService.log('CREATE', 'stock_transfer', id, dto.created_by ?? '', undefined, {
        transfer_number: transferNumber,
        transfer_type: dto.transfer_type ?? 'TRANSFER',
        source_warehouse_id: dto.source_warehouse_id,
        target_warehouse_id: dto.target_warehouse_id,
        line_count: dto.lines.length,
      })

      return id
    })

    return this.getById(transferId, branchIds)
  }

  // ─── UPDATE (DRAFT only) ─────────────────────────────────────────────────────

  async update(id: string, branchIds: string[], dto: UpdateStockTransferDto): Promise<StockTransferDetail> {
    await stockRepository.withTransaction(async (client) => {
      const detail = await stockTransfersRepository.lockAndFindById(client, id, branchIds)
      if (!detail) throw new StockTransferNotFoundError(id)
      if (detail.status !== 'DRAFT') {
        throw new StockTransferInvalidStatusError(detail.status, 'DRAFT')
      }

      // Resolve branch IDs from new warehouses
      const sourceBranchId = await stockTransfersRepository.getWarehouseBranchId(client, dto.source_warehouse_id)
      const targetBranchId = await stockTransfersRepository.getWarehouseBranchId(client, dto.target_warehouse_id)
      if (!sourceBranchId) throw new Error('Gudang sumber tidak ditemukan')
      if (!targetBranchId) throw new Error('Gudang tujuan tidak ditemukan')

      // User must have access to source branch
      if (!branchIds.includes(sourceBranchId)) {
        throw new Error('Anda tidak memiliki akses ke cabang gudang sumber')
      }

      await stockTransfersRepository.updateHeader(client, id, dto, sourceBranchId, targetBranchId)
      await stockTransfersRepository.replaceLines(client, id, dto.lines)

      await AuditService.log('UPDATE', 'stock_transfer', id, dto.updated_by ?? '', undefined, {
        source_warehouse_id: dto.source_warehouse_id,
        target_warehouse_id: dto.target_warehouse_id,
        transfer_date: dto.transfer_date,
        line_count: dto.lines.length,
      })
    })

    return this.getById(id, branchIds)
  }

  // ─── CONFIRM ──────────────────────────────────────────────────────────────────

  async confirm(id: string, branchIds: string[], dto: ConfirmStockTransferDto): Promise<StockTransferDetail> {
    await stockRepository.withTransaction(async (client) => {
      // Lock header + validate status inside transaction to prevent race condition
      const detail = await stockTransfersRepository.lockAndFindById(client, id, branchIds)
      if (!detail) throw new StockTransferNotFoundError(id)
      if (detail.status !== 'DRAFT') {
        throw new StockTransferInvalidStatusError(detail.status, 'DRAFT')
      }

      for (const line of detail.lines) {
        const qty = Number(line.qty)

        // Lock & check source stock
        const sourceBalance = await stockRepository.getBalanceForUpdate(
          client, detail.source_warehouse_id, line.product_id
        )
        const sourceQty = sourceBalance ? Number(sourceBalance.qty) : 0
        if (sourceQty < qty) {
          throw new StockTransferInsufficientStockError(line.product_name, sourceQty, qty)
        }

        const sourceAvgCost = sourceBalance ? Number(sourceBalance.avg_cost) : 0

        // OUT from source
        const newSourceQty = sourceQty - qty
        const movementType: MovementType = detail.transfer_type === 'LOAN' ? 'OUT_LOAN' : 'OUT_TRANSFER'
        const referenceType: ReferenceType = detail.transfer_type === 'LOAN' ? 'branch_loan' : 'transfer_order'

        const outMovement = await stockRepository.createMovement(
          client,
          {
            warehouse_id: detail.source_warehouse_id,
            product_id: line.product_id,
            movement_type: movementType,
            qty,
            cost_per_unit: sourceAvgCost,
            reference_type: referenceType,
            reference_id: id,
            notes: `${detail.transfer_number} → ${detail.target_warehouse_name}`,
            created_by: dto.confirmed_by,
          },
          newSourceQty
        )
        await stockRepository.upsertBalance(client, detail.source_warehouse_id, line.product_id, newSourceQty, sourceAvgCost)

        // IN to target
        const targetBalance = await stockRepository.getBalanceForUpdate(
          client, detail.target_warehouse_id, line.product_id
        )
        const targetQty = targetBalance ? Number(targetBalance.qty) : 0
        const targetAvgCost = targetBalance ? Number(targetBalance.avg_cost) : 0
        const newTargetQty = targetQty + qty

        const newTargetAvgCost = newTargetQty > 0
          ? (targetQty * targetAvgCost + qty * sourceAvgCost) / newTargetQty
          : sourceAvgCost

        const inMovement = await stockRepository.createMovement(
          client,
          {
            warehouse_id: detail.target_warehouse_id,
            product_id: line.product_id,
            movement_type: 'IN_TRANSFER',
            qty,
            cost_per_unit: sourceAvgCost,
            reference_type: referenceType,
            reference_id: id,
            notes: `${detail.transfer_number} ← ${detail.source_warehouse_name}`,
            created_by: dto.confirmed_by,
          },
          newTargetQty
        )
        await stockRepository.upsertBalance(client, detail.target_warehouse_id, line.product_id, newTargetQty, newTargetAvgCost)

        // Update line with movement refs
        await stockTransfersRepository.updateMovementRefs(client, line.id, outMovement.id, inMovement.id)
      }

      await stockTransfersRepository.confirmTransfer(client, id, dto.confirmed_by)

      // Generate journals for inter-branch transfers (skip intra-branch)
      if (detail.source_branch_id !== detail.target_branch_id) {
        await this.generateTransferJournals(client, detail, dto.confirmed_by)
      }
    })

    await AuditService.log('UPDATE', 'stock_transfer', id, dto.confirmed_by, { status: 'DRAFT' }, { status: 'CONFIRMED' })
    return this.getById(id, branchIds)
  }

  // ─── RETURN LOAN ──────────────────────────────────────────────────────────────

  async returnLoan(id: string, branchIds: string[], dto: ReturnLoanDto): Promise<StockTransferDetail> {
    await stockRepository.withTransaction(async (client) => {
      // Lock header + validate inside transaction to prevent race condition
      const detail = await stockTransfersRepository.lockAndFindById(client, id, branchIds)
      if (!detail) throw new StockTransferNotFoundError(id)
      if (detail.transfer_type !== 'LOAN') {
        throw new StockTransferInvalidStatusError(detail.transfer_type, 'LOAN')
      }
      if (detail.status !== 'CONFIRMED') {
        throw new StockTransferInvalidStatusError(detail.status, 'CONFIRMED')
      }

      for (const line of detail.lines) {
        const qty = Number(line.qty)
        const costPerUnit = Number(line.cost_per_unit)

        // OUT from target (borrower returns)
        const targetBalance = await stockRepository.getBalanceForUpdate(
          client, detail.target_warehouse_id, line.product_id
        )
        const targetQty = targetBalance ? Number(targetBalance.qty) : 0
        if (targetQty < qty) {
          throw new StockTransferInsufficientStockError(line.product_name, targetQty, qty)
        }
        const targetAvgCost = targetBalance ? Number(targetBalance.avg_cost) : 0
        const newTargetQty = targetQty - qty

        const returnOutMovement = await stockRepository.createMovement(
          client,
          {
            warehouse_id: detail.target_warehouse_id,
            product_id: line.product_id,
            movement_type: 'OUT_TRANSFER',
            qty,
            cost_per_unit: targetAvgCost,
            reference_type: 'branch_loan',
            reference_id: id,
            notes: `Return ${detail.transfer_number} → ${detail.source_warehouse_name}`,
            created_by: dto.returned_by,
          },
          newTargetQty
        )
        await stockRepository.upsertBalance(client, detail.target_warehouse_id, line.product_id, newTargetQty, targetAvgCost)

        // IN to source (lender receives back)
        const sourceBalance = await stockRepository.getBalanceForUpdate(
          client, detail.source_warehouse_id, line.product_id
        )
        const sourceQty = sourceBalance ? Number(sourceBalance.qty) : 0
        const sourceAvgCost = sourceBalance ? Number(sourceBalance.avg_cost) : 0
        const newSourceQty = sourceQty + qty

        const newSourceAvgCost = newSourceQty > 0
          ? (sourceQty * sourceAvgCost + qty * costPerUnit) / newSourceQty
          : costPerUnit

        const returnInMovement = await stockRepository.createMovement(
          client,
          {
            warehouse_id: detail.source_warehouse_id,
            product_id: line.product_id,
            movement_type: 'IN_TRANSFER',
            qty,
            cost_per_unit: costPerUnit,
            reference_type: 'branch_loan',
            reference_id: id,
            notes: `Return ${detail.transfer_number} ← ${detail.target_warehouse_name}`,
            created_by: dto.returned_by,
          },
          newSourceQty
        )
        await stockRepository.upsertBalance(client, detail.source_warehouse_id, line.product_id, newSourceQty, newSourceAvgCost)

        await stockTransfersRepository.updateReturnMovementRefs(client, line.id, returnOutMovement.id, returnInMovement.id)
      }

      await stockTransfersRepository.returnLoan(client, id, dto.returned_by)

      // Generate reversal journals for inter-branch loan return
      if (detail.source_branch_id !== detail.target_branch_id && detail.source_journal_id && detail.target_journal_id) {
        await this.generateReturnJournals(client, detail, dto.returned_by, dto.return_date)
      }
    })

    await AuditService.log('UPDATE', 'stock_transfer', id, dto.returned_by, { status: 'CONFIRMED' }, { status: 'RETURNED' })
    return this.getById(id, branchIds)
  }

  // ─── CANCEL ───────────────────────────────────────────────────────────────────

  async cancel(id: string, branchIds: string[], dto: CancelStockTransferDto): Promise<StockTransferDetail> {
    const detail = await this.getById(id, branchIds)
    if (detail.status !== 'DRAFT') {
      throw new StockTransferInvalidStatusError(detail.status, 'DRAFT')
    }

    await stockTransfersRepository.cancelTransferDirect(id, dto.cancelled_by, dto.cancel_reason)

    await AuditService.log('UPDATE', 'stock_transfer', id, dto.cancelled_by, { status: 'DRAFT' }, { status: 'CANCELLED' })
    return this.getById(id, branchIds)
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────────

  async softDelete(id: string, branchIds: string[], userId: string): Promise<void> {
    const detail = await this.getById(id, branchIds)
    if (detail.status !== 'DRAFT' && detail.status !== 'CANCELLED') {
      throw new StockTransferInvalidStatusError(detail.status, 'DRAFT atau CANCELLED')
    }
    await stockTransfersRepository.softDelete(id, userId)
    await AuditService.log('DELETE', 'stock_transfer', id, userId)
  }

  // ─── DELETE JOURNALS (release-only) ─────────────────────────────────────────

  async deleteJournals(id: string, branchIds: string[], userId: string): Promise<StockTransferDetail> {
    const detail = await this.getById(id, branchIds)
    if (!detail.source_journal_id && !detail.target_journal_id) {
      throw new BusinessRuleError('Transfer ini tidak memiliki jurnal')
    }
    if (detail.status !== 'CONFIRMED' && detail.status !== 'CANCELLED' && detail.status !== 'RETURNED') {
      throw new StockTransferInvalidStatusError(detail.status, 'CONFIRMED, CANCELLED, atau RETURNED')
    }

    await stockRepository.withTransaction(async (client) => {
      const journalIds = [detail.source_journal_id, detail.target_journal_id].filter(Boolean) as string[]
      await stockTransfersRepository.deleteJournals(client, journalIds)
      await stockTransfersRepository.clearJournalIds(client, id)
    })

    await AuditService.log('DELETE', 'stock_transfer_journal', id, userId, undefined, {
      source_journal_id: detail.source_journal_id,
      target_journal_id: detail.target_journal_id,
    })
    return this.getById(id, branchIds)
  }

  // ─── JOURNAL GENERATION (private) ──────────────────────────────────────────

  private async generateTransferJournals(
    client: import('pg').PoolClient,
    detail: StockTransferDetail,
    userId: string,
  ): Promise<void> {
    const companyId = detail.company_id

    // Find open fiscal period
    const fiscalPeriod = await stockTransfersRepository.findOpenFiscalPeriod(companyId, detail.transfer_date, client)
    if (!fiscalPeriod) return // Skip journal if no open period (don't block transfer)

    // Resolve COA accounts for inter-branch transfer
    // Source: DR 110598 (Persediaan Dalam Perjalanan), CR 110502 (Barang Dalam Proses) or 110501 (Bahan Baku)
    // Target: DR 110505 (Persediaan Cabang), CR 110598 (Persediaan Dalam Perjalanan)
    const persediaanTransit = await stockTransfersRepository.findCoaByCode(companyId, '110598', client)
    const persediaanCabang = await stockTransfersRepository.findCoaByCode(companyId, '110505', client)
    const barangDalamProses = await stockTransfersRepository.findCoaByCode(companyId, '110502', client)
    const bahanBaku = await stockTransfersRepository.findCoaByCode(companyId, '110501', client)
    if (!persediaanTransit || !persediaanCabang) return // Skip if COA not configured

    // Determine source credit COA based on source warehouse type
    // If from Finished Goods/WIP warehouse → credit 110502 (Barang Dalam Proses)
    // Otherwise → credit 110501 (Bahan Baku)
    const sourceCreditCoa = barangDalamProses || bahanBaku
    if (!sourceCreditCoa) return

    // Calculate total transfer value
    const totalValue = detail.lines.reduce((sum, line) => sum + Number(line.qty) * Number(line.cost_per_unit), 0)
    if (totalValue <= 0) return

    const period = fiscalPeriod.period

    // Journal 1 — Source branch (pengirim): DR Transit, CR WIP/Bahan Baku
    const seq1 = await stockTransfersRepository.getNextJournalSequence(client, companyId, period)
    const journalNumber1 = `JI-${period}-${String(seq1).padStart(4, '0')}`

    const sourceJournalId = await stockTransfersRepository.insertJournalHeader(client, {
      companyId,
      branchId: detail.source_branch_id,
      journalNumber: journalNumber1,
      sequenceNumber: seq1,
      journalDate: detail.transfer_date,
      period,
      description: `Transfer keluar ${detail.transfer_number} → ${detail.target_branch_name}`,
      totalAmount: totalValue,
      referenceId: detail.id,
      referenceNumber: detail.transfer_number,
      createdBy: userId,
    })

    await stockTransfersRepository.insertJournalLine(client, {
      journalHeaderId: sourceJournalId,
      lineNumber: 1,
      accountId: persediaanTransit.id,
      description: `Transfer keluar - ${detail.transfer_number}`,
      debitAmount: totalValue,
      creditAmount: 0,
    })
    await stockTransfersRepository.insertJournalLine(client, {
      journalHeaderId: sourceJournalId,
      lineNumber: 2,
      accountId: sourceCreditCoa.id,
      description: `Transfer keluar - ${detail.transfer_number}`,
      debitAmount: 0,
      creditAmount: totalValue,
    })

    // Journal 2 — Target branch (penerima): DR Persediaan Cabang, CR Transit
    const seq2 = await stockTransfersRepository.getNextJournalSequence(client, companyId, period)
    const journalNumber2 = `JI-${period}-${String(seq2).padStart(4, '0')}`

    const targetJournalId = await stockTransfersRepository.insertJournalHeader(client, {
      companyId,
      branchId: detail.target_branch_id,
      journalNumber: journalNumber2,
      sequenceNumber: seq2,
      journalDate: detail.transfer_date,
      period,
      description: `Transfer masuk ${detail.transfer_number} ← ${detail.source_branch_name}`,
      totalAmount: totalValue,
      referenceId: detail.id,
      referenceNumber: detail.transfer_number,
      createdBy: userId,
    })

    await stockTransfersRepository.insertJournalLine(client, {
      journalHeaderId: targetJournalId,
      lineNumber: 1,
      accountId: persediaanCabang.id,
      description: `Transfer masuk - ${detail.transfer_number}`,
      debitAmount: totalValue,
      creditAmount: 0,
    })
    await stockTransfersRepository.insertJournalLine(client, {
      journalHeaderId: targetJournalId,
      lineNumber: 2,
      accountId: persediaanTransit.id,
      description: `Transfer masuk - ${detail.transfer_number}`,
      debitAmount: 0,
      creditAmount: totalValue,
    })

    // Save journal references
    await stockTransfersRepository.saveJournalIds(client, detail.id, sourceJournalId, targetJournalId)
  }

  /**
   * Generate reversal journals for loan return.
   * Entries are reversed: source gets DR Bahan Baku / CR Transit, target gets DR Transit / CR Bahan Baku.
   */
  private async generateReturnJournals(
    client: import('pg').PoolClient,
    detail: StockTransferDetail,
    userId: string,
    returnDate: string,
  ): Promise<void> {
    const companyId = detail.company_id

    const fiscalPeriod = await stockTransfersRepository.findOpenFiscalPeriod(companyId, returnDate, client)
    if (!fiscalPeriod) return

    const bahanBaku = await stockTransfersRepository.findCoaByCode(companyId, '110501', client)
    const persediaanTransit = await stockTransfersRepository.findCoaByCode(companyId, '110598', client)
    if (!bahanBaku || !persediaanTransit) return

    const totalValue = detail.lines.reduce((sum, line) => sum + Number(line.qty) * Number(line.cost_per_unit), 0)
    if (totalValue <= 0) return

    const period = fiscalPeriod.period

    // Reversal Journal 1 — Source branch (pemberi terima kembali): DR Bahan Baku, CR Transit
    const seq1 = await stockTransfersRepository.getNextJournalSequence(client, companyId, period)
    const journalNumber1 = `JI-${period}-${String(seq1).padStart(4, '0')}`

    const reversalSourceId = await stockTransfersRepository.insertJournalHeader(client, {
      companyId,
      branchId: detail.source_branch_id,
      journalNumber: journalNumber1,
      sequenceNumber: seq1,
      journalDate: returnDate,
      period,
      description: `[RETURN] Pinjaman kembali ${detail.transfer_number} ← ${detail.target_branch_name}`,
      totalAmount: totalValue,
      referenceId: detail.id,
      referenceNumber: detail.transfer_number,
      createdBy: userId,
    })

    await stockTransfersRepository.insertJournalLine(client, {
      journalHeaderId: reversalSourceId,
      lineNumber: 1,
      accountId: bahanBaku.id,
      description: `[RETURN] Pinjaman kembali - ${detail.transfer_number}`,
      debitAmount: totalValue,
      creditAmount: 0,
    })
    await stockTransfersRepository.insertJournalLine(client, {
      journalHeaderId: reversalSourceId,
      lineNumber: 2,
      accountId: persediaanTransit.id,
      description: `[RETURN] Pinjaman kembali - ${detail.transfer_number}`,
      debitAmount: 0,
      creditAmount: totalValue,
    })

    // Reversal Journal 2 — Target branch (peminjam kembalikan): DR Transit, CR Bahan Baku
    const seq2 = await stockTransfersRepository.getNextJournalSequence(client, companyId, period)
    const journalNumber2 = `JI-${period}-${String(seq2).padStart(4, '0')}`

    const reversalTargetId = await stockTransfersRepository.insertJournalHeader(client, {
      companyId,
      branchId: detail.target_branch_id,
      journalNumber: journalNumber2,
      sequenceNumber: seq2,
      journalDate: returnDate,
      period,
      description: `[RETURN] Pinjaman dikembalikan ${detail.transfer_number} → ${detail.source_branch_name}`,
      totalAmount: totalValue,
      referenceId: detail.id,
      referenceNumber: detail.transfer_number,
      createdBy: userId,
    })

    await stockTransfersRepository.insertJournalLine(client, {
      journalHeaderId: reversalTargetId,
      lineNumber: 1,
      accountId: persediaanTransit.id,
      description: `[RETURN] Pinjaman dikembalikan - ${detail.transfer_number}`,
      debitAmount: totalValue,
      creditAmount: 0,
    })
    await stockTransfersRepository.insertJournalLine(client, {
      journalHeaderId: reversalTargetId,
      lineNumber: 2,
      accountId: bahanBaku.id,
      description: `[RETURN] Pinjaman dikembalikan - ${detail.transfer_number}`,
      debitAmount: 0,
      creditAmount: totalValue,
    })
  }
}

export const stockTransfersService = new StockTransfersService()
