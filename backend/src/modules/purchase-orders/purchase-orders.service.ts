import { purchaseOrdersRepository } from './purchase-orders.repository'
import { goodsReceiptsRepository } from '../goods-receipts/goods-receipts.repository'
import { goodsReceiptsService } from '../goods-receipts/goods-receipts.service'
import {
  PurchaseOrderNotFoundError, PurchaseOrderDuplicateError, PurchaseOrderInvalidStatusError,
  PurchaseOrderEmptyLinesError, PurchaseOrderManualCreateDisabledError, PurchaseOrderHasReceiptsError,
  PurchaseOrderShortCloseLineNotFoundError, PurchaseOrderShortCloseQtyError,
} from './purchase-orders.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { isPostgresError } from '../../utils/postgres-error.util'
import { InvalidReferenceError } from '../stock/stock.errors'
import type {
  CreatePurchaseOrderDto, UpdatePurchaseOrderDto, PurchaseOrderDetail, PaymentType, ShortClosePoLineDto,
} from './purchase-orders.types'
import {
  buildPoPaymentDueInfo,
  type PoPaymentTermSnapshot,
} from './purchase-order-payment.util'
import type { CalculationType } from '../payment-terms/payment-terms.types'
import { notificationDispatcher } from '../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../notifications/notification-events'
import { requireBranchAccess, getCompanyIdForBranch } from '../../utils/branch-access.util'

export class PurchaseOrdersService {
  private async requireById(id: string, branchIds: string[]) {
    const po = await purchaseOrdersRepository.findById(id, branchIds)
    if (!po) throw new PurchaseOrderNotFoundError(id)
    return po
  }

  /**
   * Verify branch, supplier, and PR belong to the given company.
   */
  private async verifyOwnership(companyId: string, branchId: string, supplierId: string, prId: string): Promise<void> {
    const r = await purchaseOrdersRepository.verifyOwnershipReferences(companyId, branchId, supplierId, prId)
    if (!r.branch_ok) throw new InvalidReferenceError('branch_id does not belong to your company')
    if (!r.supplier_ok) throw new InvalidReferenceError('supplier_id not found')
    if (!r.pr_ok) throw new InvalidReferenceError('purchase_request_id not found or does not belong to your company')
  }

  async list(branchIds: string[], pagination: { page: number; limit: number }, filter?: { status?: string; supplier_id?: string; branch_id?: string; date_from?: string; date_to?: string }, search?: string) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await purchaseOrdersRepository.findAll(branchIds, { limit: pagination.limit, offset }, filter, search)
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

  async getById(id: string, branchIds: string[]): Promise<PurchaseOrderDetail> {
    const po = await purchaseOrdersRepository.findWithLines(id, branchIds)
    if (!po) throw new PurchaseOrderNotFoundError(id)
    const { payment_term_name, payment_due_info } = await this.resolvePaymentDueInfo(po)
    return { ...po, payment_term_name, payment_due_info }
  }

  /**
   * Preview payment due for a PO. Pass expectedDeliveryDate only when overriding the
   * saved date (e.g. live form edit); otherwise buildPoPaymentDueInfo uses po.expected_delivery_date.
   */
  async getPaymentDuePreview(id: string, branchIds: string[], expectedDeliveryDate?: string) {
    const po = await this.requireById(id, branchIds)
    return this.resolvePaymentDueInfo(po, expectedDeliveryDate)
  }

  async create(_companyId: string, _dto: CreatePurchaseOrderDto, _userId: string) {
    throw new PurchaseOrderManualCreateDisabledError()
  }

  async update(id: string, branchIds: string[], dto: UpdatePurchaseOrderDto, userId: string) {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    // Purchasing adjusts payment terms etc. after stock keeper sends PO (SENT)
    if (existing.status !== 'SENT') throw new PurchaseOrderInvalidStatusError(existing.status, 'SENT')

    try {
      await purchaseOrdersRepository.withTransaction(async (client) => {
        const status = await purchaseOrdersRepository.lockStatusForUpdate(client, id, companyId)
        if (!status || status !== 'SENT') {
          throw new PurchaseOrderInvalidStatusError(status ?? 'UNKNOWN', 'SENT')
        }
        await purchaseOrdersRepository.updateSent(client, id, companyId, {
          expected_delivery_date: dto.expected_delivery_date,
          notes: dto.notes,
          updated_by: userId,
        })
      })
    } catch (e) {
      if (isPostgresError(e, '23503')) throw new InvalidReferenceError('One or more product_id does not exist')
      throw e
    }

    await AuditService.log('UPDATE', 'purchase_order', id, userId, existing)
    return this.getById(id, branchIds)
  }

  async submitForApproval(id: string, branchIds: string[], userId: string) {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (existing.status !== 'DRAFT') throw new PurchaseOrderInvalidStatusError(existing.status, 'DRAFT')

    await purchaseOrdersRepository.updateStatus(id, companyId, 'PENDING_APPROVAL', { updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_order', id, userId, { status: 'DRAFT' }, { status: 'PENDING_APPROVAL' })

    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_SUBMITTED,
      companyId,
      {
        entityId: id,
        variables: { po_number: existing.po_number },
        excludeUserIds: [userId],
      }
    )
  }

  async approve(id: string, branchIds: string[], userId: string) {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (existing.status !== 'PENDING_APPROVAL') throw new PurchaseOrderInvalidStatusError(existing.status, 'PENDING_APPROVAL')

    await purchaseOrdersRepository.updateStatus(id, companyId, 'APPROVED', {
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_by: userId,
    })
    await AuditService.log('UPDATE', 'purchase_order', id, userId, { status: 'PENDING_APPROVAL' }, { status: 'APPROVED' })

    const creatorId = existing.created_by
    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_APPROVED,
      companyId,
      {
        entityId: id,
        variables: { po_number: existing.po_number },
        additionalRecipientIds:
          creatorId && creatorId !== userId ? [creatorId] : [],
        excludeUserIds: [userId],
      }
    )
  }

  async markSent(id: string, branchIds: string[], userId: string) {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (existing.status !== 'DRAFT') throw new PurchaseOrderInvalidStatusError(existing.status, 'DRAFT')

    await purchaseOrdersRepository.updateStatus(id, companyId, 'SENT', { updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_order', id, userId, { status: 'DRAFT' }, { status: 'SENT' })

    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_SENT,
      companyId,
      {
        entityId: id,
        variables: { po_number: existing.po_number },
        excludeUserIds: [userId],
      }
    )
  }

  async markOrdered(id: string, branchIds: string[], userId: string) {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (existing.status !== 'SENT') throw new PurchaseOrderInvalidStatusError(existing.status, 'SENT')

    await purchaseOrdersRepository.updateStatus(id, companyId, 'ORDERED', { updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_order', id, userId, { status: 'SENT' }, { status: 'ORDERED' })

    const creatorId = existing.created_by
    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_ORDERED,
      companyId,
      {
        entityId: id,
        variables: { po_number: existing.po_number },
        additionalRecipientIds:
          creatorId && creatorId !== userId ? [creatorId] : [],
        excludeUserIds: [userId],
      }
    )

    await goodsReceiptsService.ensurePendingGrDraft(id, companyId, userId)
  }

  async shortCloseLines(id: string, branchIds: string[], userId: string, lines: ShortClosePoLineDto[]) {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (!['ORDERED', 'PARTIAL_RECEIVED'].includes(existing.status)) {
      throw new PurchaseOrderInvalidStatusError(existing.status, 'ORDERED or PARTIAL_RECEIVED')
    }

    await purchaseOrdersRepository.withTransaction(async (client) => {
      const locked = await purchaseOrdersRepository.lockStatusForUpdate(client, id, companyId)
      if (!locked || !['ORDERED', 'PARTIAL_RECEIVED'].includes(locked)) {
        throw new PurchaseOrderInvalidStatusError(locked ?? 'unknown', 'ORDERED or PARTIAL_RECEIVED')
      }

      const poLines = await purchaseOrdersRepository.findLinesForShortClose(client, id)
      const poLineMap = new Map(poLines.map((l) => [l.id, l]))
      const pendingMap = await goodsReceiptsRepository.findPendingQtyByPo(id, undefined, client)

      for (const item of lines) {
        const poLine = poLineMap.get(item.po_line_id)
        if (!poLine) throw new PurchaseOrderShortCloseLineNotFoundError(item.po_line_id)

        const pending = pendingMap.get(item.po_line_id) ?? 0
        const openQty = poLine.qty - poLine.qty_received - poLine.qty_short_closed - pending
        if (item.qty > openQty) {
          throw new PurchaseOrderShortCloseQtyError(poLine.product_name, openQty, item.qty)
        }

        await purchaseOrdersRepository.incrementLineShortClosed(
          client,
          item.po_line_id,
          item.qty,
          item.reason,
          item.notes ?? null,
        )
      }

      await purchaseOrdersRepository.recalculatePoAmounts(client, id, userId)

      const newStatus = await purchaseOrdersRepository.resolvePoStatusAfterReceipt(client, id)
      await goodsReceiptsRepository.updatePoStatus(client, id, newStatus, userId)
      if (newStatus === 'FULLY_RECEIVED') {
        await goodsReceiptsRepository.softDeleteDraftsByPoId(id, companyId, userId, client)
      }
    })

    const refreshed = await purchaseOrdersRepository.findById(id, branchIds)
    if (refreshed?.status !== 'FULLY_RECEIVED') {
      await goodsReceiptsService.ensurePendingGrDraft(id, companyId, userId)
    }

    await AuditService.log('UPDATE', 'purchase_order', id, userId, { action: 'short_close_lines' }, { lines })
    return this.getById(id, branchIds)
  }

  async cancel(id: string, branchIds: string[], userId: string, reason: string) {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT'].includes(existing.status)) {
      throw new PurchaseOrderInvalidStatusError(existing.status, 'DRAFT, PENDING_APPROVAL, APPROVED, or SENT')
    }

    await goodsReceiptsRepository.softDeleteDraftsByPoId(id, companyId, userId)

    const hasConfirmedGr = await purchaseOrdersRepository.hasGoodsReceipts(id)
    if (hasConfirmedGr) throw new PurchaseOrderHasReceiptsError()

    await purchaseOrdersRepository.updateStatus(id, companyId, 'CANCELLED', { cancelled_reason: reason, updated_by: userId })
    await AuditService.log('UPDATE', 'purchase_order', id, userId, { status: existing.status }, { status: 'CANCELLED', cancelled_reason: reason })

    const creatorId = existing.created_by
    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_CANCELLED,
      companyId,
      {
        entityId: id,
        variables: { po_number: existing.po_number, cancelled_reason: reason },
        additionalRecipientIds: creatorId ? [creatorId] : [],
        excludeUserIds: [userId],
      }
    )
  }

  async delete(id: string, branchIds: string[], userId: string) {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id

    const deleted = await purchaseOrdersRepository.softDelete(id, companyId, userId)
    if (!deleted) throw new PurchaseOrderInvalidStatusError(existing.status, 'DRAFT')

    await AuditService.log('DELETE', 'purchase_order', id, userId, existing)
  }

  /**
   * Check for similar POs (same supplier + branch + similar amount) in last 30 days.
   * Used as warning before creating new PO.
   */
  async checkDuplicates(branchIds: string[], supplierId: string, branchId: string, totalAmount: number) {
    requireBranchAccess(branchId, branchIds)
    const companyId = await getCompanyIdForBranch(branchId)
    if (!companyId) throw new InvalidReferenceError('branch_id not found')

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const similar_pos = await purchaseOrdersRepository.findSimilarRecent(
      companyId, supplierId, branchId, totalAmount, thirtyDaysAgo
    )

    return { count: similar_pos.length, similar_pos }
  }

  /**
   * Get latest price for a product.
   * Priority: pricelists (active, valid date) → supplier_products.price → products.average_cost
   */
  async getLatestPrice(
    branchIds: string[],
    companyId: string | null,
    productId: string,
    supplierId?: string,
  ): Promise<{ price: number; source: string }> {
    const companyIds: string[] = []
    if (companyId) {
      companyIds.push(companyId)
    } else {
      for (const branchId of branchIds) {
        const cid = await getCompanyIdForBranch(branchId)
        if (cid && !companyIds.includes(cid)) companyIds.push(cid)
      }
    }

    if (supplierId) {
      for (const cid of companyIds) {
        const pricelistPrice = await purchaseOrdersRepository.findLatestPricelistPrice(cid, productId, supplierId)
        if (pricelistPrice != null) return { price: pricelistPrice, source: 'pricelist' }
      }

      const supplierProductPrice = await purchaseOrdersRepository.findSupplierProductPrice(productId, supplierId)
      if (supplierProductPrice != null) return { price: supplierProductPrice, source: 'supplier_product' }
    }

    const averageCost = await purchaseOrdersRepository.findProductAverageCost(productId)
    return { price: averageCost, source: 'average_cost' }
  }
}

export const purchaseOrdersService = new PurchaseOrdersService()
