import { pool } from '../../config/db'
import { purchaseRequestsRepository } from './purchase-requests.repository'
import {
  PurchaseRequestNotFoundError, PurchaseRequestInvalidStatusError,
  PurchaseRequestEmptyLinesError, PurchaseRequestDuplicateError
} from './purchase-requests.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { isPostgresError } from '../../utils/postgres-error.util'
import type {
  CreatePurchaseRequestDto, UpdatePurchaseRequestDto,
  ApprovePurchaseRequestDto, RejectPurchaseRequestDto,
  PurchaseRequestWithRelations, PurchaseRequestWithLines
} from './purchase-requests.types'

export class PurchaseRequestsService {
  async list(companyId: string, pagination: { page: number; limit: number }, filter?: { status?: string; branch_id?: string; date_from?: string; date_to?: string }, search?: string) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await purchaseRequestsRepository.findAll(companyId, { limit: pagination.limit, offset }, filter, search)
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

    // Get branch code for number generation
    const { rows: branchRows } = await pool.query('SELECT branch_code FROM branches WHERE id = $1', [dto.branch_id])
    const branchCode = branchRows[0]?.branch_code ?? 'XXX'

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Generate number inside transaction with FOR UPDATE lock
      const requestNumber = await purchaseRequestsRepository.generateRequestNumber(client, companyId, branchCode)

      const pr = await purchaseRequestsRepository.create(client, companyId, {
        branch_id: dto.branch_id,
        request_number: requestNumber,
        request_date: dto.request_date,
        needed_by_date: dto.needed_by_date,
        notes: dto.notes,
        requested_by: userId,
        created_by: userId,
      })

      await purchaseRequestsRepository.insertLines(client, pr.id, dto.lines)

      await client.query('COMMIT')

      await AuditService.log('CREATE', 'purchase_request', pr.id, userId, undefined, pr)
      return purchaseRequestsRepository.findWithLines(pr.id, companyId)
    } catch (e) {
      await client.query('ROLLBACK')
      if (isPostgresError(e, '23505')) throw new PurchaseRequestDuplicateError('auto-generated')
      throw e
    } finally {
      client.release()
    }
  }

  async update(id: string, companyId: string, dto: UpdatePurchaseRequestDto, userId: string) {
    const existing = await purchaseRequestsRepository.findById(id, companyId)
    if (!existing) throw new PurchaseRequestNotFoundError(id)
    if (existing.status !== 'DRAFT') throw new PurchaseRequestInvalidStatusError(existing.status, 'DRAFT')

    // All updates in single transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Update header
      const fields: string[] = ['updated_at = now()']
      const params: unknown[] = []
      let idx = 1

      if (dto.needed_by_date !== undefined) { params.push(dto.needed_by_date); fields.push(`needed_by_date = $${idx++}`) }
      if (dto.notes !== undefined) { params.push(dto.notes); fields.push(`notes = $${idx++}`) }
      params.push(userId); fields.push(`updated_by = $${idx++}`)
      params.push(id, companyId)

      await client.query(
        `UPDATE purchase_requests SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} AND deleted_at IS NULL AND status = 'DRAFT'`,
        params
      )

      // Replace lines if provided
      if (dto.lines && dto.lines.length > 0) {
        await purchaseRequestsRepository.deleteLines(client, id)
        await purchaseRequestsRepository.insertLines(client, id, dto.lines)
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await AuditService.log('UPDATE', 'purchase_request', id, userId, existing)
    return purchaseRequestsRepository.findWithLines(id, companyId)
  }

  async submitForApproval(id: string, companyId: string, userId: string) {
    const existing = await purchaseRequestsRepository.findById(id, companyId)
    if (!existing) throw new PurchaseRequestNotFoundError(id)
    if (existing.status !== 'DRAFT') throw new PurchaseRequestInvalidStatusError(existing.status, 'DRAFT')

    await purchaseRequestsRepository.updateStatus(id, companyId, 'PENDING_APPROVAL', { updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_request', id, userId, { status: 'DRAFT' }, { status: 'PENDING_APPROVAL' })
  }

  async approve(id: string, companyId: string, dto: ApprovePurchaseRequestDto) {
    const existing = await purchaseRequestsRepository.findById(id, companyId)
    if (!existing) throw new PurchaseRequestNotFoundError(id)
    if (existing.status !== 'PENDING_APPROVAL') throw new PurchaseRequestInvalidStatusError(existing.status, 'PENDING_APPROVAL')

    await purchaseRequestsRepository.updateStatus(id, companyId, 'APPROVED', {
      approved_by: dto.approved_by,
      approved_at: new Date().toISOString(),
      updated_by: dto.approved_by,
    })
    await AuditService.log('UPDATE', 'purchase_request', id, dto.approved_by, { status: 'PENDING_APPROVAL' }, { status: 'APPROVED' })
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
}

export const purchaseRequestsService = new PurchaseRequestsService()
