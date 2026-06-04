import { dailyStockOpnameRepository } from './daily-stock-opname.repository'
import { reopenRepository } from './daily-stock-opname-reopen.repository'
import { classificationRepository } from './daily-stock-opname-classification.repository'
import { stockRepository } from '../stock/stock.repository'
import { AuditService } from '../monitoring/monitoring.service'
import { notificationDispatcher } from '../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../notifications/notification-events'
import { getCompanyIdForBranch } from '../../utils/branch-access.util'
import { PermissionError } from '../../utils/errors.base'
import {
  OpnameNotFoundError,
  OpnameNotEligibleForReopenError,
  OpnameReopenPendingExistsError,
  OpnameReopenAlreadyRespondedError,
  OpnameReopenNotFoundError,
} from './daily-stock-opname.errors'
import type { PermissionMatrix } from '../permissions/permissions.types'
import type {
  CreateReopenRequestDto,
  RespondReopenRequestDto,
  OpnameReopenRequestWithRelations,
} from './daily-stock-opname-reopen.types'

// ─── REOPEN SERVICE ───────────────────────────────────────────────────────────

export class DailyStockOpnameReopenService {

  // ─── CREATE REOPEN REQUEST ──────────────────────────────────────────────────

  /**
   * Creates a reopen request for a confirmed/flagged session.
   *
   * Validations:
   * 1. Session exists and user has branch access
   * 2. Session status is CONFIRMED or FLAGGED
   * 3. No existing PENDING request for this session
   * 4. Reason is non-empty (validated by Zod schema upstream)
   *
   * Side effects:
   * - Inserts record into opname_reopen_requests
   * - Dispatches OPNAME_REOPEN_REQUESTED notification to approvers
   * - Logs audit entry
   */
  async createReopenRequest(
    sessionId: string,
    branchIds: string[],
    userId: string,
    dto: CreateReopenRequestDto,
  ): Promise<OpnameReopenRequestWithRelations> {
    // 1. Fetch session and validate access
    const session = await dailyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(sessionId)
    }

    // 2. Validate session status is CONFIRMED or FLAGGED
    if (session.status !== 'CONFIRMED' && session.status !== 'FLAGGED') {
      throw new OpnameNotEligibleForReopenError(session.status)
    }

    // 3. Check no pending request exists
    const pendingRequest = await reopenRepository.findPendingByClosingId(sessionId)
    if (pendingRequest) {
      throw new OpnameReopenPendingExistsError()
    }

    // 4. Insert request (single insert, no transaction needed)
    const insertedRequest = await reopenRepository.insertRequestDirect({
      closing_id: sessionId,
      requested_by: userId,
      reason: dto.reason,
    })

    // 5. Dispatch notification to approvers
    const companyId = await getCompanyIdForBranch(session.branch_id)
    if (companyId) {
      await notificationDispatcher.dispatch(
        NOTIFICATION_EVENT_KEYS.OPNAME_REOPEN_REQUESTED,
        companyId,
        {
          entityId: sessionId,
          variables: {
            session_id: sessionId,
            pic_name: session.pic_name ?? '',
            branch_name: session.branch_name ?? '',
            closing_date: session.closing_date,
            reason: dto.reason,
          },
          excludeUserIds: [userId],
        },
      )
    }

    // 6. Audit log
    await AuditService.log(
      'CREATE',
      'opname_reopen_request',
      insertedRequest.id,
      userId,
      undefined,
      { closing_id: sessionId, reason: dto.reason, status: 'PENDING' },
    )

    // 7. Return with relations
    const result = await reopenRepository.findByIdWithRelations(insertedRequest.id)
    return result!
  }

  // ─── APPROVE REOPEN REQUEST ─────────────────────────────────────────────────

  /**
   * Approves a pending reopen request. This is the critical operation that:
   * 1. Updates request status to APPROVED
   * 2. Creates counter-movements for all session stock movements
   * 3. Updates stock balances to reflect reversals
   * 4. Deletes all variance classification entries
   * 5. Changes session status to REOPENED
   *
   * All within a single transaction for atomicity.
   */
  async approveReopenRequest(
    requestId: string,
    branchIds: string[],
    userId: string,
    dto: RespondReopenRequestDto,
    userPermissions?: PermissionMatrix,
  ): Promise<OpnameReopenRequestWithRelations> {
    // 1. Fetch and validate request
    const request = await reopenRepository.findById(requestId)
    if (!request) {
      throw new OpnameReopenNotFoundError(requestId)
    }
    if (request.status !== 'PENDING') {
      throw new OpnameReopenAlreadyRespondedError()
    }

    // 2. Fetch session and validate branch access + approve permission
    const session = await dailyStockOpnameRepository.findByIdAccessible(request.closing_id, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(request.closing_id)
    }

    this.validateApprovePermission(userPermissions)

    // 3. Execute within transaction
    await reopenRepository.withTransaction(async (client) => {
      // 3a. Update request status to APPROVED
      await reopenRepository.updateStatus(client, requestId, {
        status: 'APPROVED',
        responded_by: userId,
        responded_at: new Date().toISOString(),
        response_note: dto.response_note ?? null,
      })

      // 3b. Fetch original stock movements for this session
      const movements = await reopenRepository.getMovementsByClosingId(client, request.closing_id)

      // 3c. Create counter-movements and update balances
      for (const movement of movements) {
        const reversalType = movement.movement_type === 'OUT_WASTE'
          ? 'IN_REVERSAL'
          : 'OUT_REVERSAL' // for IN_ADJUSTMENT

        // Get current balance for the product
        const balance = await stockRepository.getBalanceForUpdate(
          client, session.warehouse_id, movement.product_id,
        )
        const currentQty = balance ? Number(balance.qty) : 0
        const currentAvgCost = balance ? Number(balance.avg_cost) : 0

        let newQty: number
        let newAvgCost: number

        if (reversalType === 'IN_REVERSAL') {
          // Reversing OUT_WASTE: add qty back
          newQty = currentQty + Number(movement.qty)
          newAvgCost = newQty > 0
            ? (currentQty * currentAvgCost + Number(movement.qty) * Number(movement.cost_per_unit)) / newQty
            : Number(movement.cost_per_unit)
        } else {
          // Reversing IN_ADJUSTMENT: subtract qty
          newQty = currentQty - Number(movement.qty)
          newAvgCost = currentAvgCost // avg cost doesn't change on OUT
        }

        await stockRepository.createMovement(client, {
          warehouse_id: session.warehouse_id,
          product_id: movement.product_id,
          movement_type: reversalType,
          qty: Number(movement.qty),
          cost_per_unit: Number(movement.cost_per_unit),
          reference_type: 'daily_closing_count',
          reference_id: request.closing_id,
          notes: `Reversal opname reopen - ${movement.movement_type}`,
          movement_date: session.closing_date,
          created_by: userId,
        }, newQty)

        await stockRepository.upsertBalance(
          client, session.warehouse_id, movement.product_id, newQty, newAvgCost,
        )
      }

      // 3d. Delete variance classifications
      await classificationRepository.deleteByClosingId(client, request.closing_id)

      // 3e. Update session status to REOPENED
      await dailyStockOpnameRepository.updateHeaderStatus(client, request.closing_id, {
        status: 'REOPENED',
        updated_by: userId,
      })
    })

    // 4. Audit log
    await AuditService.log(
      'UPDATE',
      'opname_reopen_request',
      requestId,
      userId,
      { status: 'PENDING' },
      { status: 'APPROVED', response_note: dto.response_note ?? null },
    )

    // 5. Return updated request with relations
    const result = await reopenRepository.findByIdWithRelations(requestId)
    return result!
  }

  // ─── REJECT REOPEN REQUEST ──────────────────────────────────────────────────

  /**
   * Rejects a pending reopen request. No stock changes occur.
   * Simply updates request status and allows future requests.
   */
  async rejectReopenRequest(
    requestId: string,
    branchIds: string[],
    userId: string,
    dto: RespondReopenRequestDto,
    userPermissions?: PermissionMatrix,
  ): Promise<OpnameReopenRequestWithRelations> {
    // 1. Fetch and validate request
    const request = await reopenRepository.findById(requestId)
    if (!request) {
      throw new OpnameReopenNotFoundError(requestId)
    }
    if (request.status !== 'PENDING') {
      throw new OpnameReopenAlreadyRespondedError()
    }

    // 2. Fetch session and validate branch access + approve permission
    const session = await dailyStockOpnameRepository.findByIdAccessible(request.closing_id, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(request.closing_id)
    }

    this.validateApprovePermission(userPermissions)

    // 3. Update request status within transaction
    await reopenRepository.withTransaction(async (client) => {
      await reopenRepository.updateStatus(client, requestId, {
        status: 'REJECTED',
        responded_by: userId,
        responded_at: new Date().toISOString(),
        response_note: dto.response_note ?? null,
      })
    })

    // 4. Audit log
    await AuditService.log(
      'UPDATE',
      'opname_reopen_request',
      requestId,
      userId,
      { status: 'PENDING' },
      { status: 'REJECTED', response_note: dto.response_note ?? null },
    )

    // 5. Return updated request with relations
    const result = await reopenRepository.findByIdWithRelations(requestId)
    return result!
  }

  // ─── GET REOPEN REQUESTS ────────────────────────────────────────────────────

  /**
   * Returns all reopen requests for a session (audit trail).
   */
  async getReopenRequests(
    sessionId: string,
    branchIds: string[],
  ): Promise<OpnameReopenRequestWithRelations[]> {
    // Validate session exists and user has branch access
    const session = await dailyStockOpnameRepository.findByIdAccessible(sessionId, branchIds)
    if (!session) {
      throw new OpnameNotFoundError(sessionId)
    }

    return reopenRepository.findByClosingId(sessionId)
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────────

  private validateApprovePermission(userPermissions?: PermissionMatrix): void {
    const hasApprove = userPermissions?.daily_stock_opname?.approve === true
    if (!hasApprove) {
      throw new PermissionError('Anda tidak memiliki izin approve untuk modul opname harian', {
        permission: 'approve',
        resource: 'daily_stock_opname',
      })
    }
  }
}

export const dailyStockOpnameReopenService = new DailyStockOpnameReopenService()
