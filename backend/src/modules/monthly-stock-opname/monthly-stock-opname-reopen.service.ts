import { monthlyStockOpnameRepository } from './monthly-stock-opname.repository'
import { monthlyOpnameReopenRepository } from './monthly-stock-opname-reopen.repository'
import { stockRepository } from '../stock/stock.repository'
import { AuditService } from '../monitoring/monitoring.service'
import { PermissionError, ValidationError, BusinessRuleError } from '../../utils/errors.base'
import {
  MonthlyOpnameNotFoundError,
  MonthlyOpnameNotConfirmedError,
  MonthlyOpnameReopenPendingExistsError,
  MonthlyOpnameReopenAlreadyRespondedError,
  MonthlyOpnameReopenNotFoundError,
} from './monthly-stock-opname.errors'
import type { PermissionMatrix } from '../permissions/permissions.types'
import type {
  CreateReopenRequestDto,
  RespondReopenRequestDto,
  MonthlyOpnameReopenRequestWithRelations,
} from './monthly-stock-opname.types'

// ─── REOPEN SERVICE ───────────────────────────────────────────────────────────

export class MonthlyStockOpnameReopenService {

  // ─── CREATE REOPEN REQUEST ──────────────────────────────────────────────────

  async createReopenRequest(
    opnameId: string,
    branchIds: string[],
    userId: string,
    dto: CreateReopenRequestDto,
  ): Promise<MonthlyOpnameReopenRequestWithRelations> {
    const session = await monthlyStockOpnameRepository.findByIdAccessible(opnameId, branchIds)
    if (!session) throw new MonthlyOpnameNotFoundError(opnameId)

    if (session.status !== 'CONFIRMED') {
      throw new MonthlyOpnameNotConfirmedError(session.status)
    }

    const pendingRequest = await monthlyOpnameReopenRepository.findPendingByOpnameId(opnameId)
    if (pendingRequest) {
      throw new MonthlyOpnameReopenPendingExistsError()
    }

    const insertedRequest = await monthlyOpnameReopenRepository.insertRequestDirect({
      opname_id: opnameId,
      requested_by: userId,
      reason: dto.reason,
    })

    await AuditService.log('CREATE', 'monthly_opname_reopen_request', insertedRequest.id, userId, undefined, {
      opname_id: opnameId,
      reason: dto.reason,
      status: 'PENDING',
    })

    const result = await monthlyOpnameReopenRepository.findByIdWithRelations(insertedRequest.id)
    return result!
  }

  // ─── APPROVE REOPEN REQUEST ─────────────────────────────────────────────────

  async approveReopenRequest(
    requestId: string,
    branchIds: string[],
    userId: string,
    dto: RespondReopenRequestDto,
    userPermissions?: PermissionMatrix,
  ): Promise<MonthlyOpnameReopenRequestWithRelations> {
    const request = await monthlyOpnameReopenRepository.findById(requestId)
    if (!request) throw new MonthlyOpnameReopenNotFoundError(requestId)
    if (request.status !== 'PENDING') throw new MonthlyOpnameReopenAlreadyRespondedError()

    const session = await monthlyStockOpnameRepository.findByIdAccessible(request.opname_id, branchIds)
    if (!session) throw new MonthlyOpnameNotFoundError(request.opname_id)

    this.validateApprovePermission(userPermissions)

    // Execute reversal within transaction
    await monthlyOpnameReopenRepository.withTransaction(async (client) => {
      // Update request status
      await monthlyOpnameReopenRepository.updateStatus(client, requestId, {
        status: 'APPROVED',
        responded_by: userId,
        responded_at: new Date().toISOString(),
        response_note: dto.response_note ?? null,
      })

      // Fetch original stock movements
      const movements = await monthlyStockOpnameRepository.getMovementsByOpnameId(client, request.opname_id)

      // Create counter-movements
      for (const movement of movements) {
        const reversalType = movement.movement_type === 'OUT_WASTE'
          ? 'IN_REVERSAL'
          : movement.movement_type === 'IN_ADJUSTMENT'
            ? 'OUT_REVERSAL'
            : null

        if (!reversalType) {
          throw new BusinessRuleError(`Unexpected movement type for reversal: ${movement.movement_type}`)
        }

        const balance = await stockRepository.getBalanceForUpdate(client, session.warehouse_id, movement.product_id)
        const currentQty = balance ? Number(balance.qty) : 0
        const currentAvgCost = balance ? Number(balance.avg_cost) : 0

        let newQty: number
        let newAvgCost: number

        if (reversalType === 'IN_REVERSAL') {
          newQty = currentQty + Number(movement.qty)
          newAvgCost = newQty > 0
            ? (currentQty * currentAvgCost + Number(movement.qty) * Number(movement.cost_per_unit)) / newQty
            : Number(movement.cost_per_unit)
        } else {
          newQty = currentQty - Number(movement.qty)
          newAvgCost = currentAvgCost
        }

        await stockRepository.createMovement(client, {
          warehouse_id: session.warehouse_id,
          product_id: movement.product_id,
          movement_type: reversalType,
          qty: Number(movement.qty),
          cost_per_unit: Number(movement.cost_per_unit),
          reference_type: 'monthly_stock_opname',
          reference_id: request.opname_id,
          notes: `Reversal SO Bulanan reopen - ${movement.movement_type}`,
          movement_date: session.opname_date,
          created_by: userId,
        }, newQty)

        await stockRepository.upsertBalance(client, session.warehouse_id, movement.product_id, newQty, newAvgCost)
      }

      // Update session status to REOPENED
      await monthlyStockOpnameRepository.updateHeaderStatus(client, request.opname_id, {
        status: 'REOPENED',
        reopened_by: userId,
        reopened_at: new Date().toISOString(),
        updated_by: userId,
      })
    })

    await AuditService.log('UPDATE', 'monthly_opname_reopen_request', requestId, userId,
      { status: 'PENDING' }, { status: 'APPROVED', response_note: dto.response_note ?? null })

    const result = await monthlyOpnameReopenRepository.findByIdWithRelations(requestId)
    return result!
  }

  // ─── REJECT REOPEN REQUEST ──────────────────────────────────────────────────

  async rejectReopenRequest(
    requestId: string,
    branchIds: string[],
    userId: string,
    dto: RespondReopenRequestDto,
    userPermissions?: PermissionMatrix,
  ): Promise<MonthlyOpnameReopenRequestWithRelations> {
    if (!dto.response_note || dto.response_note.trim().length === 0) {
      throw new ValidationError('Catatan penolakan (response_note) wajib diisi saat menolak reopen request')
    }

    const request = await monthlyOpnameReopenRepository.findById(requestId)
    if (!request) throw new MonthlyOpnameReopenNotFoundError(requestId)
    if (request.status !== 'PENDING') throw new MonthlyOpnameReopenAlreadyRespondedError()

    const session = await monthlyStockOpnameRepository.findByIdAccessible(request.opname_id, branchIds)
    if (!session) throw new MonthlyOpnameNotFoundError(request.opname_id)

    this.validateApprovePermission(userPermissions)

    // Direct update — no transaction needed for single-row status change
    await monthlyOpnameReopenRepository.updateStatusDirect(requestId, {
      status: 'REJECTED',
      responded_by: userId,
      responded_at: new Date().toISOString(),
      response_note: dto.response_note ?? null,
    })

    await AuditService.log('UPDATE', 'monthly_opname_reopen_request', requestId, userId,
      { status: 'PENDING' }, { status: 'REJECTED', response_note: dto.response_note ?? null })

    const result = await monthlyOpnameReopenRepository.findByIdWithRelations(requestId)
    return result!
  }

  // ─── GET REOPEN REQUESTS ────────────────────────────────────────────────────

  async getReopenRequests(
    opnameId: string,
    branchIds: string[],
  ): Promise<MonthlyOpnameReopenRequestWithRelations[]> {
    const session = await monthlyStockOpnameRepository.findByIdAccessible(opnameId, branchIds)
    if (!session) throw new MonthlyOpnameNotFoundError(opnameId)

    return monthlyOpnameReopenRepository.findByOpnameId(opnameId)
  }

  async listReopenRequests(
    branchIds: string[],
    status?: 'PENDING' | 'APPROVED' | 'REJECTED',
  ): Promise<MonthlyOpnameReopenRequestWithRelations[]> {
    return monthlyOpnameReopenRepository.findRequestsWithRelations(branchIds, status)
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────────

  private validateApprovePermission(userPermissions?: PermissionMatrix): void {
    const hasApprove = userPermissions?.monthly_stock_opname?.approve === true
    if (!hasApprove) {
      throw new PermissionError('Anda tidak memiliki izin approve untuk modul SO bulanan', {
        permission: 'approve',
        resource: 'monthly_stock_opname',
      })
    }
  }
}

export const monthlyStockOpnameReopenService = new MonthlyStockOpnameReopenService()
