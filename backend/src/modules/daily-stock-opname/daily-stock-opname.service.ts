import { dailyStockOpnameRepository } from './daily-stock-opname.repository'
import type { InsertLineData } from './daily-stock-opname.repository'
import { reopenRepository } from './daily-stock-opname-reopen.repository'
import { theoreticalConsumptionRepository } from '../food-production/theoretical-consumption/theoretical-consumption.repository'
import { resolveUserWipAccessForBranch } from '../food-production/wip/wip-access.util'
import { requireBranchAccess, getCompanyIdForBranch } from '../../utils/branch-access.util'
import { stockRepository } from '../stock/stock.repository'
import { AuditService } from '../monitoring/monitoring.service'
import { storageService } from '../../services/storage.service'
import { pool } from '../../config/db'
import {
  OpnameTimeExpiredError,
  OpnameDuplicateError,
  OpnameNotDraftError,
  OpnameNotFlaggedError,
  OpnameNotFoundError,
  OpnameSessionExpiredError,
  OpnameIncompleteError,
  OpnamePhotoRequiredError,
} from './daily-stock-opname.errors'
import type {
  DailyClosingCount,
  DailyClosingCountDetail,
  DailyClosingCountLine,
  DailyClosingCountWithRelations,
  CreateOpnameDto,
  UpdateLineDto,
  BulkUpdateLinesDto,
  ResolveOpnameDto,
  UpsertOpnameConfigDto,
  BranchOpnameConfig,
  OpnameDashboardItem,
  VarianceReportItem,
  VarianceReportFilter,
} from './daily-stock-opname.types'
import { BusinessRuleError } from '../../utils/errors.base'

// ─── JAKARTA TIMEZONE UTILITIES ───────────────────────────────────────────────

const JAKARTA_TZ = 'Asia/Jakarta'

/**
 * Returns the current Date object adjusted to represent Jakarta time.
 * Note: The returned Date's UTC methods will reflect Jakarta local time values.
 */
export function nowJakarta(): Date {
  const now = new Date()
  // Get Jakarta time components using Intl
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '0'

  const year = parseInt(get('year'), 10)
  const month = parseInt(get('month'), 10) - 1
  const day = parseInt(get('day'), 10)
  const hour = parseInt(get('hour'), 10)
  const minute = parseInt(get('minute'), 10)
  const second = parseInt(get('second'), 10)

  return new Date(year, month, day, hour, minute, second)
}

/**
 * Returns today's date string in YYYY-MM-DD format using Jakarta timezone.
 */
export function todayJakarta(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // en-CA locale formats as YYYY-MM-DD
  return formatter.format(now)
}

/**
 * Returns the current time string in HH:mm format using Jakarta timezone.
 */
export function currentTimeJakarta(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: JAKARTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  // en-GB formats as HH:mm
  return formatter.format(now)
}

/**
 * Checks if the current Jakarta time is within the allowed window for the given action.
 *
 * - 'create' / 'edit': must be <= closing_time (no grace period)
 * - 'confirm': must be <= closing_time + grace_period_minutes
 *
 * @param closingTime - The closing time in HH:mm format
 * @param gracePeriodMinutes - Grace period in minutes (only applied for 'confirm')
 * @param action - The action being performed
 * @param _currentTime - Optional override for current time (HH:mm format), used for testing
 * @returns true if the current time is within the allowed window
 */
export function isWithinClosingTime(
  closingTime: string,
  gracePeriodMinutes: number,
  action: 'create' | 'edit' | 'confirm',
  _currentTime?: string,
): boolean {
  const currentTime = _currentTime ?? currentTimeJakarta()
  const [currentHour, currentMinute] = currentTime.split(':').map(Number)
  const [closingHour, closingMinute] = closingTime.split(':').map(Number)

  const currentTotalMinutes = currentHour * 60 + currentMinute
  let deadlineTotalMinutes = closingHour * 60 + closingMinute

  // Only 'confirm' action gets the grace period
  if (action === 'confirm') {
    deadlineTotalMinutes += gracePeriodMinutes
  }

  return currentTotalMinutes <= deadlineTotalMinutes
}

// ─── DEFAULT CONFIG VALUES ────────────────────────────────────────────────────

const DEFAULT_CLOSING_TIME = '23:59'
const DEFAULT_GRACE_PERIOD_MINUTES = 15
const DEFAULT_VARIANCE_THRESHOLD_PCT = 15

// ─── SERVICE CLASS ────────────────────────────────────────────────────────────

export class DailyStockOpnameService {

  // ─── SESSION CREATION ───────────────────────────────────────────────────────

  /**
   * Creates a new opname session for a branch on a given date, filtered by position.
   *
   * Steps:
   * 1. Validate branch access, resolve company
   * 2. Validate no existing session for branch + date + position
   * 3. Resolve READY and MAIN warehouse for branch
   * 4. Get products accessible by position (via WIP materials + outputs)
   * 5. Filter to products with stock in READY warehouse
   * 6. Calculate expected balances: ready_balance - theoretical_consumption
   * 7. Snapshot MAIN warehouse balances, cost_per_unit, DPO in quantities
   * 8. Insert header and lines within transaction
   * 9. Log audit entry via AuditService
   */
  async createSession(
    branchIds: string[],
    dto: CreateOpnameDto,
    userId: string,
  ): Promise<DailyClosingCountDetail> {
    requireBranchAccess(dto.branch_id, branchIds)

    const companyId = (await getCompanyIdForBranch(dto.branch_id)) ?? ''
    if (!companyId) {
      throw new BusinessRuleError('Branch tidak ditemukan atau tidak memiliki company')
    }

    // 1. Use closing_date from DTO (user picks the date)
    const closingDate = dto.closing_date

    // 2. Validate no existing session for branch + date + position
    const existingSession = await dailyStockOpnameRepository.findByBranchDateAndPosition(
      dto.branch_id, closingDate, dto.position_id,
    )
    if (existingSession) {
      const readyWarehouse = await dailyStockOpnameRepository.findWarehouseByBranchAndType(dto.branch_id, 'READY')
      const posDetails = (await dailyStockOpnameRepository.getPositionDetails([dto.position_id]))[0]
      throw new OpnameDuplicateError(readyWarehouse?.warehouse_name ?? dto.branch_id, closingDate, posDetails?.position_name)
    }

    // 3. Resolve READY warehouse for branch
    const readyWarehouse = await dailyStockOpnameRepository.findWarehouseByBranchAndType(dto.branch_id, 'READY')
    if (!readyWarehouse) {
      throw new BusinessRuleError('Warehouse READY tidak ditemukan untuk cabang ini. Pastikan warehouse READY sudah dikonfigurasi.')
    }

    // 4. Resolve MAIN warehouse for branch (for snapshot)
    const mainWarehouse = await dailyStockOpnameRepository.findWarehouseByBranchAndType(dto.branch_id, 'MAIN')
    if (!mainWarehouse) {
      throw new BusinessRuleError('Warehouse MAIN tidak ditemukan untuk cabang ini. Pastikan warehouse MAIN sudah dikonfigurasi.')
    }

    // 5. Check if selected position has can_access_all_wip flag
    const positionCheck = await dailyStockOpnameRepository.findPositionById(dto.position_id)
    if (!positionCheck) {
      throw new BusinessRuleError('Position tidak ditemukan atau sudah dihapus.')
    }
    const canAccessAllWip = positionCheck.can_access_all_wip

    // 6. Get all products with stock in READY warehouse
    const allProductsWithStock = await dailyStockOpnameRepository.getProductsWithStock(readyWarehouse.id)

    // 7. Filter to only products accessible by this position (skip if can_access_all_wip)
    let productsWithStock = allProductsWithStock
    if (!canAccessAllWip) {
      const positionProductIds = await dailyStockOpnameRepository.getProductIdsByPosition(dto.position_id, companyId)
      if (positionProductIds.size === 0) {
        throw new BusinessRuleError('Tidak ada produk yang terkait dengan position ini. Pastikan WIP sudah di-assign ke position yang dipilih.')
      }
      productsWithStock = allProductsWithStock.filter(p => positionProductIds.has(p.product_id))
    }

    if (productsWithStock.length === 0) {
      throw new BusinessRuleError('Tidak ada produk dengan stok di gudang READY untuk position ini.')
    }

    // 8. Get theoretical consumption for the date
    const theoreticalMap = await this.getTheoreticalConsumptionForDate(dto.branch_id, closingDate)

    // 9. Get DPO IN_DAILY movements for the date (display only)
    const dpoTransfers = await dailyStockOpnameRepository.getDpoTransfersForDate(readyWarehouse.id, closingDate)

    // 10. Get MAIN warehouse balances (snapshot)
    const mainBalances = await dailyStockOpnameRepository.getMainBalances(mainWarehouse.id)

    // 11. Build opname lines
    const lines: InsertLineData[] = []
    let sortOrder = 0

    // Track products that have recipe coverage
    const productsWithRecipe = new Set(theoreticalMap.keys())

    for (const product of productsWithStock) {
      sortOrder++

      const readyBalance = product.qty
      const theoreticalOut = theoreticalMap.get(product.product_id) ?? 0
      const hasRecipe = productsWithRecipe.has(product.product_id)
      const dpoInQty = dpoTransfers.get(product.product_id) ?? 0
      const mainBalance = mainBalances.get(product.product_id) ?? 0

      // Expected balance formula: ready_balance - theoretical_out
      const rawExpected = readyBalance - theoreticalOut

      // Clamp negative to 0 with warning
      let expectedQty = rawExpected
      let hasWarning = false
      let warningMessage: string | null = null

      if (rawExpected < 0) {
        expectedQty = 0
        hasWarning = true
        warningMessage = `Konsumsi teoritis (${theoreticalOut.toFixed(2)}) melebihi stok tersedia (${readyBalance.toFixed(2)}). Expected di-clamp ke 0.`
      }

      // Cost resolution: use avg_cost from stock_balances, fallback to last movement cost
      let costPerUnit = product.avg_cost
      if (!costPerUnit || costPerUnit === 0) {
        costPerUnit = await dailyStockOpnameRepository.getLastMovementCost(readyWarehouse.id, product.product_id)
      }

      // High-risk product detection
      const isHighRisk = product.risk_category === 'HIGH'
      const requiresPhoto = isHighRisk

      lines.push({
        product_id: product.product_id,
        product_code: product.product_code,
        product_name: product.product_name,
        uom: product.uom,
        system_qty: readyBalance,
        expected_qty: expectedQty,
        cost_per_unit: costPerUnit,
        main_balance: mainBalance,
        dpo_in_qty: dpoInQty,
        theoretical_out: theoreticalOut,
        is_high_risk: isHighRisk,
        requires_photo: requiresPhoto,
        has_recipe: hasRecipe,
        has_warning: hasWarning,
        warning_message: warningMessage,
        sort_order: sortOrder,
      })
    }

    // 12. Insert header and lines within a transaction
    const sessionId = await dailyStockOpnameRepository.withTransaction(async (client) => {
      // Generate opname number (format: OPN-{branchCode}-{YYYYMMDD}-{seq})
      const branchCode = await dailyStockOpnameRepository.getBranchCode(dto.branch_id) ?? 'UNK'
      const opnameNumber = await dailyStockOpnameRepository.generateOpnameNumber(client, companyId, branchCode, closingDate)

      const header = await dailyStockOpnameRepository.insertHeader(client, {
        company_id: companyId,
        branch_id: dto.branch_id,
        warehouse_id: readyWarehouse.id,
        opname_number: opnameNumber,
        closing_date: closingDate,
        pic_user_id: userId,
        position_id: dto.position_id,
        notes: dto.notes ?? null,
        created_by: userId,
      })

      // Insert lines
      if (lines.length > 0) {
        await dailyStockOpnameRepository.insertLines(client, header.id, lines)
      }

      // Update header with line_count
      await dailyStockOpnameRepository.updateHeaderStatus(client, header.id, {
        line_count: lines.length,
        total_expected_cost: lines.reduce((sum, l) => sum + (l.expected_qty * l.cost_per_unit), 0),
        updated_by: userId,
      })

      return header.id
    })

    // 13. Log audit entry
    await AuditService.log('CREATE', 'daily_closing_counts', sessionId, userId, undefined, {
      branch_id: dto.branch_id,
      closing_date: closingDate,
      warehouse_id: readyWarehouse.id,
      position_id: dto.position_id,
      line_count: lines.length,
    })

    // 14. Handle backdate: auto-create reopen request for manager approval
    const isBackdate = closingDate < todayJakarta()
    if (isBackdate) {
      // Mark session as backdate
      await pool.query(
        `UPDATE daily_closing_counts SET is_backdate = true WHERE id = $1`,
        [sessionId],
      )

      // Auto-create reopen request
      await reopenRepository.insertRequestDirect({
        closing_id: sessionId,
        requested_by: userId,
        reason: `Backdate opname untuk tanggal ${closingDate}`,
      })

      // Dispatch notification (non-blocking: notification failure should not block creation)
      try {
        const { notificationDispatcher } = await import('../notifications/notification-dispatcher.service')
        const companyIdForNotif = (await getCompanyIdForBranch(dto.branch_id)) ?? ''
        const { rows: branchInfo } = await pool.query(`SELECT branch_name FROM branches WHERE id = $1`, [dto.branch_id])
        const { rows: picInfo } = await pool.query(`SELECT full_name FROM employees WHERE user_id = $1 LIMIT 1`, [userId])
        await notificationDispatcher.dispatch('OPNAME_REOPEN_REQUESTED', companyIdForNotif, {
          entityId: sessionId,
          variables: {
            closing_date: closingDate,
            reason: `Backdate opname untuk tanggal ${closingDate}`,
            branch_name: branchInfo[0]?.branch_name ?? '',
            pic_name: picInfo[0]?.full_name ?? '',
          },
          excludeUserIds: [userId],
        })
      } catch {
        // Non-blocking: notification failure should not block creation
      }
    }

    // 15. Fetch and return the full detail
    const detail = await dailyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!detail) {
      throw new BusinessRuleError('Gagal mengambil detail opname session setelah pembuatan')
    }

    return detail
  }

  // ─── AVAILABLE POSITIONS ────────────────────────────────────────────────────

  /**
   * Returns positions available for the current user to create opname sessions.
   * A position is "available" if:
   * 1. User has that position (via employee_branches or employee_positions)
   * 2. That position has WIP items assigned to it (via wip_position_access)
   */
  async getAvailablePositions(
    userId: string,
    branchId: string,
  ): Promise<{ id: string; position_code: string; position_name: string; department_name: string }[]> {
    const access = await resolveUserWipAccessForBranch(userId, branchId)

    if (access.positionIds.length === 0) return []

    return dailyStockOpnameRepository.getPositionDetails(access.positionIds)
  }

  // ─── LINE UPDATES ────────────────────────────────────────────────────────────

  /**
   * Updates the actual quantity for a single opname line.
   *
   * Steps:
   * 1. Fetch session and validate access
   * 2. Validate session is DRAFT (throw OpnameNotDraftError if not)
   * 3. Validate session is not expired (throw OpnameSessionExpiredError if from previous day)
   * 4. Validate time restriction for 'edit' action
   * 5. Call repository.updateLineActual() which handles variance calculation in SQL
   * 6. Update completed_count on header
   * 7. Log audit entry
   *
   * Requirements: 3.1, 3.2, 3.3, 3.7, 3.8, 3.9, 3.10, 6.4, 15.3
   */
  async updateLine(
    sessionId: string,
    lineId: string,
    branchIds: string[],
    dto: UpdateLineDto,
    userId: string,
  ): Promise<DailyClosingCountLine> {
    // 1. Fetch session and validate access
    const session = await dailyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(sessionId)
    }

    // 2. Validate session is DRAFT or REOPENED
    if (session.status !== 'DRAFT' && session.status !== 'REOPENED') {
      throw new OpnameNotDraftError(session.status)
    }

    // 3. Skip time restriction and expiry check when REOPENED
    if (session.status !== 'REOPENED') {
      // Validate session is not expired (DRAFT from previous day)
      if (this.isSessionExpired(session)) {
        throw new OpnameSessionExpiredError(session.closing_date)
      }

      // Validate time restriction for 'edit' action
      await this.validateTimeRestriction(session.branch_id, 'edit')
    }

    // 5. Get the line's previous value for audit
    const previousLine = await dailyStockOpnameRepository.getLineById(lineId, sessionId)
    if (!previousLine) {
      throw new OpnameNotFoundError(lineId)
    }

    // 6. Update line actual qty (variance calculated in SQL)
    const updatedLine = await dailyStockOpnameRepository.updateLineActual(lineId, sessionId, dto.actual_qty)

    // 7. Update completed_count on header (re-fetch from DB for accuracy)
    const completedCount = await dailyStockOpnameRepository.countCompletedLines(sessionId)
    await dailyStockOpnameRepository.withTransaction(async (client) => {
      await dailyStockOpnameRepository.updateHeaderStatus(client, sessionId, {
        completed_count: completedCount,
        updated_by: userId,
      })
    })

    // 8. Log audit entry
    await AuditService.log('UPDATE', 'daily_closing_count_lines', lineId, userId, {
      actual_qty: previousLine.actual_qty,
      product_id: previousLine.product_id,
    }, {
      actual_qty: dto.actual_qty,
      product_id: previousLine.product_id,
      variance_qty: updatedLine.variance_qty,
      variance_pct: updatedLine.variance_pct,
      variance_cost: updatedLine.variance_cost,
    })

    return updatedLine
  }

  /**
   * Bulk updates actual quantities for multiple opname lines.
   *
   * Same validations as updateLine, but processes multiple lines at once
   * and updates completed_count only once at the end.
   *
   * Requirements: 3.1, 3.2, 3.3, 3.7, 3.8, 3.9, 3.10, 6.4, 15.3
   */
  async bulkUpdateLines(
    sessionId: string,
    branchIds: string[],
    dto: BulkUpdateLinesDto,
    userId: string,
  ): Promise<DailyClosingCountLine[]> {
    // 1. Fetch session and validate access
    const session = await dailyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(sessionId)
    }

    // 2. Validate session is DRAFT or REOPENED
    if (session.status !== 'DRAFT' && session.status !== 'REOPENED') {
      throw new OpnameNotDraftError(session.status)
    }

    // 3. Skip time restriction and expiry check when REOPENED
    if (session.status !== 'REOPENED') {
      // Validate session is not expired (DRAFT from previous day)
      if (this.isSessionExpired(session)) {
        throw new OpnameSessionExpiredError(session.closing_date)
      }

      // Validate time restriction for 'edit' action
      await this.validateTimeRestriction(session.branch_id, 'edit')
    }

    // 5. Batch fetch all lines being updated (single DB call instead of N)
    const lineIds = dto.lines.map((l) => l.line_id)
    const previousLines = await dailyStockOpnameRepository.getLinesByIds(lineIds, sessionId)
    const previousLinesMap = new Map(previousLines.map((l) => [l.id, l]))

    // Validate all line IDs exist
    for (const lineUpdate of dto.lines) {
      if (!previousLinesMap.has(lineUpdate.line_id)) {
        throw new OpnameNotFoundError(lineUpdate.line_id)
      }
    }

    // 6. Process each line update
    const updatedLines: DailyClosingCountLine[] = []
    for (const lineUpdate of dto.lines) {
      const previousLine = previousLinesMap.get(lineUpdate.line_id)!

      const updatedLine = await dailyStockOpnameRepository.updateLineActual(
        lineUpdate.line_id,
        sessionId,
        lineUpdate.actual_qty,
      )
      updatedLines.push(updatedLine)

      // Log audit entry for each line
      await AuditService.log('UPDATE', 'daily_closing_count_lines', lineUpdate.line_id, userId, {
        actual_qty: previousLine.actual_qty,
        product_id: previousLine.product_id,
      }, {
        actual_qty: lineUpdate.actual_qty,
        product_id: previousLine.product_id,
        variance_qty: updatedLine.variance_qty,
        variance_pct: updatedLine.variance_pct,
        variance_cost: updatedLine.variance_cost,
      })
    }

    // 7. Update completed_count on header (re-fetch from DB for accuracy)
    const completedCount = await dailyStockOpnameRepository.countCompletedLines(sessionId)
    await dailyStockOpnameRepository.withTransaction(async (client) => {
      await dailyStockOpnameRepository.updateHeaderStatus(client, sessionId, {
        completed_count: completedCount,
        updated_by: userId,
      })
    })

    return updatedLines
  }

  /**
   * Uploads a photo for an opname line.
   *
   * Steps:
   * 1. Validate session is DRAFT and within time window
   * 2. Upload file to storage (R2)
   * 3. Call repository.updateLinePhoto()
   * 4. Log audit entry
   *
   * Requirements: 4.4, 4.5, 4.6, 6.4, 15.4
   */
  async uploadPhoto(
    sessionId: string,
    lineId: string,
    branchIds: string[],
    file: Buffer,
    fileName: string,
    contentType: string,
    userId: string,
  ): Promise<{ photo_url: string }> {
    // 1. Fetch session and validate access
    const session = await dailyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(sessionId)
    }

    // 2. Validate session is DRAFT or REOPENED
    if (session.status !== 'DRAFT' && session.status !== 'REOPENED') {
      throw new OpnameNotDraftError(session.status)
    }

    // 3. Skip time restriction and expiry check when REOPENED
    if (session.status !== 'REOPENED') {
      if (this.isSessionExpired(session)) {
        throw new OpnameSessionExpiredError(session.closing_date)
      }
      await this.validateTimeRestriction(session.branch_id, 'edit')
    }

    // 5. Validate line exists
    const line = await dailyStockOpnameRepository.getLineById(lineId, sessionId)
    if (!line) {
      throw new OpnameNotFoundError(lineId)
    }

    // 6. Upload file to storage
    const path = `opname/${session.company_id}/${session.closing_date}/${sessionId}/${lineId}/${fileName}`
    await storageService.uploadToPath(file, path, contentType)
    const publicUrl = storageService.getPublicUrl(path)

    // 7. Update line photo URL
    await dailyStockOpnameRepository.updateLinePhoto(lineId, sessionId, publicUrl)

    // 8. Log audit entry
    await AuditService.log('UPDATE', 'daily_closing_count_lines', lineId, userId, undefined, {
      photo_url: publicUrl,
      product_id: line.product_id,
    })

    return { photo_url: publicUrl }
  }

  /**
   * Deletes the photo for an opname line.
   * Removes the file from R2 and clears the photo_url.
   */
  async deletePhoto(
    sessionId: string,
    lineId: string,
    branchIds: string[],
    userId: string,
  ): Promise<void> {
    // 1. Fetch session and validate access
    const session = await dailyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(sessionId)
    }

    // 2. Validate session is DRAFT or REOPENED
    if (session.status !== 'DRAFT' && session.status !== 'REOPENED') {
      throw new OpnameNotDraftError(session.status)
    }

    // 3. Skip time restriction and expiry check when REOPENED
    if (session.status !== 'REOPENED') {
      if (this.isSessionExpired(session)) {
        throw new OpnameSessionExpiredError(session.closing_date)
      }
      await this.validateTimeRestriction(session.branch_id, 'edit')
    }

    // 4. Validate line exists and has a photo
    const line = await dailyStockOpnameRepository.getLineById(lineId, sessionId)
    if (!line) {
      throw new OpnameNotFoundError(lineId)
    }
    if (!line.photo_url) return // Nothing to delete

    // 5. Extract storage path from public URL and delete from R2
    try {
      const url = new URL(line.photo_url)
      const storagePath = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
      await storageService.delete(storagePath)
    } catch {
      // If deletion from storage fails, still clear the DB reference
    }

    // 6. Clear photo URL in DB
    await dailyStockOpnameRepository.updateLinePhoto(lineId, sessionId, '')

    // 7. Audit log
    await AuditService.log('UPDATE', 'daily_closing_count_lines', lineId, userId,
      { photo_url: line.photo_url },
      { photo_url: null },
    )
  }

  // ─── CONFIRM SESSION ──────────────────────────────────────────────────────

  /**
   * Confirms an opname session, creating stock movements for all variances.
   *
   * Steps:
   * 1. Validate session is DRAFT, not expired, within closing_time + grace
   * 2. Validate all lines have actual_qty (no nulls)
   * 3. Validate high-risk lines with photo requirement have photo
   * 4. Get branch config for variance threshold
   * 5. BEGIN TRANSACTION:
   *    For each line:
   *    a. variance = actual_qty - expected_qty
   *    b. variance_cost = variance × cost_per_unit
   *    c. IF variance < 0: create OUT_WASTE movement, store out_movement_id
   *    d. IF variance > 0: create IN_ADJUSTMENT movement, store in_movement_id
   *    e. IF variance == 0 BUT stock_balances.qty != actual_qty: create OUT_ADJUSTMENT to reconcile
   *    f. Update stock_balances to reflect actual_qty
   *    g. Store movement IDs on line
   * 6. Calculate total_variance_cost = sum of abs(line variance costs)
   * 7. Determine status: FLAGGED if any line (expected > 0) exceeds threshold, else CONFIRMED
   * 8. Update header (status, totals, confirmed_by, confirmed_at)
   * 9. COMMIT
   * 10. Log audit entry
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 16.1, 16.2, 16.3, 16.4, 15.2
   */
  async confirmSession(
    id: string,
    branchIds: string[],
    userId: string,
  ): Promise<DailyClosingCountDetail> {
    // 1. Fetch session and validate access
    const session = await dailyStockOpnameRepository.findByIdAccessible(id, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(id)
    }

    // 2. Validate session is DRAFT or REOPENED
    if (session.status !== 'DRAFT' && session.status !== 'REOPENED') {
      throw new OpnameNotDraftError(session.status)
    }

    // 3. Skip time restriction and expiry check when REOPENED
    if (session.status !== 'REOPENED') {
      // Validate session is not expired (DRAFT from previous day)
      if (this.isSessionExpired(session)) {
        throw new OpnameSessionExpiredError(session.closing_date)
      }

      // Validate time restriction for 'confirm' action (closing_time + grace period)
      await this.validateTimeRestriction(session.branch_id, 'confirm')
    }

    // 5. Validate all lines have actual_qty (no nulls)
    const incompleteLines = session.lines.filter((l) => l.actual_qty === null)
    if (incompleteLines.length > 0) {
      const completedCount = session.lines.length - incompleteLines.length
      throw new OpnameIncompleteError(completedCount, session.lines.length)
    }

    // 6. Validate high-risk lines with photo requirement have photo
    // Photo required when: is_high_risk = true AND (expected_qty > 0 OR actual_qty > 0)
    // Photo NOT required when: is_high_risk = true AND expected_qty = 0 AND actual_qty = 0
    const missingPhotoLines = session.lines.filter(
      (l) =>
        l.is_high_risk &&
        (l.expected_qty > 0 || (l.actual_qty ?? 0) > 0) &&
        !l.photo_url,
    )
    if (missingPhotoLines.length > 0) {
      throw new OpnamePhotoRequiredError(missingPhotoLines.map((l) => l.product_name))
    }

    // 7. Get branch config for variance threshold
    const config = await this.getBranchConfigWithDefaults(session.branch_id)
    const varianceThreshold = config.variance_threshold_pct

    // 8. Execute confirmation within a single transaction
    let finalStatus: 'CONFIRMED' | 'FLAGGED' = 'CONFIRMED'
    await dailyStockOpnameRepository.withTransaction(async (client) => {
      // Get lines within the transaction for consistency
      const lines = await dailyStockOpnameRepository.getLinesByClosingId(client, id)

      let totalVarianceCost = 0
      let totalActualCost = 0
      let isFlagged = false

      for (const line of lines) {
        const actualQty = line.actual_qty as number // Already validated non-null above
        const expectedQty = line.expected_qty
        const costPerUnit = line.cost_per_unit

        // a. Calculate variance
        const variance = actualQty - expectedQty
        const varianceCost = variance * costPerUnit

        // Calculate variance_pct
        let variancePct: number | null = null
        if (expectedQty > 0) {
          variancePct = Math.round(((variance / expectedQty) * 100) * 100) / 100
        } else if (expectedQty === 0 && actualQty > 0) {
          variancePct = null
        } else {
          variancePct = 0
        }

        // Accumulate totals
        totalVarianceCost += Math.abs(varianceCost)
        totalActualCost += actualQty * costPerUnit

        // Check flagging: if any line where expected > 0 has abs(variance_pct) > threshold
        if (expectedQty > 0 && variancePct !== null && Math.abs(variancePct) > varianceThreshold) {
          isFlagged = true
        }

        // b. Get current stock balance for this product in the READY warehouse
        const currentBalance = await stockRepository.getBalanceForUpdate(
          client,
          session.warehouse_id,
          line.product_id,
        )
        const currentQty = currentBalance ? Number(currentBalance.qty) : 0
        const currentAvgCost = currentBalance ? Number(currentBalance.avg_cost) : 0

        let outMovementId: string | null = null
        let inMovementId: string | null = null

        // c. IF variance < 0: create OUT_WASTE movement
        if (variance < 0) {
          const absVariance = Math.abs(variance)
          const newQty = currentQty - absVariance

          const movement = await stockRepository.createMovement(
            client,
            {
              warehouse_id: session.warehouse_id,
              product_id: line.product_id,
              movement_type: 'OUT_WASTE',
              qty: absVariance,
              cost_per_unit: costPerUnit,
              reference_type: 'daily_closing_count',
              reference_id: id,
              notes: `Opname ${session.closing_date} - waste: ${line.product_name}`,
              movement_date: session.closing_date,
              created_by: userId,
            },
            newQty,
          )
          outMovementId = movement.id

          // Update stock balance to actual qty
          await stockRepository.upsertBalance(
            client,
            session.warehouse_id,
            line.product_id,
            actualQty,
            currentAvgCost,
          )
        }
        // d. IF variance > 0: create IN_ADJUSTMENT movement
        else if (variance > 0) {
          const newQty = currentQty + variance

          // Weighted average cost for IN_ADJUSTMENT
          const newAvgCost = newQty > 0
            ? (currentQty * currentAvgCost + variance * costPerUnit) / newQty
            : costPerUnit

          const movement = await stockRepository.createMovement(
            client,
            {
              warehouse_id: session.warehouse_id,
              product_id: line.product_id,
              movement_type: 'IN_ADJUSTMENT',
              qty: variance,
              cost_per_unit: costPerUnit,
              reference_type: 'daily_closing_count',
              reference_id: id,
              notes: `Opname ${session.closing_date} - adjustment in: ${line.product_name}`,
              movement_date: session.closing_date,
              created_by: userId,
            },
            actualQty,
          )
          inMovementId = movement.id

          // Update stock balance to actual qty with new avg cost
          await stockRepository.upsertBalance(
            client,
            session.warehouse_id,
            line.product_id,
            actualQty,
            newAvgCost,
          )
        }
        // e. IF variance == 0: just ensure stock_balances matches actual (no movement needed)
        else {
          await stockRepository.upsertBalance(
            client,
            session.warehouse_id,
            line.product_id,
            actualQty,
            currentAvgCost,
          )
        }

        // g. Store movement IDs and variance fields on line
        await dailyStockOpnameRepository.updateLineMovements(client, line.id, {
          out_movement_id: outMovementId,
          in_movement_id: inMovementId,
          variance_qty: variance,
          variance_pct: variancePct,
          variance_cost: varianceCost,
        })
      }

      // 9. Determine final status
      finalStatus = isFlagged ? 'FLAGGED' : 'CONFIRMED'

      // 10. Calculate total expected cost
      const totalExpectedCost = lines.reduce((sum, l) => sum + (l.expected_qty * l.cost_per_unit), 0)

      // 11. Update header with status, totals, confirmed_by, confirmed_at
      await dailyStockOpnameRepository.updateHeaderStatus(client, id, {
        status: finalStatus,
        total_variance_cost: totalVarianceCost,
        total_expected_cost: totalExpectedCost,
        total_actual_cost: totalActualCost,
        completed_count: lines.length,
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
        updated_by: userId,
      })
    })

    // 12. Log audit entry
    await AuditService.log('UPDATE', 'daily_closing_counts', id, userId, {
      status: 'DRAFT',
    }, {
      status: finalStatus,
    })

    // 13. Fetch and return the updated detail
    const updatedDetail = await dailyStockOpnameRepository.findByIdAccessible(id, branchIds)
    if (!updatedDetail) {
      throw new BusinessRuleError('Gagal mengambil detail opname session setelah konfirmasi')
    }

    return updatedDetail
  }

  // ─── GET BY ID ────────────────────────────────────────────────────────────

  /**
   * Returns full opname session detail with lines and summary.
   * Computes display status (MISSED for expired DRAFT sessions).
   *
   * Requirements: 11.1, 11.3, 12.1, 12.4
   */
  async getById(
    id: string,
    branchIds: string[],
  ): Promise<DailyClosingCountDetail> {
    const detail = await dailyStockOpnameRepository.findByIdAccessible(id, branchIds)
    if (!detail) {
      throw new OpnameNotFoundError(id)
    }
    return detail
  }

  // ─── LIST ───────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of opname sessions with filters.
   * Computes display status for each session (MISSED for expired DRAFT).
   *
   * Requirements: 11.1, 11.2, 11.3, 11.4
   */
  async list(
    branchIds: string[],
    pagination: { page: number; limit: number },
    filter?: { branch_id?: string; position_id?: string; status?: string; date_from?: string; date_to?: string },
    search?: string,
  ): Promise<{ data: DailyClosingCountWithRelations[]; total: number; page: number; limit: number }> {
    const offset = (pagination.page - 1) * pagination.limit

    const result = await dailyStockOpnameRepository.findAll(
      branchIds,
      { limit: pagination.limit, offset },
      filter,
      search,
    )

    return {
      data: result.data,
      total: result.total,
      page: pagination.page,
      limit: pagination.limit,
    }
  }

  // ─── CONFIG ─────────────────────────────────────────────────────────────────

  /**
   * Returns the branch opname config, or defaults if none exists.
   * Defaults: variance_threshold_pct = 15, closing_time = '23:59', grace_period_minutes = 15
   *
   * Requirements: 17.1, 17.2, 17.3, 18.1, 18.2, 18.3
   */
  async getConfig(branchId: string): Promise<BranchOpnameConfig> {
    const config = await dailyStockOpnameRepository.findConfig(branchId)
    if (config) {
      return config
    }

    // Return defaults when no config exists
    return {
      id: '',
      company_id: '',
      branch_id: branchId,
      variance_threshold_pct: DEFAULT_VARIANCE_THRESHOLD_PCT,
      closing_time: DEFAULT_CLOSING_TIME,
      grace_period_minutes: DEFAULT_GRACE_PERIOD_MINUTES,
      updated_by: null,
      updated_at: '',
    }
  }

  /**
   * Creates or updates the branch opname config.
   * Logs an audit entry after saving.
   *
   * Requirements: 17.1, 17.2, 17.3, 18.1, 18.2, 18.3
   */
  async upsertConfig(
    branchId: string,
    companyId: string,
    dto: UpsertOpnameConfigDto,
    userId: string,
  ): Promise<BranchOpnameConfig> {
    const updatedConfig = await dailyStockOpnameRepository.upsertConfig(branchId, companyId, dto, userId)

    // Log audit entry
    await AuditService.log('UPDATE', 'branch_opname_config', updatedConfig.id, userId, undefined, {
      branch_id: branchId,
      variance_threshold_pct: updatedConfig.variance_threshold_pct,
      closing_time: updatedConfig.closing_time,
      grace_period_minutes: updatedConfig.grace_period_minutes,
    })

    return updatedConfig
  }

  // ─── CANCEL SESSION ──────────────────────────────────────────────────────

  /**
   * Cancels (soft-deletes) a DRAFT opname session.
   *
   * Steps:
   * 1. Fetch session and validate access
   * 2. Validate session is DRAFT (throw OpnameNotDraftError if not)
   * 3. Soft-delete the session via repository
   * 4. Log audit entry
   *
   * Requirements: 7.1, 7.2, 7.3, 15.2
   */
  async cancel(
    id: string,
    branchIds: string[],
    userId: string,
    hasDeletePermission: boolean = false,
  ): Promise<void> {
    // 1. Fetch session and validate access
    const session = await dailyStockOpnameRepository.findByIdAccessible(id, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(id)
    }

    // 2. Validate session is DRAFT
    if (session.status !== 'DRAFT') {
      throw new OpnameNotDraftError(session.status)
    }

    // 3. Validate user is PIC or has delete (manager) permission
    const isPic = session.pic_user_id === userId
    if (!isPic && !hasDeletePermission) {
      throw new BusinessRuleError('Hanya PIC atau manager yang dapat membatalkan opname session ini')
    }

    // 4. Soft-delete the session
    await dailyStockOpnameRepository.softDelete(id, userId)

    // 5. Log audit entry
    await AuditService.log('DELETE', 'daily_closing_counts', id, userId, {
      status: 'DRAFT',
      branch_id: session.branch_id,
      closing_date: session.closing_date,
    }, undefined)
  }

  // ─── RESOLVE FLAGGED SESSION ────────────────────────────────────────────────

  /**
   * Resolves a FLAGGED opname session by updating status to CONFIRMED.
   *
   * Steps:
   * 1. Fetch session and validate access
   * 2. Validate session is FLAGGED (throw OpnameNotFlaggedError if not)
   * 3. Update status to CONFIRMED with resolution_note, resolved_by, resolved_at
   * 4. No additional stock movements (they were already created during original confirmation)
   * 5. Log audit entry
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 15.2
   */
  async resolve(
    id: string,
    branchIds: string[],
    dto: ResolveOpnameDto,
    userId: string,
  ): Promise<DailyClosingCountDetail> {
    // 1. Fetch session and validate access
    const session = await dailyStockOpnameRepository.findByIdAccessible(id, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(id)
    }

    // 2. Validate session is FLAGGED
    if (session.status !== 'FLAGGED') {
      throw new OpnameNotFlaggedError(session.status)
    }

    // 3. Update status to CONFIRMED with resolution info
    await dailyStockOpnameRepository.withTransaction(async (client) => {
      await dailyStockOpnameRepository.updateHeaderStatus(client, id, {
        status: 'CONFIRMED',
        resolution_note: dto.resolution_note,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
        updated_by: userId,
      })
    })

    // 4. Log audit entry
    await AuditService.log('UPDATE', 'daily_closing_counts', id, userId, {
      status: 'FLAGGED',
    }, {
      status: 'CONFIRMED',
      resolution_note: dto.resolution_note,
      resolved_by: userId,
    })

    // 5. Fetch and return the updated detail
    const updatedDetail = await dailyStockOpnameRepository.findByIdAccessible(id, branchIds)
    if (!updatedDetail) {
      throw new BusinessRuleError('Gagal mengambil detail opname session setelah resolve')
    }

    return updatedDetail
  }

  // ─── INTERNAL HELPERS ───────────────────────────────────────────────────────

  /**
   * Gets theoretical consumption for a branch on a specific date.
   * Returns Map<product_id, theoretical_qty>.
   *
   * If the branch has no POS data or no recipe coverage, returns an empty map
   * (theoretical consumption = 0 for all products).
   *
   * Requirements: 2.4, 2.5
   */
  private async getTheoreticalConsumptionForDate(
    branchId: string,
    date: string,
  ): Promise<Map<string, number>> {
    try {
      const branchIds = await theoreticalConsumptionRepository.resolveBranchIds(branchId)
      const items = await theoreticalConsumptionRepository.getTheoreticalConsumption(
        date, date, branchIds.branchPosId,
      )

      const map = new Map<string, number>()
      for (const item of items) {
        const existing = map.get(item.product_id) ?? 0
        map.set(item.product_id, existing + item.theoretical_qty)
      }
      return map
    } catch {
      // If branch has no POS mapping or theoretical consumption fails,
      // return empty map (theoretical = 0 for all products)
      return new Map()
    }
  }

  // ─── TIME RESTRICTION VALIDATION ────────────────────────────────────────────

  /**
   * Validates that the current Jakarta time is within the allowed window for the given action.
   *
   * - 'create': current time must be BEFORE closing_time (no grace period for creation)
   * - 'edit': current time must be BEFORE closing_time (no grace period for editing)
   * - 'confirm': current time must be BEFORE closing_time + grace_period_minutes
   *
   * Throws OpnameTimeExpiredError if the time restriction is violated.
   *
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
   */
  async validateTimeRestriction(
    branchId: string,
    action: 'create' | 'edit' | 'confirm',
  ): Promise<void> {
    const config = await dailyStockOpnameRepository.findConfig(branchId)

    const closingTime = config?.closing_time ?? DEFAULT_CLOSING_TIME
    const gracePeriodMinutes = config?.grace_period_minutes ?? DEFAULT_GRACE_PERIOD_MINUTES

    if (!isWithinClosingTime(closingTime, gracePeriodMinutes, action)) {
      throw new OpnameTimeExpiredError(closingTime)
    }
  }

  /**
   * Checks if a DRAFT session is from a previous day (expired/missed).
   * Returns true if the session is DRAFT and its closing_date is before today in Jakarta TZ.
   *
   * Requirements: 10.2
   */
  isSessionExpired(session: DailyClosingCount): boolean {
    if (session.status !== 'DRAFT') return false

    const today = todayJakarta()
    return session.closing_date < today
  }

  /**
   * Converts a missed (expired DRAFT) session into a backdate session.
   * Creates a reopen request for manager approval.
   * After approval, session becomes REOPENED and can be filled/confirmed.
   */
  async requestBackdate(
    sessionId: string,
    branchIds: string[],
    userId: string,
  ): Promise<DailyClosingCountDetail> {
    const session = await dailyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(sessionId)
    }

    // Must be DRAFT and expired (missed)
    if (session.status !== 'DRAFT') {
      throw new BusinessRuleError('Hanya session DRAFT yang bisa diajukan backdate')
    }
    if (!this.isSessionExpired(session)) {
      throw new BusinessRuleError('Session belum expired, tidak perlu backdate')
    }
    if (session.is_backdate) {
      throw new BusinessRuleError('Session sudah diajukan sebagai backdate')
    }

    // Check no pending reopen request exists
    const existingRequest = await reopenRepository.findPendingByClosingId(sessionId)
    if (existingRequest) {
      throw new BusinessRuleError('Sudah ada permintaan backdate yang menunggu persetujuan')
    }

    // Mark as backdate
    await pool.query(
      `UPDATE daily_closing_counts SET is_backdate = true, updated_at = now(), updated_by = $2 WHERE id = $1`,
      [sessionId, userId],
    )

    // Create reopen request
    await reopenRepository.insertRequestDirect({
      closing_id: sessionId,
      requested_by: userId,
      reason: `Backdate opname untuk tanggal ${session.closing_date}`,
    })

    // Dispatch notification (non-blocking)
    try {
      const { notificationDispatcher } = await import('../notifications/notification-dispatcher.service')
      const companyId = (await getCompanyIdForBranch(session.branch_id)) ?? ''
      await notificationDispatcher.dispatch('OPNAME_REOPEN_REQUESTED', companyId, {
        entityId: sessionId,
        variables: {
          closing_date: session.closing_date,
          reason: `Backdate opname untuk tanggal ${session.closing_date}`,
          branch_name: session.branch_name ?? '',
          pic_name: session.pic_name ?? '',
        },
        excludeUserIds: [userId],
      })
    } catch {
      // Non-blocking
    }

    await AuditService.log('UPDATE', 'daily_closing_counts', sessionId, userId,
      { is_backdate: false }, { is_backdate: true })

    const detail = await dailyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!detail) throw new BusinessRuleError('Gagal mengambil detail setelah request backdate')
    return detail
  }

  /**
   * Recalculates theoretical_out (pemakaian POS) for all lines in a session.
   * Called when a backdate session is approved — POS data should be available by then.
   */
  async recalculateTheoreticalForSession(sessionId: string): Promise<void> {
    // Fetch session header
    const { rows: headerRows } = await pool.query(
      `SELECT branch_id, closing_date FROM daily_closing_counts WHERE id = $1`,
      [sessionId],
    )
    if (!headerRows.length) return

    const { branch_id: branchId, closing_date: closingDate } = headerRows[0]

    // Recalculate theoretical consumption
    const theoreticalMap = await this.getTheoreticalConsumptionForDate(branchId, closingDate)

    // Fetch lines
    const { rows: lines } = await pool.query(
      `SELECT id, product_id FROM daily_closing_count_lines WHERE closing_id = $1`,
      [sessionId],
    )

    // Batch update theoretical_out and expected_qty for each line
    for (const line of lines) {
      const theoreticalOut = theoreticalMap.get(line.product_id) ?? 0
      await pool.query(
        `UPDATE daily_closing_count_lines
         SET theoretical_out = $2,
             expected_qty = GREATEST(0, system_qty - $2)
         WHERE id = $1`,
        [line.id, theoreticalOut],
      )
    }
  }

  /**
   * Returns the branch opname config with defaults applied.
   * Used internally by other service methods.
   */
  async getBranchConfigWithDefaults(branchId: string): Promise<{
    variance_threshold_pct: number
    closing_time: string
    grace_period_minutes: number
  }> {
    const config = await dailyStockOpnameRepository.findConfig(branchId)
    return {
      variance_threshold_pct: config?.variance_threshold_pct ?? DEFAULT_VARIANCE_THRESHOLD_PCT,
      closing_time: config?.closing_time ?? DEFAULT_CLOSING_TIME,
      grace_period_minutes: config?.grace_period_minutes ?? DEFAULT_GRACE_PERIOD_MINUTES,
    }
  }

  // ─── DASHBOARD & REPORTS ─────────────────────────────────────────────────────

  /**
   * Returns today's opname status per accessible branch.
   * Requirements: 14.1, 14.2, 14.3, 14.4
   */
  async getDashboard(branchIds: string[]): Promise<OpnameDashboardItem[]> {
    return dailyStockOpnameRepository.getDashboardData(branchIds, todayJakarta())
  }

  /**
   * Returns aggregated variance report data.
   * Requirements: 13.1, 13.2, 13.3, 13.4
   */
  async getVarianceReport(branchIds: string[], filter: VarianceReportFilter): Promise<VarianceReportItem[]> {
    return dailyStockOpnameRepository.getVarianceReport(branchIds, filter)
  }

  /**
   * Exports variance report as CSV buffer with line-level data.
   * Columns: date, branch, product_code, product_name, expected_qty, actual_qty, variance_qty, variance_pct, variance_cost
   * Requirements: 13.5
   */
  async exportVarianceReport(branchIds: string[], filter: VarianceReportFilter): Promise<Buffer> {
    const data = await dailyStockOpnameRepository.getVarianceReportExportData(branchIds, filter)

    // UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF'
    const header = 'date,branch,product_code,product_name,expected_qty,actual_qty,variance_qty,variance_pct,variance_cost'
    const rows = data.map(item => {
      const date = typeof item.closing_date === 'string'
        ? item.closing_date
        : new Date(item.closing_date).toISOString().split('T')[0]
      const variancePct = item.variance_pct !== null ? item.variance_pct.toString() : ''
      return `${date},"${item.branch_name}",${item.product_code},"${item.product_name}",${item.expected_qty},${item.actual_qty},${item.variance_qty},${variancePct},${item.variance_cost}`
    })
    const csv = BOM + [header, ...rows].join('\n')
    return Buffer.from(csv, 'utf-8')
  }
}

export const dailyStockOpnameService = new DailyStockOpnameService()
