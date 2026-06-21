import { pool } from '../../config/db'
import { dailyStockOpnameRepository } from './daily-stock-opname.repository'
import { classificationRepository } from './daily-stock-opname-classification.repository'
import { stockAdjustmentsService } from '../stock-adjustments/stock-adjustments.service'
import { AppError, ErrorCategory } from '../../utils/errors.base'
import { AuditService } from '../monitoring/monitoring.service'
import { notificationDispatcher } from '../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../notifications/notification-events'
import { logInfo, logWarn, logError } from '../../config/logger'
import type { PermissionMatrix } from '../permissions/permissions.types'
import type {
  ClassifyDto,
  ClassifyLineEntry,
  ClassificationSummary,
  ClassificationsResponse,
  InsertClassificationEntry,
  DailyClosingCountLine,
} from './daily-stock-opname.types'

// ─── CLASSIFICATION SERVICE ───────────────────────────────────────────────────

export class DailyStockOpnameClassificationService {

  /**
   * Classify variance entries for a confirmed/flagged opname session.
   *
   * Steps:
   * 1. Validate session status (CONFIRMED or FLAGGED)
   * 2. Validate caller is PIC or has 'approve' permission
   * 3. Validate company_id and branch_id scoping
   * 4. Fetch lines with negative variance
   * 5. Validate sum of classified quantities per line equals abs(variance_qty)
   * 6. Validate shortage entries have shortage_assigned_to set
   * 7. Validate shortage employees are active
   * 8. If re-submission: log previous state to AuditService, increment version
   * 9. Delete old classifications and insert new ones in transaction
   * 10. Dispatch notifications for SHORTAGE entries
   * 11. Return classification summary
   *
   * Requirements: 21.6, 21.7, 21.8, 21.9, 21.10, 21.11, 21.12, 21.13, 21.14, 21.16, 21.17, 21.18
   */
  async classify(
    sessionId: string,
    branchIds: string[],
    dto: ClassifyDto,
    userId: string,
    userPermissions: PermissionMatrix | undefined,
  ): Promise<ClassificationSummary> {
    // 1. Fetch session and validate access
    const session = await dailyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!session) {
      throw new AppError(
        'Sesi opname tidak ditemukan',
        404,
        'OPNAME_NOT_FOUND',
        undefined,
        undefined,
        ErrorCategory.NOT_FOUND,
      )
    }

    // 2. Validate session is CONFIRMED or FLAGGED
    if (session.status !== 'CONFIRMED' && session.status !== 'FLAGGED') {
      throw new AppError(
        'Klasifikasi hanya dapat dilakukan pada sesi CONFIRMED/FLAGGED',
        400,
        'OPNAME_NOT_CONFIRMED',
        undefined,
        undefined,
        ErrorCategory.BUSINESS_RULE,
      )
    }

    // 3. Validate caller is PIC or has 'approve' permission
    const isPic = session.pic_user_id === userId
    const hasApprovePermission = userPermissions?.daily_stock_opname?.approve === true
    if (!isPic && !hasApprovePermission) {
      throw new AppError(
        'Hanya PIC atau user dengan permission approve yang dapat mengklasifikasi',
        403,
        'OPNAME_UNAUTHORIZED',
        undefined,
        undefined,
        ErrorCategory.PERMISSION,
      )
    }

    // 4. Company and branch scoping (session already validated via branchIds in findByIdAccessible)
    const companyId = session.company_id
    const branchId = session.branch_id

    // 5. Fetch lines with negative variance for this session
    const negativeLines = session.lines.filter(
      (l) => l.variance_qty !== null && l.variance_qty < 0,
    )
    const negativeLinesMap = new Map<string, DailyClosingCountLine>(
      negativeLines.map((l) => [l.id, l]),
    )

    // 6. Validate sum of classified quantities per line equals abs(variance_qty)
    const entriesByLine = new Map<string, ClassifyLineEntry[]>()
    for (const entry of dto.entries) {
      const existing = entriesByLine.get(entry.line_id) || []
      existing.push(entry)
      entriesByLine.set(entry.line_id, existing)
    }

    for (const [lineId, entries] of entriesByLine) {
      const line = negativeLinesMap.get(lineId)
      if (!line) {
        throw new AppError(
          `Line ${lineId} tidak ditemukan atau tidak memiliki variance negatif`,
          400,
          'CLASSIFICATION_SUM_MISMATCH',
          undefined,
          undefined,
          ErrorCategory.BUSINESS_RULE,
        )
      }

      const sum = entries.reduce((acc, e) => acc + e.qty, 0)
      const absVariance = Math.abs(line.variance_qty!)

      // Round both to 4 decimal places before comparison (matches NUMERIC(20,4) precision)
      const roundedSum = Math.round(sum * 10000) / 10000
      const roundedAbsVariance = Math.round(absVariance * 10000) / 10000
      if (roundedSum !== roundedAbsVariance) {
        throw new AppError(
          `Total klasifikasi (${sum}) tidak sama dengan abs variance (${absVariance}) untuk produk ${line.product_name}`,
          400,
          'CLASSIFICATION_SUM_MISMATCH',
          undefined,
          undefined,
          ErrorCategory.BUSINESS_RULE,
        )
      }
    }

    // 7. Validate shortage entries have shortage_assigned_to set
    const shortageEntries = dto.entries.filter((e) => e.variance_category === 'SHORTAGE')
    for (const entry of shortageEntries) {
      if (!entry.shortage_assigned_to) {
        throw new AppError(
          'Employee harus dipilih untuk klasifikasi shortage',
          400,
          'SHORTAGE_EMPLOYEE_REQUIRED',
          undefined,
          undefined,
          ErrorCategory.BUSINESS_RULE,
        )
      }
    }

    // 8. Validate shortage employees are active
    await this.validateShortageEmployees(dto.entries, companyId)

    // 9–10. Execute in transaction with row-level lock to prevent race conditions.
    // SELECT FOR UPDATE on the session row ensures only one concurrent classify() can proceed.
    let previousAuditData: { previous_entries: unknown[]; previous_version: number } | null = null

    await dailyStockOpnameRepository.withTransaction(async (client) => {
      // Lock session row to prevent concurrent re-submissions
      const { rows: lockedRows } = await client.query(
        `SELECT classification_version FROM daily_closing_counts WHERE id = $1 FOR UPDATE`,
        [sessionId],
      )
      const currentVersion = Number(lockedRows[0]?.classification_version ?? 0)

      // Check existing entries within transaction (after lock acquired)
      const { rows: existingRows } = await client.query(
        `SELECT line_id, variance_category, qty, shortage_assigned_to, classified_by, classified_at
         FROM variance_classification_lines WHERE closing_id = $1`,
        [sessionId],
      )
      const isResubmission = existingRows.length > 0

      // Capture previous state for audit (read inside TX, log outside)
      if (isResubmission) {
        previousAuditData = {
          previous_entries: existingRows,
          previous_version: currentVersion,
        }
      }

      // Increment classification_version on session
      await client.query(
        `UPDATE daily_closing_counts
         SET classification_version = classification_version + 1
         WHERE id = $1`,
        [sessionId],
      )

      // Delete existing classifications (replace strategy)
      await classificationRepository.deleteByClosingId(client, sessionId)

      // Build insert entries
      const insertEntries: InsertClassificationEntry[] = dto.entries.map((entry) => ({
        closing_id: sessionId,
        line_id: entry.line_id,
        variance_category: entry.variance_category,
        qty: entry.qty,
        shortage_assigned_to: entry.shortage_assigned_to,
        shortage_note: entry.shortage_note,
        classified_by: userId,
        company_id: companyId,
        branch_id: branchId,
      }))

      // Insert new classification entries
      await classificationRepository.insertEntries(client, insertEntries)
    })

    // Audit log AFTER transaction commits (prevents deadlock, accepts audit-loss tradeoff on failure)
    if (previousAuditData) {
      try {
        await AuditService.log(
          'CLASSIFICATION_REPLACED',
          'daily_closing_count',
          sessionId,
          userId,
          previousAuditData,
        )
      } catch (auditErr) {
        // Log but don't rethrow — data is already committed
        logWarn('Audit log failed for classification replacement', { sessionId, error: auditErr })
      }
    }

    // 10b. Auto-generate journal for WASTE classification entries (best-effort)
    // Creates a stock_adjustment record + confirms it → triggers generateWasteJournal().
    // Stock is NOT deducted again (isShortageConversion path) because source_closing_id is set.
    await this.generateWasteJournalFromClassification(
      sessionId, branchIds, dto.entries, negativeLinesMap, session, userId,
    )

    // 11. Dispatch notifications for SHORTAGE entries (best-effort, don't fail the request)
    // Resolve employee IDs to user_ids for notification recipients
    const shortageEmployeeIds = [...new Set(shortageEntries.map((e) => e.shortage_assigned_to!).filter(Boolean))]
    let employeeUserMap = new Map<string, string>()
    if (shortageEmployeeIds.length > 0) {
      const { rows: empRows } = await pool.query(
        `SELECT id, user_id FROM employees WHERE id = ANY($1::uuid[]) AND user_id IS NOT NULL`,
        [shortageEmployeeIds],
      )
      employeeUserMap = new Map(empRows.map((r: { id: string; user_id: string }) => [r.id, r.user_id]))
    }

    for (const entry of shortageEntries) {
      const line = negativeLinesMap.get(entry.line_id)
      if (!line) continue

      const recipientUserId = employeeUserMap.get(entry.shortage_assigned_to!)
      if (!recipientUserId) continue // Employee has no user account — skip notification

      try {
        await notificationDispatcher.dispatch(
          NOTIFICATION_EVENT_KEYS.OPNAME_SHORTAGE_ASSIGNED,
          companyId,
          {
            entityId: sessionId,
            variables: {
              product_name: line.product_name,
              qty: String(entry.qty),
              uom: line.uom,
              pic_name: session.pic_name,
              note: entry.shortage_note ?? '-',
              session_id: sessionId,
            },
            additionalRecipientIds: [recipientUserId],
            excludeUserIds: [],
          },
        )
      } catch {
        // Notification failure shouldn't block response — data is already committed
      }
    }

    // 12. Return updated classification summary
    return classificationRepository.getSummary(sessionId)
  }

  /**
   * Validate that all shortage_assigned_to employees are active and not deleted.
   * Queries the employees table with conditions:
   *   is_active = true AND deleted_at IS NULL AND company_id = companyId
   *
   * Requirements: 21.11
   */
  private async validateShortageEmployees(
    entries: ClassifyLineEntry[],
    _companyId: string,
  ): Promise<void> {
    const shortageEntries = entries.filter((e) => e.variance_category === 'SHORTAGE')
    if (shortageEntries.length === 0) return

    const employeeIds = [...new Set(shortageEntries.map((e) => e.shortage_assigned_to!))]

    const { rows } = await pool.query(
      `SELECT id FROM employees
       WHERE id = ANY($1::uuid[])
         AND is_active = true
         AND deleted_at IS NULL`,
      [employeeIds],
    )

    const activeIds = new Set(rows.map((r: { id: string }) => r.id))
    const inactiveIds = employeeIds.filter((id) => !activeIds.has(id))

    if (inactiveIds.length > 0) {
      throw new AppError(
        'Karyawan tidak aktif atau sudah dihapus tidak dapat di-assign shortage',
        400,
        'SHORTAGE_EMPLOYEE_INACTIVE',
        undefined,
        undefined,
        ErrorCategory.BUSINESS_RULE,
      )
    }
  }

  /**
   * Auto-generate waste journal for WASTE classification entries.
   *
   * Reuses the existing stock-adjustments flow:
   * 1. Create stock_adjustment with source_closing_id (marks as shortage-conversion → no stock re-deduction)
   * 2. Auto-confirm → triggers generateWasteJournal() internally
   *
   * Idempotency: blocks if a CONFIRMED stock_adjustment already exists for this closing session.
   * Best-effort: failures are logged but do not fail the classify() response.
   */
  private async generateWasteJournalFromClassification(
    sessionId: string,
    branchIds: string[],
    entries: ClassifyLineEntry[],
    negativeLinesMap: Map<string, DailyClosingCountLine>,
    session: { warehouse_id: string; branch_id: string; company_id: string; closing_date: string; position_id: string | null },
    userId: string,
  ): Promise<void> {
    const wasteEntries = entries.filter((e) => e.variance_category === 'WASTE')
    if (wasteEntries.length === 0) return

    try {
      // Idempotency check: if a confirmed stock_adjustment already exists for this closing, skip
      const { rows: existingSa } = await pool.query(
        `SELECT id FROM stock_adjustments
         WHERE source_closing_id = $1 AND status = 'CONFIRMED' AND deleted_at IS NULL
         LIMIT 1`,
        [sessionId],
      )
      if (existingSa.length > 0) {
        logInfo('[ClassificationJournal] Stock adjustment already exists for closing, skipping', {
          sessionId, existingSaId: existingSa[0].id,
        })
        return
      }

      // Cancel any existing DRAFT stock_adjustment for this closing (from previous classification attempt)
      const { rows: draftSa } = await pool.query(
        `SELECT id FROM stock_adjustments
         WHERE source_closing_id = $1 AND status = 'DRAFT' AND deleted_at IS NULL`,
        [sessionId],
      )
      for (const draft of draftSa) {
        try {
          await stockAdjustmentsService.cancel(draft.id, branchIds, { cancelled_by: userId })
        } catch {
          // If cancel fails (e.g., already cancelled), just continue
        }
      }

      // Build waste lines from classification entries + closing count lines
      const wasteLines: { product_id: string; qty: number; notes: string | null }[] = []
      for (const entry of wasteEntries) {
        const line = negativeLinesMap.get(entry.line_id)
        if (!line) continue
        wasteLines.push({
          product_id: line.product_id,
          qty: entry.qty,
          notes: `Opname ${session.closing_date} - ${line.product_name}`,
        })
      }

      if (wasteLines.length === 0) return

      // Create stock_adjustment via existing service method (reuses full flow)
      const saId = await stockAdjustmentsService.createFromShortage(branchIds, {
        warehouse_id: session.warehouse_id,
        branch_id: session.branch_id,
        company_id: session.company_id,
        adjustment_date: session.closing_date,
        notes: `Auto from opname classification - ${session.closing_date}`,
        source_closing_id: sessionId,
        source_position_id: session.position_id,
        lines: wasteLines,
        created_by: userId,
      })

      // Auto-confirm → triggers journal generation (non-blocking on journal failure)
      const result = await stockAdjustmentsService.confirm(saId, branchIds, { confirmed_by: userId })

      logInfo('[ClassificationJournal] Waste journal generated from classification', {
        sessionId,
        stockAdjustmentId: saId,
        journalPending: result.journal_pending ?? false,
        wasteLineCount: wasteLines.length,
      })
    } catch (err) {
      // Best-effort: classification succeeded, journal generation is secondary
      logError('[ClassificationJournal] Failed to generate waste journal from classification', {
        sessionId,
        error: err instanceof Error ? err.message : 'Unknown',
      })
    }
  }

  /**
   * Fetch all classification entries with employee names and compute summary.
   *
   * Requirements: 21.13, 21.14
   */
  async getClassifications(
    sessionId: string,
    branchIds: string[],
  ): Promise<ClassificationsResponse> {
    // Validate session exists and is accessible
    const session = await dailyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!session) {
      throw new AppError(
        'Sesi opname tidak ditemukan',
        404,
        'OPNAME_NOT_FOUND',
        undefined,
        undefined,
        ErrorCategory.NOT_FOUND,
      )
    }

    const entries = await classificationRepository.findByClosingId(sessionId, branchIds)
    const summary = await classificationRepository.getSummary(sessionId)

    return { entries, summary }
  }
}

export const dailyStockOpnameClassificationService = new DailyStockOpnameClassificationService()
