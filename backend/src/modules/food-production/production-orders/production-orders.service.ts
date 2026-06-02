import type { PoolClient } from 'pg'
import { BusinessRuleError } from '../../../utils/errors.base'
import { getCompanyIdForBranch, requireBranchAccess, requireCompanyAccess } from '../../../utils/branch-access.util'
import { AuditService } from '../../monitoring/monitoring.service'
import { productionOrdersRepository } from './production-orders.repository'
import { WipRepository } from '../wip/wip.repository'
import { filterAccessibleWipIds } from '../wip/wip-access.util'
import { warehousesRepository } from '../../warehouses/warehouses.repository'
import {
  ProductionOrderNotFoundError, ProductionOrderNotDraftError,
  ProductionOrderNotCompletedError, ProductionOrderNotVoidableError,
  WasteExceedsActualError, FiscalPeriodClosedError, COANotFoundError,
  OrderNumberCollisionError, ProductionOrderWipNotFoundError
} from './production-orders.errors'
import type {
  ProductionOrder, ProductionOrderWithDetails,
  CreateProductionOrderDto, CompleteProductionOrderDto, VoidProductionOrderDto,
  MaterialUsageSummary, DailySummary, ProductionOrderWithBranch
} from './production-orders.types'

const wipRepository = new WipRepository()

class ProductionOrdersService {

  async list(companyIds: string[], pagination: { page: number; limit: number }, filter?: {
    branch_id?: string; status?: string; date_from?: string; date_to?: string
  }): Promise<{ data: ProductionOrderWithBranch[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit
    return productionOrdersRepository.findAll(companyIds, { limit: pagination.limit, offset }, filter)
  }

  async getById(id: string, companyIds: string[]): Promise<ProductionOrderWithDetails> {
    const order = await productionOrdersRepository.findByIdAccessible(id, companyIds)
    if (!order) throw new ProductionOrderNotFoundError(id)
    return order
  }

  async create(dto: CreateProductionOrderDto, accessibleCompanyIds: string[]): Promise<ProductionOrderWithDetails> {
    if (!dto.created_by) {
      throw new BusinessRuleError('User tidak teridentifikasi')
    }

    const companyId = await getCompanyIdForBranch(dto.branch_id)
    if (!companyId) {
      throw new BusinessRuleError('Cabang tidak ditemukan')
    }
    requireCompanyAccess(companyId, accessibleCompanyIds)
    const resolvedDto = { ...dto, company_id: companyId }

    const hasAccess = await productionOrdersRepository.userHasBranchAccess(resolvedDto.created_by!, resolvedDto.branch_id)
    if (!hasAccess) {
      throw new BusinessRuleError('Anda tidak memiliki akses ke cabang ini')
    }

    const requestedWipIds = resolvedDto.lines.map(l => l.wip_id)
    const allowedWipIds = await filterAccessibleWipIds(resolvedDto.created_by!, requestedWipIds)
    const blockedWips = requestedWipIds.filter(id => !allowedWipIds.includes(id))
    if (blockedWips.length > 0) {
      throw new BusinessRuleError('Anda tidak memiliki akses posisi untuk memproduksi beberapa WIP yang dipilih')
    }

    const orderId = await productionOrdersRepository.withTransaction(async (client) => {
      const orderNumber = await this.generateOrderNumber(client, resolvedDto.company_id, resolvedDto.branch_id, resolvedDto.production_date)

      const header = await productionOrdersRepository.insertHeader(client, {
        company_id: resolvedDto.company_id,
        branch_id: resolvedDto.branch_id,
        order_number: orderNumber,
        production_date: resolvedDto.production_date,
        notes: resolvedDto.notes,
        created_by: resolvedDto.created_by,
      })

      for (let i = 0; i < resolvedDto.lines.length; i++) {
        const lineDto = resolvedDto.lines[i]
        const wip = await wipRepository.findByIdWithIngredientsAccessible(lineDto.wip_id, accessibleCompanyIds)
        if (!wip) throw new ProductionOrderWipNotFoundError()
        if (wip.company_id !== resolvedDto.company_id) {
          throw new BusinessRuleError(`WIP ${wip.wip_code} tidak termasuk company cabang yang dipilih`)
        }

        const line = await productionOrdersRepository.insertLine(client, {
          production_order_id: header.id,
          wip_id: wip.id,
          wip_name: wip.wip_name,
          wip_code: wip.wip_code,
          yield_per_batch: wip.yield_qty,
          uom: wip.uom,
          cost_per_batch: wip.estimated_cost,
          planned_batch_qty: lineDto.planned_batch_qty,
          sort_order: i,
        })

        for (let j = 0; j < (wip.ingredients?.length || 0); j++) {
          const ingredient = wip.ingredients[j]

          const costPerUnit = ingredient.cost_per_unit > 0
            ? ingredient.cost_per_unit
            : 0
          const costSource = ingredient.cost_per_unit > 0
            ? 'wip_ingredient'
            : 'average_cost'

          let finalCost = costPerUnit
          if (finalCost === 0) {
            finalCost = await productionOrdersRepository.findProductAverageCost(client, ingredient.product_id)
          }

          await productionOrdersRepository.insertMaterial(client, {
            production_order_id: header.id,
            production_line_id: line.id,
            product_id: ingredient.product_id,
            product_name: ingredient.product_name || '',
            product_code: ingredient.product_code || '',
            planned_qty: ingredient.qty * lineDto.planned_batch_qty,
            uom: ingredient.uom,
            cost_per_unit: finalCost,
            cost_source: costSource,
            sort_order: j,
          })
        }
      }

      return header.id
    })

    const order = await productionOrdersRepository.findById(orderId, resolvedDto.company_id)
    if (!order) throw new ProductionOrderNotFoundError(orderId)

    await AuditService.log('CREATE', 'production_order', order.id, resolvedDto.created_by || '', undefined, order)
    return order
  }

  private async createStockMovementsForOrder(
    orderId: string,
    client: PoolClient,
    order: ProductionOrderWithDetails,
    userId: string
  ): Promise<void> {
    // ── 1. Load lines dengan wip output config ──────────────────────────────
    const lines = await productionOrdersRepository.getProductionLinesWithWip(client, orderId)
    if (lines.length === 0) return

    // ── 2. Tentukan source warehouse per line ───────────────────────────────
    const sourceTypeMap: Record<string, 'MAIN' | 'READY'> = {}
    for (const line of lines) {
      sourceTypeMap[line.line_id] = line.output_warehouse === 'FINISHED_GOODS' ? 'MAIN' : 'READY'
    }

    // Cache warehouse id lookup
    const warehouseCache = new Map<string, string>()
    const getWarehouseId = async (type: string): Promise<string> => {
      if (warehouseCache.has(type)) return warehouseCache.get(type)!
      const warehouseId = await warehousesRepository.findByBranchAndType(order.branch_id, type)
      if (!warehouseId) throw new BusinessRuleError(`Gudang tipe '${type}' tidak ditemukan untuk cabang ini`)
      warehouseCache.set(type, warehouseId)
      return warehouseId
    }

    // Validasi semua warehouse yang dibutuhkan ada
    const neededTypes = new Set([...Object.values(sourceTypeMap), ...lines.map(l => l.output_warehouse)])
    for (const type of neededTypes) {
      await getWarehouseId(type)
    }

    // ── 3. Load materials per line ──────────────────────────────────────────
    const materials = await productionOrdersRepository.getProductionMaterials(client, orderId)
    const materialsByLine = new Map<string, typeof materials>()
    for (const mat of materials) {
      const arr = materialsByLine.get(mat.production_line_id) ?? []
      arr.push(mat)
      materialsByLine.set(mat.production_line_id, arr)
    }

    // ── 4. Process per line ─────────────────────────────────────────────────
    for (const line of lines) {
      const sourceWarehouseId = await getWarehouseId(sourceTypeMap[line.line_id])
      const outputWarehouseId = await getWarehouseId(line.output_warehouse)
      const lineMaterials = materialsByLine.get(line.line_id) ?? []

      // ── 4a. OUT_PRODUCTION: potong bahan baku dari source warehouse ─────
      for (const mat of lineMaterials) {
        const balance = await productionOrdersRepository.getStockBalance(client, sourceWarehouseId, mat.product_id)

        // Validasi stok cukup
        if (balance.qty < Number(mat.actual_qty)) {
          throw new BusinessRuleError(
            `Stok tidak cukup untuk ${mat.product_name}. Tersedia: ${balance.qty}, Dibutuhkan: ${mat.actual_qty}`
          )
        }

        const newQty = balance.qty - Number(mat.actual_qty)
        const unitCost = Number(mat.actual_qty) > 0 ? Number(mat.total_cost) / Number(mat.actual_qty) : balance.avg_cost

        // Insert OUT_PRODUCTION movement
        const outMovId = await productionOrdersRepository.insertStockMovement(client, {
          warehouse_id: sourceWarehouseId,
          product_id: mat.product_id,
          movement_type: 'OUT_PRODUCTION',
          qty: -Number(mat.actual_qty),
          cost_per_unit: unitCost,
          total_cost: -Number(mat.total_cost),
          balance_after: newQty,
          reference_type: 'production_order',
          reference_id: orderId,
          movement_date: order.production_date,
          notes: `Produksi ${order.order_number} - ${mat.product_name}`,
          created_by: userId,
        })

        // Update reference di materials (only track OUT movement)
        await productionOrdersRepository.updateMaterialStockMovementRef(client, mat.id, outMovId)

        // Upsert stock balance source (pertahankan avg_cost saat stok habis untuk perhitungan berikutnya)
        await productionOrdersRepository.upsertStockBalance(client, sourceWarehouseId, mat.product_id, newQty, balance.avg_cost)
      }

      // ── 4b. IN_PRODUCTION: masukkan hasil ke output warehouse ───────────
      if (!line.output_product_id) continue

      const totalYieldQty = Number(line.actual_batch_qty) * Number(line.yield_per_batch)
      if (totalYieldQty <= 0) continue

      const lineTotalCost = lineMaterials.reduce((sum: number, m) => sum + Number(m.total_cost), 0)
      const yieldAvgCost = totalYieldQty > 0 ? lineTotalCost / totalYieldQty : 0

      const outBalance = await productionOrdersRepository.getStockBalance(client, outputWarehouseId, line.output_product_id)

      // Weighted average cost
      const newOutQty = outBalance.qty + totalYieldQty
      const newOutAvgCost = newOutQty > 0 ? (outBalance.qty * outBalance.avg_cost + lineTotalCost) / newOutQty : yieldAvgCost

      // Insert IN_PRODUCTION movement
      const inMovId = await productionOrdersRepository.insertStockMovement(client, {
        warehouse_id: outputWarehouseId,
        product_id: line.output_product_id,
        movement_type: 'IN_PRODUCTION',
        qty: totalYieldQty,
        cost_per_unit: yieldAvgCost,
        total_cost: lineTotalCost,
        balance_after: newOutQty,
        reference_type: 'production_order',
        reference_id: orderId,
        movement_date: order.production_date,
        notes: `Hasil produksi ${order.order_number} - ${line.wip_name}`,
        created_by: userId,
      })

      // Update reference di line
      await productionOrdersRepository.updateLineStockMovementRef(client, line.line_id, inMovId, 'in')

      // Upsert stock balance output warehouse
      await productionOrdersRepository.upsertStockBalance(client, outputWarehouseId, line.output_product_id, newOutQty, newOutAvgCost)
    }
  }

  async complete(id: string, companyIds: string[], branchIds: string[], dto: CompleteProductionOrderDto): Promise<void> {
    const order = await this.getOrderForMutation(id, companyIds, branchIds)
    if (order.status !== 'DRAFT') throw new ProductionOrderNotDraftError()

    const totals = await productionOrdersRepository.withTransaction(async (client) => {
      let totalMaterialCost = 0
      let totalWasteCost = 0

      for (const lineDto of dto.lines) {
        const line = await productionOrdersRepository.getLine(lineDto.id, id)
        if (!line) continue

        const totalYield = lineDto.actual_batch_qty * line.yield_per_batch
        const totalLineCost = lineDto.actual_batch_qty * line.cost_per_batch

        await productionOrdersRepository.updateLine(client, line.id, {
          actual_batch_qty: lineDto.actual_batch_qty,
          total_yield: totalYield,
          total_cost: totalLineCost,
        })

        for (const matDto of lineDto.materials) {
          const mat = await productionOrdersRepository.getMaterial(matDto.id, id)
          if (!mat) continue

          const wasteQty = matDto.waste_qty ?? 0
          if (wasteQty > matDto.actual_qty) {
            throw new WasteExceedsActualError(mat.product_name)
          }

          const totalCost = matDto.actual_qty * mat.cost_per_unit
          const wasteCost = wasteQty * mat.cost_per_unit

          await productionOrdersRepository.updateMaterial(client, mat.id, {
            actual_qty: matDto.actual_qty,
            waste_qty: wasteQty,
            waste_reason: matDto.waste_reason ?? null,
            total_cost: totalCost,
          })

          totalMaterialCost += totalCost
          totalWasteCost += wasteCost
        }
      }

      // Create stock movements for materials deducted
      await this.createStockMovementsForOrder(id, client, order, dto.user_id)

      await productionOrdersRepository.updateHeaderStatus(client, id, {
        status: 'COMPLETED',
        total_material_cost: totalMaterialCost,
        total_waste_cost: totalWasteCost,
        completed_by: dto.user_id,
        completed_at: new Date(),
        updated_by: dto.user_id,
      })

      return { totalMaterialCost, totalWasteCost }
    })

    await AuditService.log('UPDATE', 'production_order', id, dto.user_id, { status: 'DRAFT' }, { status: 'COMPLETED', ...totals })
  }

  async generateJournal(id: string, companyIds: string[], branchIds: string[], userId: string): Promise<{ journal_id: string }> {
    const order = await this.getOrderForMutation(id, companyIds, branchIds)
    if (order.status !== 'COMPLETED') throw new ProductionOrderNotCompletedError()

    const companyId = order.company_id
    const fiscalPeriod = await productionOrdersRepository.findOpenFiscalPeriod(companyId, order.production_date)
    if (!fiscalPeriod) throw new FiscalPeriodClosedError()

    const resolveCoa = async (code: string) => {
      const account = await productionOrdersRepository.findCoaByCode(companyId, code)
      if (!account) throw new COANotFoundError(code)
      return account
    }

    const bahanBaku = await resolveCoa('110501')
    const barangDalamProses = await resolveCoa('110502')
    const selisihHPP = await resolveCoa('510301')

    const journalId = await productionOrdersRepository.withTransaction(async (client) => {
      const period = fiscalPeriod.period
      const seq = await productionOrdersRepository.getNextJournalSequence(client, companyId, period)
      const journalNumber = `JG-${period}-${String(seq).padStart(4, '0')}`

      const totalDebit = order.total_material_cost
      const productionCost = order.total_material_cost - order.total_waste_cost

      const headerId = await productionOrdersRepository.insertProductionJournalHeader(client, {
        companyId,
        branchId: order.branch_id,
        journalNumber,
        sequenceNumber: seq,
        journalDate: order.production_date,
        period,
        description: `Produksi ${order.production_date} - ${order.branch_name}`,
        totalAmount: totalDebit,
        referenceId: order.id,
        referenceNumber: order.order_number,
        createdBy: userId,
      })

      let lineNum = 1

      if (productionCost > 0) {
        await productionOrdersRepository.insertJournalLine(client, {
          journalHeaderId: headerId,
          lineNumber: lineNum++,
          accountId: barangDalamProses.id,
          description: 'Produksi - Barang Dalam Proses',
          debitAmount: productionCost,
          creditAmount: 0,
        })
      }

      if (order.total_waste_cost > 0) {
        await productionOrdersRepository.insertJournalLine(client, {
          journalHeaderId: headerId,
          lineNumber: lineNum++,
          accountId: selisihHPP.id,
          description: 'Produksi - Selisih HPP (Waste)',
          debitAmount: order.total_waste_cost,
          creditAmount: 0,
        })
      }

      await productionOrdersRepository.insertJournalLine(client, {
        journalHeaderId: headerId,
        lineNumber: lineNum,
        accountId: bahanBaku.id,
        description: 'Produksi - Pemakaian Bahan Baku',
        debitAmount: 0,
        creditAmount: totalDebit,
      })

      await productionOrdersRepository.updateHeaderStatus(client, id, {
        status: 'JOURNALED',
        journal_id: headerId,
        updated_by: userId,
      })

      return headerId
    })

    await AuditService.log('UPDATE', 'production_order', id, userId, { status: 'COMPLETED' }, { status: 'JOURNALED', journal_id: journalId })
    return { journal_id: journalId }
  }

  async voidOrder(id: string, companyIds: string[], branchIds: string[], dto: VoidProductionOrderDto): Promise<void> {
    const order = await this.getOrderForMutation(id, companyIds, branchIds)
    if (order.status === 'VOID') throw new ProductionOrderNotVoidableError()

    const companyId = order.company_id
    await productionOrdersRepository.withTransaction(async (client) => {
      if (order.status === 'JOURNALED' && order.journal_id) {
        const lines = await productionOrdersRepository.findJournalLinesByHeaderId(client, order.journal_id)
        const period = (await productionOrdersRepository.findJournalPeriod(client, order.journal_id)) || ''
        const seq = await productionOrdersRepository.getNextJournalSequence(client, companyId, period)
        const reversalNumber = `JG-${period}-${String(seq).padStart(4, '0')}`
        const totalAmount = order.total_material_cost

        const reversalId = await productionOrdersRepository.insertReversalJournalHeader(client, {
          companyId,
          branchId: order.branch_id,
          journalNumber: reversalNumber,
          sequenceNumber: seq,
          journalDate: order.production_date,
          period,
          description: `[REVERSAL] Produksi ${order.production_date} - ${order.branch_name}`,
          totalAmount,
          referenceId: order.id,
          referenceNumber: order.order_number,
          createdBy: dto.user_id,
          reversalOfJournalId: order.journal_id,
        })

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          await productionOrdersRepository.insertJournalLine(client, {
            journalHeaderId: reversalId,
            lineNumber: i + 1,
            accountId: line.account_id,
            description: `[REVERSAL] ${line.description}`,
            debitAmount: line.credit_amount,
            creditAmount: line.debit_amount,
          })
        }

        await productionOrdersRepository.markJournalAsReversed(client, reversalId, dto.reason, order.journal_id)
      }

      await productionOrdersRepository.updateHeaderStatus(client, id, {
        status: 'VOID',
        voided_by: dto.user_id,
        voided_at: new Date(),
        void_reason: dto.reason,
        updated_by: dto.user_id,
      })
    })

    await AuditService.log('UPDATE', 'production_order', id, dto.user_id, { status: order.status }, { status: 'VOID', reason: dto.reason })
  }

  async delete(id: string, companyIds: string[], branchIds: string[], userId: string): Promise<void> {
    const order = await this.getOrderForMutation(id, companyIds, branchIds)
    const deleted = await productionOrdersRepository.softDelete(id, order.company_id, userId)
    if (!deleted) throw new ProductionOrderNotFoundError(id)
    await AuditService.log('DELETE', 'production_order', id, userId)
  }

  private async getOrderForMutation(
    id: string,
    companyIds: string[],
    branchIds: string[],
  ): Promise<ProductionOrderWithDetails> {
    const order = await productionOrdersRepository.findByIdAccessible(id, companyIds)
    if (!order) throw new ProductionOrderNotFoundError(id)
    requireBranchAccess(order.branch_id, branchIds)
    return order
  }

  async getSummary(companyIds: string[], dateFrom: string, dateTo: string, branchId?: string): Promise<DailySummary[]> {
    return productionOrdersRepository.getDailySummary(companyIds, dateFrom, dateTo, branchId)
  }

  async getMaterialsReport(companyIds: string[], dateFrom: string, dateTo: string, branchId?: string): Promise<MaterialUsageSummary[]> {
    return productionOrdersRepository.getMaterialsReport(companyIds, dateFrom, dateTo, branchId)
  }

  private async generateOrderNumber(
    client: PoolClient,
    companyId: string,
    branchId: string,
    date: string,
  ): Promise<string> {
    const branchCode = (await productionOrdersRepository.findBranchCode(client, branchId)) || 'XXX'
    const dateStr = date.replace(/-/g, '')
    const prefix = `PRD-${branchCode}-${dateStr}`

    for (let attempt = 0; attempt < 3; attempt++) {
      const last = await productionOrdersRepository.getLastOrderNumber(companyId, prefix)
      const lastSeq = last ? parseInt(last.split('-').pop() || '0') : 0
      const nextSeq = lastSeq + 1 + attempt
      const orderNumber = `${prefix}-${String(nextSeq).padStart(3, '0')}`

      const exists = await productionOrdersRepository.productionOrderNumberExists(client, companyId, orderNumber)
      if (!exists) return orderNumber
    }

    throw new OrderNumberCollisionError()
  }
}

export const productionOrdersService = new ProductionOrdersService()
