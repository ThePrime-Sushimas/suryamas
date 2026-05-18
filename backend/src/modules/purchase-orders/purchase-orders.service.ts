import { pool } from '../../config/db'
import { purchaseOrdersRepository } from './purchase-orders.repository'
import { goodsReceiptsRepository } from '../goods-receipts/goods-receipts.repository'
import {
  PurchaseOrderNotFoundError, PurchaseOrderDuplicateError, PurchaseOrderInvalidStatusError,
  PurchaseOrderEmptyLinesError, PurchaseOrderManualCreateDisabledError, PurchaseOrderHasReceiptsError
} from './purchase-orders.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { isPostgresError } from '../../utils/postgres-error.util'
import { InvalidReferenceError } from '../stock/stock.errors'
import type { CreatePurchaseOrderDto, UpdatePurchaseOrderDto, PurchaseOrderDetail, PaymentType } from './purchase-orders.types'
import {
  buildPoPaymentDueInfo,
  type PoPaymentTermSnapshot,
} from './purchase-order-payment.util'
import type { CalculationType } from '../payment-terms/payment-terms.types'

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

  private toPaymentTermSnapshot(
    row: {
      payment_term_id: number | null
      term_name: string | null
      calculation_type: string
      days: number
      grace_period_days: number
      payment_dates: number[] | null
      payment_day_of_week: number | null
    } | null
  ): PoPaymentTermSnapshot | null {
    if (!row?.payment_term_id) return null
    return {
      payment_term_id: row.payment_term_id,
      term_name: row.term_name,
      calculation_type: row.calculation_type as CalculationType,
      days: row.days,
      grace_period_days: row.grace_period_days ?? 0,
      payment_dates: row.payment_dates,
      payment_day_of_week: row.payment_day_of_week,
    }
  }

  async resolvePaymentDueInfo(
    po: {
      payment_type: PaymentType
      payment_due_date: string | null
      order_date: string
      expected_delivery_date: string | null
      payment_term_id: number | null
      supplier_id: string
    },
    baseDateOverride?: string | null
  ) {
    const termRow = await purchaseOrdersRepository.findPaymentTermForPo(
      po.payment_term_id,
      po.supplier_id
    )
    const term = this.toPaymentTermSnapshot(termRow)
    const payment_due_info = buildPoPaymentDueInfo({
      payment_type: po.payment_type,
      payment_due_date: po.payment_due_date,
      order_date: po.order_date,
      expected_delivery_date: po.expected_delivery_date,
      base_date_override: baseDateOverride,
      term,
    })
    return {
      payment_term_name: term?.term_name ?? null,
      payment_due_info,
    }
  }

  async getById(id: string, companyId: string): Promise<PurchaseOrderDetail> {
    const po = await purchaseOrdersRepository.findWithLines(id, companyId)
    if (!po) throw new PurchaseOrderNotFoundError(id)
    const { payment_term_name, payment_due_info } = await this.resolvePaymentDueInfo(po)
    return { ...po, payment_term_name, payment_due_info }
  }

  /**
   * Preview payment due for a PO. Pass expectedDeliveryDate only when overriding the
   * saved date (e.g. live form edit); otherwise buildPoPaymentDueInfo uses po.expected_delivery_date.
   */
  async getPaymentDuePreview(id: string, companyId: string, expectedDeliveryDate?: string) {
    const po = await purchaseOrdersRepository.findById(id, companyId)
    if (!po) throw new PurchaseOrderNotFoundError(id)
    return this.resolvePaymentDueInfo(po, expectedDeliveryDate)
  }

  async create(_companyId: string, _dto: CreatePurchaseOrderDto, _userId: string) {
    throw new PurchaseOrderManualCreateDisabledError()
  }

  async update(id: string, companyId: string, dto: UpdatePurchaseOrderDto, userId: string) {
    const existing = await purchaseOrdersRepository.findById(id, companyId)
    if (!existing) throw new PurchaseOrderNotFoundError(id)
    // Purchasing adjusts payment terms etc. after stock keeper sends PO (SENT)
    if (existing.status !== 'SENT') throw new PurchaseOrderInvalidStatusError(existing.status, 'SENT')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const { rows: lockRows } = await client.query(
        'SELECT status FROM purchase_orders WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE',
        [id, companyId]
      )
      if (!lockRows[0] || lockRows[0].status !== 'SENT') {
        await client.query('ROLLBACK')
        throw new PurchaseOrderInvalidStatusError(lockRows[0]?.status ?? 'UNKNOWN', 'SENT')
      }

      const fields: string[] = ['updated_at = now()']
      const params: unknown[] = []
      let idx = 1

      if (dto.expected_delivery_date !== undefined) { params.push(dto.expected_delivery_date); fields.push(`expected_delivery_date = $${idx++}`) }
      if (dto.notes !== undefined) { params.push(dto.notes); fields.push(`notes = $${idx++}`) }
      params.push(userId); fields.push(`updated_by = $${idx++}`)

      params.push(id, companyId)
      await client.query(
        `UPDATE purchase_orders SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1}`,
        params
      )

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      if (isPostgresError(e, '23503')) throw new InvalidReferenceError('One or more product_id does not exist')
      throw e
    } finally {
      client.release()
    }

    await AuditService.log('UPDATE', 'purchase_order', id, userId, existing)
    return this.getById(id, companyId)
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
    if (existing.status !== 'DRAFT') throw new PurchaseOrderInvalidStatusError(existing.status, 'DRAFT')

    await purchaseOrdersRepository.updateStatus(id, companyId, 'SENT', { updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_order', id, userId, { status: 'DRAFT' }, { status: 'SENT' })
  }

  async markOrdered(id: string, companyId: string, userId: string) {
    const existing = await purchaseOrdersRepository.findById(id, companyId)
    if (!existing) throw new PurchaseOrderNotFoundError(id)
    if (existing.status !== 'SENT') throw new PurchaseOrderInvalidStatusError(existing.status, 'SENT')

    await purchaseOrdersRepository.updateStatus(id, companyId, 'ORDERED', { updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_order', id, userId, { status: 'SENT' }, { status: 'ORDERED' })
  }

  async cancel(id: string, companyId: string, userId: string, reason: string) {
    const existing = await purchaseOrdersRepository.findById(id, companyId)
    if (!existing) throw new PurchaseOrderNotFoundError(id)
    if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT'].includes(existing.status)) {
      throw new PurchaseOrderInvalidStatusError(existing.status, 'DRAFT, PENDING_APPROVAL, APPROVED, or SENT')
    }

    await goodsReceiptsRepository.softDeleteDraftsByPoId(id, companyId, userId)

    const hasConfirmedGr = await purchaseOrdersRepository.hasGoodsReceipts(id)
    if (hasConfirmedGr) throw new PurchaseOrderHasReceiptsError()

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

  /**
   * Check for similar POs (same supplier + branch + similar amount) in last 30 days.
   * Used as warning before creating new PO.
   */
  async checkDuplicates(companyId: string, supplierId: string, branchId: string, totalAmount: number) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { rows } = await pool.query(
      `SELECT po.id, po.po_number, po.total_amount, po.order_date, po.status, s.supplier_name
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.company_id = $1 AND po.supplier_id = $2 AND po.branch_id = $3
         AND po.created_at >= $4
         AND po.status != 'CANCELLED'
         AND po.deleted_at IS NULL
         AND ABS(po.total_amount - $5) <= ($5 * 0.05)`,
      [companyId, supplierId, branchId, thirtyDaysAgo.toISOString(), totalAmount]
    )

    return { count: rows.length, similar_pos: rows }
  }

  /**
   * Get latest price for a product.
   * Priority: pricelists (active, valid date) → supplier_products.price → products.average_cost
   */
  async getLatestPrice(companyId: string, productId: string, supplierId?: string): Promise<{ price: number; source: string }> {
    // 1. Try pricelists (active + valid date range)
    if (supplierId) {
      const { rows: plRows } = await pool.query(
        `SELECT price FROM pricelists
         WHERE product_id = $1 AND supplier_id = $2 AND company_id = $3
           AND is_active = true AND deleted_at IS NULL
           AND status = 'approved'
           AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
           AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
         ORDER BY updated_at DESC LIMIT 1`,
        [productId, supplierId, companyId]
      )
      if (plRows[0]?.price) return { price: Number(plRows[0].price), source: 'pricelist' }
    }

    // 2. Fallback: supplier_products price
    if (supplierId) {
      const { rows: spRows } = await pool.query(
        'SELECT price FROM supplier_products WHERE product_id = $1 AND supplier_id = $2 AND is_active = true AND deleted_at IS NULL LIMIT 1',
        [productId, supplierId]
      )
      if (spRows[0]?.price) return { price: Number(spRows[0].price), source: 'supplier_product' }
    }

    // 3. Fallback: products.average_cost
    const { rows: pRows } = await pool.query('SELECT average_cost FROM products WHERE id = $1', [productId])
    return { price: Number(pRows[0]?.average_cost ?? 0), source: 'average_cost' }
  }
}

export const purchaseOrdersService = new PurchaseOrdersService()
