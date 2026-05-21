import { goodsReceiptsRepository } from './goods-receipts.repository'
import { goodsProcessingRepository } from '../goods-processing/goods-processing.repository'
import { productOutputTemplateRepository } from '../products/product-output-template.repository'
import { purchaseOrdersRepository } from '../purchase-orders/purchase-orders.repository'
import { PAYMENT_DUE_AT_GR_CONFIRM_TYPES } from '../payment-terms/payment-terms.constants'
import { BusinessRuleError } from '../../utils/errors.base'
import {
  GoodsReceiptNotFoundError, GoodsReceiptDuplicateError, GoodsReceiptAlreadyConfirmedError,
  GoodsReceiptInvalidPOStatusError, GoodsReceiptExceedsOrderedError, GoodsReceiptMarketplaceSupplierError,
  GoodsReceiptMarketplaceEditForbiddenError,
} from './goods-receipts.errors'

import { InvalidReferenceError } from '../stock/stock.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { notificationDispatcher } from '../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../notifications/notification-events'
import { isPostgresError } from '../../utils/postgres-error.util'
import { calculateDueDate } from '../../utils/due-date.util'
import { purchaseInvoicesService } from '../purchase-invoices/purchase-invoices.service'
import { productUomsRepository } from '../product-uoms/product-uoms.repository'
import { buildProductUomsMap, toProductBaseQty } from '../../utils/product-uom.util'
import type {
  CreateGoodsReceiptDto,
  UpdateGoodsReceiptDto,
  GoodsReceiptWithLines,
  GoodsReceiptWithRelations,
  VarianceStatus,
} from './goods-receipts.types'
import type { InvoiceBypassReason } from '../suppliers/suppliers.types'

function assertManualGrAllowedForInvoiceBypass(
  invoiceBypassReason: InvoiceBypassReason | null | undefined,
): void {
  if (invoiceBypassReason === 'marketplace') {
    throw new GoodsReceiptMarketplaceSupplierError()
  }
}

function supplierRequiresPurchaseInvoice(gr: Pick<GoodsReceiptWithRelations, 'requires_invoice'>): boolean {
  return gr.requires_invoice !== false
}

export class GoodsReceiptsService {
  async list(companyId: string, pagination: { page: number; limit: number }, filter?: { status?: string; po_id?: string; branch_id?: string; branch_ids?: string[]; date_from?: string; date_to?: string; invoice_number?: string; source?: string }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await goodsReceiptsRepository.findAll(companyId, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async getById(id: string, companyId: string): Promise<GoodsReceiptWithLines> {
    const gr = await goodsReceiptsRepository.findWithLines(id, companyId)
    if (!gr) throw new GoodsReceiptNotFoundError(id)
    return gr
  }

  async create(companyId: string, dto: CreateGoodsReceiptDto, userId: string) {
    const po = await goodsReceiptsRepository.findPoForGr(dto.po_id, companyId)
    if (!po) throw new InvalidReferenceError('purchase order not found')
    if (!['ORDERED', 'PARTIAL_RECEIVED'].includes(po.status)) {
      throw new GoodsReceiptInvalidPOStatusError(po.status)
    }
    assertManualGrAllowedForInvoiceBypass(po.invoice_bypass_reason)

    const wh = await goodsReceiptsRepository.findWarehouse(dto.warehouse_id, companyId)
    if (!wh) throw new InvalidReferenceError('warehouse not found or does not belong to your company')

    const poLines = await goodsReceiptsRepository.findPoLines(dto.po_id)
    const poLineMap = new Map(poLines.map(l => [l.id, l]))

    // Guard: hitung pending qty dari GR DRAFT yang belum confirm
    const pendingMap = await goodsReceiptsRepository.findPendingQtyByPo(dto.po_id)

    const processedLines = dto.lines.map(line => {
      const poLine = poLineMap.get(line.po_line_id)
      if (!poLine) throw new InvalidReferenceError(`PO line ${line.po_line_id} not found`)

      // Fallback: if frontend doesn't send qty_po_uom, assume same UOM (conversion = 1)
      const qtyPoUom = line.qty_po_uom ?? line.qty_received
      const uomReceived = line.uom_received ?? poLine.uom

      // Pending qty check uses qty_po_uom (PO unit)
      const pendingQty = pendingMap.get(line.po_line_id) ?? 0
      const remaining = Number(poLine.qty) - Number(poLine.qty_received) - pendingQty
      const qtyAccepted = qtyPoUom - (line.qty_rejected ?? 0)
      if (qtyAccepted > remaining) {
        throw new GoodsReceiptExceedsOrderedError(
          poLine.product_name, Number(poLine.qty), Number(poLine.qty_received) + pendingQty, qtyAccepted
        )
      }

      if ((line.qty_rejected ?? 0) > qtyPoUom) {
        throw new BusinessRuleError(`Qty ditolak (${line.qty_rejected}) tidak boleh melebihi qty diterima (${qtyPoUom}) untuk ${poLine.product_name}`)
      }

      // UOM snapshot from PO line
      const uomPo = poLine.uom

      // Calculate conversion factor
      const conversionFactor = qtyPoUom > 0 ? line.qty_received / qtyPoUom : 1

      // Variance: compare total method (both in PO UOM, only accepted qty)
      const unitPricePo = Number(poLine.unit_price)
      const poTotal = qtyAccepted * unitPricePo
      const invoiceTotal = qtyAccepted * line.unit_price_invoice
      const variance = invoiceTotal - poTotal
      const variancePct = poTotal > 0 ? Math.abs(variance / poTotal) * 100 : 0
      const varianceStatus: VarianceStatus = variancePct <= 0.01 ? 'OK' : variancePct <= 15 ? 'NOTICE' : 'DISPUTED'

      return {
        ...line,
        qty_po_uom: qtyPoUom,
        uom_received: uomReceived,
        uom_po: uomPo,
        conversion_factor: conversionFactor,
        unit_price_po: unitPricePo,
        price_variance: variance,
        price_variance_pct: variancePct,
        variance_status: varianceStatus,
      }
    })

    const branchCode = po.branch_code ?? 'XXX'

    try {
      const gr = await goodsReceiptsRepository.withTransaction(async (client) => {

        const grNumber = await goodsReceiptsRepository.generateGrNumber(client, companyId, branchCode)
        const created = await goodsReceiptsRepository.create(client, companyId, {
          branch_id: po.branch_id,
          po_id: dto.po_id,
          warehouse_id: dto.warehouse_id,
          gr_number: grNumber,
          received_date: dto.received_date,
          invoice_number: dto.invoice_number,
          invoice_date: dto.invoice_date,
          notes: dto.notes,
          created_by: userId,
        })
        await goodsReceiptsRepository.insertLines(client, created.id, processedLines)
        return created
      })

      await AuditService.log('CREATE', 'goods_receipt', gr.id, userId, undefined, gr)
      return goodsReceiptsRepository.findWithLines(gr.id, companyId)
    } catch (e) {
      if (isPostgresError(e, '23505')) throw new GoodsReceiptDuplicateError('auto-generated')
      if (isPostgresError(e, '23503')) throw new InvalidReferenceError('Invalid reference in GR lines')
      throw e
    }
  }

  async confirm(id: string, companyId: string, userId: string) {
    const gr = await goodsReceiptsRepository.findWithLines(id, companyId)
    if (!gr) throw new GoodsReceiptNotFoundError(id)
    if (gr.status === 'CONFIRMED') throw new GoodsReceiptAlreadyConfirmedError()

    const attachments = await goodsReceiptsRepository.findAttachments(id)
    if (gr.source !== 'MARKETPLACE' && attachments.length === 0) {
      throw new BusinessRuleError('Upload minimal 1 dokumen (surat jalan / foto barang) sebelum konfirmasi')
    }

    if (!gr.warehouse_id) {
      throw new BusinessRuleError('GR tidak memiliki warehouse yang terdaftar')
    }

    if (gr.source !== 'MARKETPLACE') {
      assertManualGrAllowedForInvoiceBypass(gr.invoice_bypass_reason)
    }

    await goodsReceiptsRepository.withTransaction(async (client) => {
      const supplierId = await goodsReceiptsRepository.findPoSupplierId(client, gr.po_id)

      const poLines = await goodsReceiptsRepository.findPoLinesForUpdate(client, gr.po_id)
      const poLineMap = new Map(poLines.map(l => [l.id, l]))

      // 2. Re-validate qty inside transaction (after lock) — using net accepted qty
      for (const line of gr.lines) {
        const poLine = poLineMap.get(line.po_line_id)
        if (!poLine) continue
        const remaining = poLine.qty - poLine.qty_received
        const qtyAccepted = line.qty_po_uom - (line.qty_rejected ?? 0)
        if (qtyAccepted > remaining) {
          throw new GoodsReceiptExceedsOrderedError(
            line.product_name ?? 'Unknown', poLine.qty, poLine.qty_received, qtyAccepted
          )
        }
      }

      // 3. Update PO lines qty_received (using net accepted qty)
      for (const line of gr.lines) {
        const qtyAccepted = line.qty_po_uom - (line.qty_rejected ?? 0)
        await goodsReceiptsRepository.incrementPoLineQtyReceived(client, line.po_line_id, qtyAccepted)
      }

      // 4. Update PO status
      const newPoStatus = await goodsReceiptsRepository.resolvePoStatus(client, gr.po_id)
      await goodsReceiptsRepository.updatePoStatus(client, gr.po_id, newPoStatus, userId)

      // 4b. Calculate payment due date for from_delivery-based terms.
      // NOTE: from_invoice is intentionally excluded here — its due_date is calculated
      // when Purchase Invoice is posted (baseDate = invoice_date), not at GR confirm.
      if (supplierId) {
        const supplierTerm = await purchaseOrdersRepository.findSupplierPaymentTerm(supplierId, client)
        if (
          supplierTerm &&
          (PAYMENT_DUE_AT_GR_CONFIRM_TYPES as readonly string[]).includes(supplierTerm.calculation_type)
        ) {
          const receivedDate = gr.received_date ?? new Date().toISOString().slice(0, 10)
          const dueDate = calculateDueDate({
            calculation_type: supplierTerm.calculation_type as import('../../utils/due-date.util').PaymentTermForDueDate['calculation_type'],
            days: supplierTerm.days,
            grace_period_days: supplierTerm.grace_period_days,
            payment_dates: supplierTerm.payment_dates,
            payment_day_of_week: supplierTerm.payment_day_of_week,
          }, receivedDate)
          await purchaseOrdersRepository.updatePaymentDueDate(client, gr.po_id, dueDate)
        }
      }

      // 5. Update GR status (no journal — journal created by Purchase Invoice module)
      await goodsReceiptsRepository.updateStatus(client, id, 'CONFIRMED', {
        updated_by: userId,
      })
      // 5b. Kalau GR dari marketplace, update session → RECEIVED
      if (gr.source === 'MARKETPLACE') {
        const rowCount = await goodsReceiptsRepository.markMarketplaceSessionReceived(client, userId, id)
        if (rowCount === 0) {
          throw new BusinessRuleError('Session marketplace tidak ditemukan atau status bukan SHIPPED')
        }
      }

      const branchCode = gr.branch_code ?? 'XXX'
      const gpNumber = await goodsProcessingRepository.generateGpNumber(client, companyId, branchCode)
      const hasDisassembly = await goodsReceiptsRepository.hasDisassemblyProducts(client, id)
      const processingType = hasDisassembly ? 'DISASSEMBLY' : 'PASS_THROUGH'

      const gpId = await goodsReceiptsRepository.createGoodsProcessingDraft(client, {
        companyId,
        branchId: gr.branch_id,
        warehouseId: gr.warehouse_id,
        grId: id,
        gpNumber,
        receivedDate: gr.received_date,
        processingType,
        userId,
      })

      const lineProductIds = [...new Set(gr.lines.map((l) => l.product_id))]
      const requiresProcessingByProduct = await goodsReceiptsRepository.findProductsRequiresProcessing(client, lineProductIds)
      const disassemblyProductIds = lineProductIds.filter((id) => requiresProcessingByProduct.get(id))
      const outputTemplatesByProduct =
        disassemblyProductIds.length > 0
          ? await productOutputTemplateRepository.findByProductIds(disassemblyProductIds)
          : {}
      const productUomsMap = buildProductUomsMap(await productUomsRepository.findAllUomsBatch(lineProductIds))

      for (const line of gr.lines) {
        const uomReceived = line.uom_received ?? line.uom ?? 'kg'
        const { qty: qtyInput, uom: uomInput } = toProductBaseQty(
          line.product_id,
          Number(line.qty_received),
          uomReceived,
          productUomsMap,
          line.product_name,
        )

        const inputId = await goodsReceiptsRepository.insertGoodsProcessingInput(
          client, gpId, line.id, line.product_id, qtyInput, uomInput,
        )

        const needsProcessing = requiresProcessingByProduct.get(line.product_id) ?? false
        if (needsProcessing) {
          const templates = outputTemplatesByProduct[line.product_id] ?? []
          for (let i = 0; i < templates.length; i++) {
            const t = templates[i]
            const qtyOutput =
              t.suggested_pct != null
                ? Math.round(qtyInput * (Number(t.suggested_pct) / 100) * 10000) / 10000
                : 0
            await goodsReceiptsRepository.insertGoodsProcessingOutput(client, {
              gpId,
              inputId,
              productId: t.output_product_id,
              qtyOutput,
              uom: t.output_uom,
              sortOrder: i,
            })
          }
        } else {
          await goodsReceiptsRepository.insertGoodsProcessingOutput(client, {
            gpId,
            inputId,
            productId: line.product_id,
            qtyOutput: qtyInput,
            uom: uomInput,
            sortOrder: 0,
          })
        }
      }

      if (supplierRequiresPurchaseInvoice(gr)) {
        await purchaseInvoicesService.createDraftFromGr(client, companyId, id, userId)
      }
    })

    await AuditService.log('UPDATE', 'goods_receipt', id, userId, { status: 'DRAFT' }, { status: 'CONFIRMED' })

    const confirmed = await goodsReceiptsRepository.findWithLines(id, companyId)
    if (confirmed) {
      await notificationDispatcher.dispatch(
        NOTIFICATION_EVENT_KEYS.GOODS_RECEIPT_CONFIRMED,
        companyId,
        {
          entityId: id,
          variables: { gr_number: confirmed.gr_number },
          excludeUserIds: [userId],
        }
      )
    }
    return confirmed
  }

  async update(id: string, companyId: string, dto: UpdateGoodsReceiptDto, userId: string) {
    const existing = await goodsReceiptsRepository.findById(id, companyId)
    if (!existing) throw new GoodsReceiptNotFoundError(id)
    if (existing.status !== 'DRAFT') throw new GoodsReceiptAlreadyConfirmedError()
    if (existing.source === 'MARKETPLACE') {
      throw new GoodsReceiptMarketplaceEditForbiddenError()
    }

    const po = await goodsReceiptsRepository.findPoForGr(existing.po_id, companyId)
    if (po) {
      assertManualGrAllowedForInvoiceBypass(po.invoice_bypass_reason)
    }

    await goodsReceiptsRepository.withTransaction(async (client) => {
      await goodsReceiptsRepository.updateHeader(client, id, companyId, {
        warehouse_id: dto.warehouse_id,
        received_date: dto.received_date,
        invoice_number: dto.invoice_number,
        invoice_date: dto.invoice_date,
        notes: dto.notes,
        updated_by: userId,
      })

      if (dto.lines && dto.lines.length > 0) {
        const poLineIds = dto.lines.map(l => l.po_line_id).filter(Boolean)
        const poLinePriceMap = await goodsReceiptsRepository.findPoLinePrices(client, poLineIds)
        const poLines = await goodsReceiptsRepository.findPoLines(existing.po_id)
        const poLineMap = new Map(poLines.map(l => [l.id, l]))

        const processedLines = dto.lines.map(line => {
          const poLine = poLineMap.get(line.po_line_id)
          const uomPo = poLine?.uom ?? line.uom_received ?? 'Gram'
          const qtyPoUom = line.qty_po_uom ?? line.qty_received
          const uomReceived = line.uom_received ?? uomPo
          const conversionFactor = qtyPoUom > 0 ? line.qty_received / qtyPoUom : 1

          const unitPricePo = poLinePriceMap.get(line.po_line_id) ?? line.unit_price_invoice
          const qtyAccepted = qtyPoUom - (line.qty_rejected ?? 0)
          const poTotal = qtyAccepted * unitPricePo
          const invoiceTotal = qtyAccepted * line.unit_price_invoice
          const variance = invoiceTotal - poTotal
          const variancePct = poTotal > 0 ? Math.abs(variance / poTotal) * 100 : 0
          const varianceStatus = variancePct > 15 ? 'DISPUTED' : variancePct > 5 ? 'NOTICE' : 'OK'
          return {
            po_line_id: line.po_line_id,
            product_id: line.product_id,
            qty_po_uom: qtyPoUom,
            uom_po: uomPo,
            qty_received: line.qty_received,
            uom_received: uomReceived,
            conversion_factor: conversionFactor,
            unit_price_invoice: line.unit_price_invoice,
            unit_price_po: unitPricePo,
            price_variance: variance,
            price_variance_pct: variancePct,
            variance_status: varianceStatus,
            qty_rejected: line.qty_rejected,
            reject_reason: line.reject_reason,
            notes: line.notes ?? null,
          }
        })

        await goodsReceiptsRepository.replaceLines(client, id, processedLines)
      }
    })

    await AuditService.log('UPDATE', 'goods_receipt', id, userId, existing)
    return goodsReceiptsRepository.findWithLines(id, companyId)
  }

  async delete(id: string, companyId: string, userId: string) {
    const existing = await goodsReceiptsRepository.findById(id, companyId)
    if (!existing) throw new GoodsReceiptNotFoundError(id)

    const deleted = await goodsReceiptsRepository.softDelete(id, companyId, userId)
    if (!deleted) throw new GoodsReceiptAlreadyConfirmedError()

    await AuditService.log('DELETE', 'goods_receipt', id, userId, existing)
  }
}

export const goodsReceiptsService = new GoodsReceiptsService()
