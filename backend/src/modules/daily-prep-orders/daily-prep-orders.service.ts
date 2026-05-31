import { dailyPrepOrdersRepository } from './daily-prep-orders.repository'
import { stockRepository } from '../stock/stock.repository'
import {
  DpoNotFoundError, DpoInvalidStatusError, DpoLockConflictError,
  DpoLockExpiredError, DpoNoLinesError, DpoForecastConfigNotFoundError,
  DpoInsufficientMainStockError
} from './daily-prep-orders.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { dailyStockOpnameRepository } from '../daily-stock-opname/daily-stock-opname.repository'
import { DpoBlockedByOpnameError } from '../daily-stock-opname/daily-stock-opname.errors'
import type {
  GenerateDpoDto, UpdateDpoLinesDto, ConfirmDpoDto,
  UpsertForecastConfigDto, UpsertHolidayDto
} from './daily-prep-orders.types'

// Resolve branch_pos_id dari branch UUID via repository
async function resolveBranchPosId(branchUuid: string): Promise<number> {
  const posId = await dailyPrepOrdersRepository.resolveBranchPosId(branchUuid)
  if (posId === null) {
    throw new DpoForecastConfigNotFoundError(
      `Tidak dapat menemukan POS branch ID untuk branch ${branchUuid}. ` +
      `Pastikan branch sudah pernah sync POS data atau mapping nama branch sudah benar.`
    )
  }
  return posId
}

export class DailyPrepOrdersService {

  // ─── FORECAST CONFIG ────────────────────────────────────────────────────────

  async getForecastConfig(companyId: string, branchId: string) {
    return dailyPrepOrdersRepository.findForecastConfig(companyId, branchId)
  }

  async upsertForecastConfig(companyId: string, dto: UpsertForecastConfigDto, userId: string) {
    const sum = dto.weight_7d + dto.weight_30d + dto.weight_dow
    if (Math.abs(sum - 1.0) > 0.001) {
      throw new Error(`Total bobot harus = 1.0, sekarang = ${sum.toFixed(3)}`)
    }
    return dailyPrepOrdersRepository.upsertForecastConfig(companyId, dto, userId)
  }

  // ─── PUBLIC HOLIDAYS ────────────────────────────────────────────────────────

  async getHolidays(companyId: string, from: string, to: string) {
    return dailyPrepOrdersRepository.findHolidays(companyId, from, to)
  }

  async upsertHoliday(companyId: string, dto: UpsertHolidayDto, userId: string) {
    return dailyPrepOrdersRepository.upsertHoliday(companyId, dto, userId)
  }

  async deleteHoliday(companyId: string, holidayId: string) {
    return dailyPrepOrdersRepository.deleteHoliday(companyId, holidayId)
  }

  // ─── LIST / GET ─────────────────────────────────────────────────────────────

  async list(
    branchIds: string[],
    pagination: { page: number; limit: number },
    filter?: { branch_id?: string; status?: string; date_from?: string; date_to?: string }
  ) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await dailyPrepOrdersRepository.findAll(
      branchIds, { limit: pagination.limit, offset }, filter
    )
    const totalPages = Math.ceil(total / pagination.limit)
    return {
      data,
      pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 }
    }
  }

  async getById(id: string, branchIds: string[]) {
    const dpo = await dailyPrepOrdersRepository.findDetailAccessible(id, branchIds)
    if (!dpo) throw new DpoNotFoundError(id)
    return dpo
  }

  // ─── GENERATE ───────────────────────────────────────────────────────────────

  async generate(branchIds: string[], dto: GenerateDpoDto) {
    const { requireBranchAccess, getCompanyIdForBranch } = await import('../../utils/branch-access.util')
    requireBranchAccess(dto.branch_id, branchIds)
    const companyId = (await getCompanyIdForBranch(dto.branch_id)) ?? ''
    // 1. Ambil forecast config
    const config = await dailyPrepOrdersRepository.findForecastConfig(companyId, dto.branch_id)
    if (!config) throw new DpoForecastConfigNotFoundError(dto.branch_id)

    // 2. Resolve branch POS ID
    const branchPosId = await resolveBranchPosId(dto.branch_id)

    // 3. Cek upcoming holiday
    const hasUpcomingHoliday = await dailyPrepOrdersRepository.hasUpcomingHoliday(
      companyId, dto.prep_date
    )
    const holidayFactor = hasUpcomingHoliday ? config.holiday_factor : 1.0

    // 4. Hitung forecast lines
    const rawLines = await dailyPrepOrdersRepository.calcForecastLines(
      branchPosId, dto.branch_id, dto.prep_date, config,
      dto.source_warehouse_id, dto.target_warehouse_id,
      dto.station_codes
    )

    // 5. Apply holiday factor ke predicted_need (semua dalam base unit)
    const forecastLines = rawLines.map(line => {
      const predictedNeedWithHoliday = line.predicted_need * holidayFactor
      const rawNeed = Math.max(0, predictedNeedWithHoliday - line.current_ready_stock)
      const packSize = line.transfer_conversion_factor > 0 ? line.transfer_conversion_factor : 1
      
      const suggestedQty = rawNeed > 0
        ? Math.ceil(rawNeed / packSize) * packSize
        : 0
    
      return {
        ...line,
        predicted_need: Math.round(predictedNeedWithHoliday * 10000) / 10000,
        suggested_qty: suggestedQty, // sudah bulat kelipatan pack, no decimal needed
      }
    })

    // 6. Filter: hanya produk yang suggested_qty > 0 ATAU ada di ready stock
    const relevantLines = forecastLines.filter(l => l.suggested_qty > 0 || l.current_ready_stock > 0)

    const newDpoId = await stockRepository.withTransaction(async (client) => {
      // 7. Cancel SEMUA existing DPO untuk branch+date yang sama (re-generate)
      await dailyPrepOrdersRepository.cancelAllForBranchDate(client, dto.branch_id, dto.prep_date)

      // 8. Ambil branch code untuk DPO number
      const branchCode = await dailyPrepOrdersRepository.getBranchCode(client, dto.branch_id)
      if (!branchCode) throw new Error(`Branch ${dto.branch_id} tidak ditemukan`)

      // 9. Generate DPO number
      const dpoNumber = await dailyPrepOrdersRepository.generateDpoNumber(
        client, companyId, branchCode, dto.prep_date
      )

      // 10. Create DPO + lines
      const dpo = await dailyPrepOrdersRepository.createWithLines(
        client, companyId, dto, dpoNumber,
        {
          weight_7d: config.weight_7d,
          weight_30d: config.weight_30d,
          weight_dow: config.weight_dow,
          coverage_days: config.coverage_days,
          holiday_factor_applied: holidayFactor,
          has_upcoming_holiday: hasUpcomingHoliday,
        },
        relevantLines,
        holidayFactor
      )

      await AuditService.log('CREATE', 'daily_prep_orders', dpo.id, dto.created_by ?? '', undefined, {
        dpo_number: dpoNumber, branch_id: dto.branch_id, prep_date: dto.prep_date,
        line_count: relevantLines.length
      })

      return dpo.id
    })

    // Fetch detail AFTER transaction commits — pool can now see the committed data
    return this.fetchDetailAfterGenerate(newDpoId, companyId)
  }

  // helper: fetch detail after transaction commits
  private async fetchDetailAfterGenerate(id: string, companyId: string) {
    const detail = await dailyPrepOrdersRepository.findDetail(id, companyId)
    if (!detail) throw new DpoNotFoundError(id)
    return detail
  }

  // ─── UPDATE LINES ───────────────────────────────────────────────────────────

  async updateLines(id: string, branchIds: string[], dto: UpdateDpoLinesDto) {
    const dpo = await dailyPrepOrdersRepository.findByIdAccessible(id, branchIds)
    if (!dpo) throw new DpoNotFoundError(id)
    if (dpo.status !== 'DRAFT') throw new DpoInvalidStatusError(dpo.status, 'DRAFT')

    await dailyPrepOrdersRepository.updateLines(id, dto)
    return dailyPrepOrdersRepository.findDetailAccessible(id, branchIds)
  }

  async deleteLine(id: string, branchIds: string[], lineId: string) {
    const dpo = await dailyPrepOrdersRepository.findByIdAccessible(id, branchIds)
    if (!dpo) throw new DpoNotFoundError(id)
    if (dpo.status !== 'DRAFT') throw new DpoInvalidStatusError(dpo.status, 'DRAFT')

    await dailyPrepOrdersRepository.deleteLine(id, lineId)
    return dailyPrepOrdersRepository.findDetailAccessible(id, branchIds)
  }

  // ─── ACQUIRE LOCK (panggil sebelum open confirm modal) ──────────────────────

  async acquireLock(id: string, branchIds: string[], userId: string) {
    const dpo = await dailyPrepOrdersRepository.findByIdAccessible(id, branchIds)
    if (!dpo) throw new DpoNotFoundError(id)
    if (dpo.status !== 'DRAFT') throw new DpoInvalidStatusError(dpo.status, 'DRAFT')

    const result = await stockRepository.withTransaction(async (client) => {
      return dailyPrepOrdersRepository.acquireLock(client, id, userId)
    })

    if (!result) throw new DpoLockConflictError()
    return result
  }

  // ─── CONFIRM ────────────────────────────────────────────────────────────────

  async confirm(id: string, branchIds: string[], dto: ConfirmDpoDto) {
    const detail = await dailyPrepOrdersRepository.findDetailAccessible(id, branchIds)
    if (!detail) throw new DpoNotFoundError(id)
    if (detail.status !== 'DRAFT') throw new DpoInvalidStatusError(detail.status, 'DRAFT')

    // Cek lock token
    if (detail.lock_token !== dto.lock_token) throw new DpoLockConflictError()
    if (detail.locked_at && new Date(detail.locked_at) < new Date(Date.now() - 5 * 60 * 1000)) {
      throw new DpoLockExpiredError()
    }

    // Cek apakah opname sudah dikonfirmasi untuk branch + tanggal ini
    const opnameExists = await dailyStockOpnameRepository.hasConfirmedSession(
      detail.branch_id,
      detail.prep_date
    )
    if (opnameExists) {
      throw new DpoBlockedByOpnameError()
    }

    // Filter lines yang confirmed_qty > 0
    const activeLines = detail.lines.filter(l => (l.confirmed_qty ?? 0) > 0)
    if (activeLines.length === 0) throw new DpoNoLinesError()

    return stockRepository.withTransaction(async (client) => {
      const stockMovementRefs: { lineId: string; outMovementId: string; inMovementId: string }[] = []

      for (const line of activeLines) {
        const qty = Number(line.confirmed_qty!)

        // Cek stok MAIN cukup
        const mainBalance = await stockRepository.getBalanceForUpdate(
          client, detail.source_warehouse_id, line.product_id
        )
        const mainQty = mainBalance ? Number(mainBalance.qty) : 0
        if (mainQty < qty) {
          throw new DpoInsufficientMainStockError(line.product_name, mainQty, qty)
        }

        const mainAvgCost = mainBalance ? Number(mainBalance.avg_cost) : 0

        // OUT dari MAIN
        const newMainQty = mainQty - qty
        const outMovement = await stockRepository.createMovement(
          client,
          {
            warehouse_id: detail.source_warehouse_id,
            product_id: line.product_id,
            movement_type: 'OUT_TRANSFER',
            qty: qty,
            cost_per_unit: mainAvgCost,
            reference_type: 'transfer_order',
            reference_id: id,
            notes: `DPO ${detail.dpo_number} → ${detail.target_warehouse_name}`,
            created_by: dto.confirmed_by,
          },
          newMainQty
        )
        await stockRepository.upsertBalance(
          client, detail.source_warehouse_id, line.product_id, newMainQty, mainAvgCost
        )

        // IN ke READY
        const readyBalance = await stockRepository.getBalanceForUpdate(
          client, detail.target_warehouse_id, line.product_id
        )
        const readyQty = readyBalance ? Number(readyBalance.qty) : 0
        const readyAvgCost = readyBalance ? Number(readyBalance.avg_cost) : 0
        const newReadyQty = readyQty + qty

        // Weighted average cost untuk ready
        const newReadyAvgCost = newReadyQty > 0
          ? (readyQty * readyAvgCost + qty * mainAvgCost) / newReadyQty
          : mainAvgCost

        const inMovement = await stockRepository.createMovement(
          client,
          {
            warehouse_id: detail.target_warehouse_id,
            product_id: line.product_id,
            movement_type: 'IN_TRANSFER',
            qty: qty,
            cost_per_unit: mainAvgCost,
            reference_type: 'transfer_order',
            reference_id: id,
            notes: `DPO ${detail.dpo_number} ← ${detail.source_warehouse_name}`,
            created_by: dto.confirmed_by,
          },
          newReadyQty
        )
        await stockRepository.upsertBalance(
          client, detail.target_warehouse_id, line.product_id, newReadyQty, newReadyAvgCost
        )

        stockMovementRefs.push({
          lineId: line.id,
          outMovementId: outMovement.id,
          inMovementId: inMovement.id,
        })
      }

      // Confirm DPO
      const confirmed = await dailyPrepOrdersRepository.confirmWithStock(
        client, id, dto.lock_token, dto.confirmed_by, stockMovementRefs
      )

      if (!confirmed) throw new DpoLockConflictError()

      await AuditService.log('UPDATE', 'daily_prep_orders', id, dto.confirmed_by, { status: 'DRAFT' }, { status: 'CONFIRMED', line_count: activeLines.length })

      return dailyPrepOrdersRepository.findDetailAccessible(id, branchIds)
    })
  }

  // ─── CANCEL (hard delete) ────────────────────────────────────────────────────

  async cancel(id: string, branchIds: string[], userId: string) {
    const dpo = await dailyPrepOrdersRepository.findByIdAccessible(id, branchIds)
    if (!dpo) throw new DpoNotFoundError(id)
    if (dpo.status !== 'DRAFT') throw new DpoInvalidStatusError(dpo.status, 'DRAFT')

    const ok = await dailyPrepOrdersRepository.hardDelete(id, dpo.company_id)
    if (!ok) throw new DpoNotFoundError(id)

    await AuditService.log('DELETE', 'daily_prep_orders', id, userId, { status: 'DRAFT', dpo_number: dpo.dpo_number }, null)
    return { success: true }
  }

  // ─── SOFT DELETE ────────────────────────────────────────────────────────────

  async softDelete(id: string, branchIds: string[], userId: string) {
    const dpo = await dailyPrepOrdersRepository.findByIdAccessible(id, branchIds)
    if (!dpo) throw new DpoNotFoundError(id)
    if (dpo.status !== 'DRAFT') throw new DpoInvalidStatusError(dpo.status, 'DRAFT')

    const ok = await dailyPrepOrdersRepository.softDelete(id, dpo.company_id, userId)
    if (!ok) throw new DpoNotFoundError(id)
    return { success: true }
  }
}

export const dailyPrepOrdersService = new DailyPrepOrdersService()