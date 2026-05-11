import { pool } from '../../config/db'
import { purchaseOrdersRepository } from './purchase-orders.repository'
import {
  PurchaseOrderNotFoundError, PurchaseOrderDuplicateError, PurchaseOrderInvalidStatusError,
  PurchaseOrderEmptyLinesError, PurchaseRequestNotApprovedError, PurchaseOrderHasReceiptsError
} from './purchase-orders.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { isPostgresError } from '../../utils/postgres-error.util'
import { InvalidReferenceError } from '../stock/stock.errors'
import type { CreatePurchaseOrderDto, UpdatePurchaseOrderDto, PurchaseOrderWithLines } from './purchase-orders.types'

export class PurchaseOrdersService {
  /**
   * Verify branch, supplier, and PR belong to the given company.
   */
  private async verifyOwnership(companyId: string, branchId: string, supplierId: string, prId: string): Promise<void> {
    const { rows } = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM branches WHERE id = $2 AND company_id = $1) AS branch_ok,
        (SELECT COUNT(*)::int FROM suppliers WHERE id = $3 AND deleted_at IS NULL) AS supplier_ok,
        (SELECT COUNT(*)::int FROM purchase_requests WHERE id = $4 AND company_id = $1 AND deleted_at IS NULL) AS pr_ok`,
      [companyId, branchId, supplierId, prId]
    )
    const r = rows[0]
    if (!r.branch_ok) throw new InvalidReferenceError('branch_id does not belong to your company')
    if (!r.supplier_ok) throw new InvalidReferenceError('supplier_id not found')
    if (!r.pr_ok) throw new InvalidReferenceError('purchase_request_id not found or does not belong to your company')
  }

  async list(companyId: string, pagination: { page: number; limit: number }, filter?: { status?: string; supplier_id?: string; branch_id?: string; date_from?: string; date_to?: string }, search?: string) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await purchaseOrdersRepository.findAll(companyId, { limit: pagination.limit, offset }, filter, search)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async getById(id: string, companyId: string): Promise<PurchaseOrderWithLines> {
    const po = await purchaseOrdersRepository.findWithLines(id, companyId)
    if (!po) throw new PurchaseOrderNotFoundError(id)
    return po
  }

  async create(companyId: string, dto: CreatePurchaseOrderDto, userId: string) {
    if (!dto.lines || dto.lines.length === 0) throw new PurchaseOrderEmptyLinesError()

    // Cross-tenant verification
    await this.verifyOwnership(companyId, dto.branch_id, dto.supplier_id, dto.purchase_request_id)

    // Verify PR is APPROVED
    const { rows: prRows } = await pool.query(
      'SELECT status FROM purchase_requests WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [dto.purchase_request_id, companyId]
    )
    if (!prRows[0] || prRows[0].status !== 'APPROVED') throw new PurchaseRequestNotApprovedError(dto.purchase_request_id)

    // Get branch code
    const { rows: branchRows } = await pool.query('SELECT branch_code FROM branches WHERE id = $1', [dto.branch_id])
    const branchCode = branchRows[0]?.branch_code ?? 'XXX'

    const totalAmount = dto.lines.reduce((sum, l) => sum + l.qty * l.unit_price, 0)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Advisory lock — use hashCode of prefix string for uniqueness
      const prefix = `PO-${companyId}-${branchCode}`
      let lockKey = 0
      for (let i = 0; i < prefix.length; i++) {
        lockKey = ((lockKey << 5) - lockKey + prefix.charCodeAt(i)) | 0
      }
      await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey])

      const poNumber = await purchaseOrdersRepository.generatePoNumber(client, companyId, branchCode)

      const po = await purchaseOrdersRepository.create(client, companyId, {
        branch_id: dto.branch_id,
        supplier_id: dto.supplier_id,
        purchase_request_id: dto.purchase_request_id,
        po_number: poNumber,
        order_date: dto.order_date,
        expected_delivery_date: dto.expected_delivery_date,
        payment_type: dto.payment_type,
        payment_terms_days: dto.payment_terms_days,
        notes: dto.notes,
        total_amount: totalAmount,
        created_by: userId,
      })

      await purchaseOrdersRepository.insertLines(client, po.id, dto.lines)

      // Note: PR stays APPROVED — 1 PR can generate multiple POs (multi-supplier)

      await client.query('COMMIT')

      await AuditService.log('CREATE', 'purchase_order', po.id, userId, undefined, po)
      return purchaseOrdersRepository.findWithLines(po.id, companyId)
    } catch (e) {
      await client.query('ROLLBACK')
      if (isPostgresError(e, '23505')) throw new PurchaseOrderDuplicateError('auto-generated')
      if (isPostgresError(e, '23503')) throw new InvalidReferenceError('One or more product_id or supplier_product_id does not exist')
      throw e
    } finally {
      client.release()
    }
  }

  async update(id: string, companyId: string, dto: UpdatePurchaseOrderDto, userId: string) {
    const existing = await purchaseOrdersRepository.findById(id, companyId)
    if (!existing) throw new PurchaseOrderNotFoundError(id)
    if (existing.status !== 'DRAFT') throw new PurchaseOrderInvalidStatusError(existing.status, 'DRAFT')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Lock row to prevent race condition with submit
      const { rows: lockRows } = await client.query(
        'SELECT status FROM purchase_orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE',
        [id, companyId]
      )
      if (!lockRows[0] || lockRows[0].status !== 'DRAFT') {
        await client.query('ROLLBACK')
        throw new PurchaseOrderInvalidStatusError(lockRows[0]?.status ?? 'UNKNOWN', 'DRAFT')
      }

      const fields: string[] = ['updated_at = now()']
      const params: unknown[] = []
      let idx = 1

      if (dto.expected_delivery_date !== undefined) { params.push(dto.expected_delivery_date); fields.push(`expected_delivery_date = $${idx++}`) }
      if (dto.payment_type !== undefined) { params.push(dto.payment_type); fields.push(`payment_type = $${idx++}`) }
      if (dto.payment_terms_days !== undefined) { params.push(dto.payment_terms_days); fields.push(`payment_terms_days = $${idx++}`) }
      if (dto.notes !== undefined) { params.push(dto.notes); fields.push(`notes = $${idx++}`) }
      params.push(userId); fields.push(`updated_by = $${idx++}`)

      if (dto.lines && dto.lines.length > 0) {
        const totalAmount = dto.lines.reduce((sum, l) => sum + l.qty * l.unit_price, 0)
        params.push(totalAmount); fields.push(`total_amount = $${idx++}`)
      }

      params.push(id, companyId)
      await client.query(
        `UPDATE purchase_orders SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1}`,
        params
      )

      if (dto.lines && dto.lines.length > 0) {
        await purchaseOrdersRepository.deleteLines(client, id)
        await purchaseOrdersRepository.insertLines(client, id, dto.lines)
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      if (isPostgresError(e, '23503')) throw new InvalidReferenceError('One or more product_id does not exist')
      throw e
    } finally {
      client.release()
    }

    await AuditService.log('UPDATE', 'purchase_order', id, userId, existing)
    return purchaseOrdersRepository.findWithLines(id, companyId)
  }

  async submitForApproval(id: string, companyId: string, userId: string) {
    const existing = await purchaseOrdersRepository.findById(id, companyId)
    if (!existing) throw new PurchaseOrderNotFoundError(id)
    if (existing.status !== 'DRAFT') throw new PurchaseOrderInvalidStatusError(existing.status, 'DRAFT')

    await purchaseOrdersRepository.updateStatus(id, companyId, 'PENDING_APPROVAL', { updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_order', id, userId, { status: 'DRAFT' }, { status: 'PENDING_APPROVAL' })
  }

  async approve(id: string, companyId: string, userId: string) {
    const existing = await purchaseOrdersRepository.findById(id, companyId)
    if (!existing) throw new PurchaseOrderNotFoundError(id)
    if (existing.status !== 'PENDING_APPROVAL') throw new PurchaseOrderInvalidStatusError(existing.status, 'PENDING_APPROVAL')

    await purchaseOrdersRepository.updateStatus(id, companyId, 'APPROVED', {
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_by: userId,
    })
    await AuditService.log('UPDATE', 'purchase_order', id, userId, { status: 'PENDING_APPROVAL' }, { status: 'APPROVED' })
  }

  async markSent(id: string, companyId: string, userId: string) {
    const existing = await purchaseOrdersRepository.findById(id, companyId)
    if (!existing) throw new PurchaseOrderNotFoundError(id)
    if (existing.status !== 'APPROVED') throw new PurchaseOrderInvalidStatusError(existing.status, 'APPROVED')

    await purchaseOrdersRepository.updateStatus(id, companyId, 'SENT', { updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_order', id, userId, { status: 'APPROVED' }, { status: 'SENT' })
  }

  async cancel(id: string, companyId: string, userId: string, reason: string) {
    const existing = await purchaseOrdersRepository.findById(id, companyId)
    if (!existing) throw new PurchaseOrderNotFoundError(id)
    if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT'].includes(existing.status)) {
      throw new PurchaseOrderInvalidStatusError(existing.status, 'DRAFT, PENDING_APPROVAL, APPROVED, or SENT')
    }

    // Cannot cancel if already has GR
    const hasGR = await purchaseOrdersRepository.hasGoodsReceipts(id)
    if (hasGR) throw new PurchaseOrderHasReceiptsError()

    await purchaseOrdersRepository.updateStatus(id, companyId, 'CANCELLED', { cancelled_reason: reason, updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_order', id, userId, { status: existing.status }, { status: 'CANCELLED', cancelled_reason: reason })
  }

  async delete(id: string, companyId: string, userId: string) {
    const existing = await purchaseOrdersRepository.findById(id, companyId)
    if (!existing) throw new PurchaseOrderNotFoundError(id)

    const deleted = await purchaseOrdersRepository.softDelete(id, companyId, userId)
    if (!deleted) throw new PurchaseOrderInvalidStatusError(existing.status, 'DRAFT')

    await AuditService.log('DELETE', 'purchase_order', id, userId, existing)
  }
}

export const purchaseOrdersService = new PurchaseOrdersService()
