import { purchaseRequestsRepository } from './purchase-requests.repository'
import {
  PurchaseRequestNotFoundError, PurchaseRequestInvalidStatusError,
  PurchaseRequestEmptyLinesError, PurchaseRequestDuplicateError
} from './purchase-requests.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { isPostgresError } from '../../utils/postgres-error.util'
import { purchaseRequestApprovalService } from './purchase-requests-approval.service'
import { notificationDispatcher } from '../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../notifications/notification-events'
import type {
  CreatePurchaseRequestDto, UpdatePurchaseRequestDto,
  RejectPurchaseRequestDto,
  PurchaseRequestWithRelations, PurchaseRequestWithLines
} from './purchase-requests.types'

export class PurchaseRequestsService {
  async list(branchIds: string[], pagination: { page: number; limit: number }, filter?: { status?: string; branch_id?: string; date_from?: string; date_to?: string }, search?: string) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await purchaseRequestsRepository.findAll(branchIds, { limit: pagination.limit, offset }, filter, search)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async getById(id: string, companyId: string): Promise<PurchaseRequestWithLines> {
    const pr = await purchaseRequestsRepository.findWithLines(id, companyId)
    if (!pr) throw new PurchaseRequestNotFoundError(id)
    return pr
  }

  async create(companyId: string, dto: CreatePurchaseRequestDto, userId: string) {
    if (!dto.lines || dto.lines.length === 0) throw new PurchaseRequestEmptyLinesError()

    const branchCode = (await purchaseRequestsRepository.findBranchCodeById(dto.branch_id)) ?? 'XXX'

    try {
      const pr = await purchaseRequestsRepository.withTransaction(async (client) => {
        const requestNumber = await purchaseRequestsRepository.generateRequestNumber(client, companyId, branchCode)
        const created = await purchaseRequestsRepository.create(client, companyId, {
          branch_id: dto.branch_id,
          request_number: requestNumber,
          request_date: dto.request_date,
          needed_by_date: dto.needed_by_date,
          priority: dto.priority,
          notes: dto.notes,
          requested_by: userId,
          status: 'PENDING_APPROVAL',
          created_by: userId,
        })
        await purchaseRequestsRepository.insertLines(client, created.id, dto.lines)
        return created
      })

      await AuditService.log('CREATE', 'purchase_request', pr.id, userId, undefined, pr)
      const createdWithLines = await purchaseRequestsRepository.findWithLines(pr.id, companyId)
      if (createdWithLines) {
        await notificationDispatcher.dispatch(
          NOTIFICATION_EVENT_KEYS.PURCHASE_REQUEST_SUBMITTED,
          companyId,
          {
            entityId: pr.id,
            variables: {
              request_number: createdWithLines.request_number,
              branch_name: createdWithLines.branch_name,
            },
            excludeUserIds: [userId],
          }
        )
      }
      return createdWithLines
    } catch (e) {
      if (isPostgresError(e, '23505')) throw new PurchaseRequestDuplicateError('auto-generated')
      throw e
    }
  }

  async update(id: string, companyId: string, dto: UpdatePurchaseRequestDto, userId: string) {
    const existing = await purchaseRequestsRepository.findById(id, companyId)
    if (!existing) throw new PurchaseRequestNotFoundError(id)
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(existing.status)) {
      throw new PurchaseRequestInvalidStatusError(existing.status, 'DRAFT or PENDING_APPROVAL')
    }

    await purchaseRequestsRepository.withTransaction(async (client) => {
      await purchaseRequestsRepository.updateEditable(client, id, companyId, {
        needed_by_date: dto.needed_by_date,
        request_date: dto.request_date,
        notes: dto.notes,
        updated_by: userId,
      })
      if (dto.lines && dto.lines.length > 0) {
        await purchaseRequestsRepository.deleteLines(client, id)
        await purchaseRequestsRepository.insertLines(client, id, dto.lines)
      }
    })

    await AuditService.log('UPDATE', 'purchase_request', id, userId, existing)
    return purchaseRequestsRepository.findWithLines(id, companyId)
  }

  async submitForApproval(id: string, companyId: string, userId: string) {
    const existing = await purchaseRequestsRepository.findById(id, companyId)
    if (!existing) throw new PurchaseRequestNotFoundError(id)
    if (existing.status !== 'DRAFT') throw new PurchaseRequestInvalidStatusError(existing.status, 'DRAFT')

    await purchaseRequestsRepository.updateStatus(id, companyId, 'PENDING_APPROVAL', { updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_request', id, userId, { status: 'DRAFT' }, { status: 'PENDING_APPROVAL' })

    const pr = await purchaseRequestsRepository.findWithLines(id, companyId)
    if (pr) {
      await notificationDispatcher.dispatch(
        NOTIFICATION_EVENT_KEYS.PURCHASE_REQUEST_SUBMITTED,
        companyId,
        {
          entityId: id,
          variables: {
            request_number: pr.request_number,
            branch_name: pr.branch_name,
          },
          excludeUserIds: [userId],
        }
      )
    }
  }

  async reject(id: string, companyId: string, dto: RejectPurchaseRequestDto) {
    const existing = await purchaseRequestsRepository.findById(id, companyId)
    if (!existing) throw new PurchaseRequestNotFoundError(id)
    if (existing.status !== 'PENDING_APPROVAL') throw new PurchaseRequestInvalidStatusError(existing.status, 'PENDING_APPROVAL')

    await purchaseRequestsRepository.updateStatus(id, companyId, 'REJECTED', {
      rejected_reason: dto.rejected_reason,
      updated_by: dto.rejected_by,
    })
    await AuditService.log('UPDATE', 'purchase_request', id, dto.rejected_by, { status: 'PENDING_APPROVAL' }, { status: 'REJECTED', rejected_reason: dto.rejected_reason })

    const pr = await purchaseRequestsRepository.findWithLines(id, companyId)
    if (pr) {
      const creatorId = pr.created_by ?? pr.requested_by
      await notificationDispatcher.dispatch(
        NOTIFICATION_EVENT_KEYS.PURCHASE_REQUEST_REJECTED,
        companyId,
        {
          entityId: id,
          variables: {
            request_number: pr.request_number,
            branch_name: pr.branch_name,
            rejected_reason: dto.rejected_reason,
          },
          additionalRecipientIds: creatorId ? [creatorId] : [],
          excludeUserIds: [dto.rejected_by],
        }
      )
    }
  }

  async cancel(id: string, companyId: string, userId: string) {
    const existing = await purchaseRequestsRepository.findById(id, companyId)
    if (!existing) throw new PurchaseRequestNotFoundError(id)
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(existing.status)) {
      throw new PurchaseRequestInvalidStatusError(existing.status, 'DRAFT or PENDING_APPROVAL')
    }

    await purchaseRequestsRepository.updateStatus(id, companyId, 'CANCELLED', { updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_request', id, userId, { status: existing.status }, { status: 'CANCELLED' })
  }

  async delete(id: string, companyId: string, userId: string) {
    const existing = await purchaseRequestsRepository.findById(id, companyId)
    if (!existing) throw new PurchaseRequestNotFoundError(id)

    const deleted = await purchaseRequestsRepository.softDelete(id, companyId, userId)
    if (!deleted) throw new PurchaseRequestInvalidStatusError(existing.status, 'DRAFT, REJECTED, or CANCELLED')

    await AuditService.log('DELETE', 'purchase_request', id, userId, existing)
  }

  async getApprovalData(id: string, companyId: string) {
    return purchaseRequestApprovalService.getApprovalData(id, companyId)
  }

  async approveAndGenerate(id: string, companyId: string, dto: { supplier_selections: Array<{ supplier_id: string; lines: Array<{ pr_line_id: string; qty_approved: number }>; payment_type: 'CASH' | 'CREDIT'; payment_terms_days?: number | null; expected_delivery_date?: string | null; notes?: string | null }> }, userId: string) {
    return purchaseRequestApprovalService.approveAndGenerate(id, companyId, dto, userId)
  }
}

export const purchaseRequestsService = new PurchaseRequestsService()
