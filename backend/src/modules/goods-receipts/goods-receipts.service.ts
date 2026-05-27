import { goodsReceiptsRepository } from './goods-receipts.repository'
import { goodsProcessingRepository } from '../goods-processing/goods-processing.repository'
import { productOutputTemplateRepository } from '../product-output-template/product-output-template.repository'
import { purchaseOrdersRepository } from '../purchase-orders/purchase-orders.repository'
import { PAYMENT_DUE_AT_GR_CONFIRM_TYPES } from '../payment-terms/payment-terms.constants'
import { BusinessRuleError } from '../../utils/errors.base'
import {
  GoodsReceiptNotFoundError, GoodsReceiptDuplicateError, GoodsReceiptAlreadyConfirmedError,
  GoodsReceiptInvalidPOStatusError, GoodsReceiptExceedsOrderedError, GoodsReceiptMarketplaceSupplierError,
  GoodsReceiptMarketplaceEditForbiddenError, GoodsReceiptPendingDraftExistsError,
} from './goods-receipts.errors'
import { queryPoReceiptStatus } from '../../utils/po-receipt-status.util'

import { InvalidReferenceError } from '../stock/stock.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { notificationDispatcher } from '../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../notifications/notification-events'
import { isPostgresError } from '../../utils/postgres-error.util'
import { calculateDueDate } from '../../utils/due-date.util'
import { purchaseInvoicesService } from '../purchase-invoices/purchase-invoices.service'
import { productUomsRepository } from '../product-uoms/product-uoms.repository'
import { buildProductUomsMap, toProductBaseQty } from '../../utils/product-uom.util'
import type { ProductUomsMap } from '../../utils/product-uom.util'
import { computeGrLineInvoiceTotal } from '../../utils/gp-cost-allocation.util'
import type {
  CreateGoodsReceiptDto,
  CreateGoodsReceiptLineDto,
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

type ProcessedGrLine = {
  po_line_id: string
  product_id: string
  qty_po_uom: number
  uom_po: string
  qty_received: number
  uom_received: string
  conversion_factor: number
  unit_price_invoice: number
  unit_price_po: number
  total_price_invoice: number
  price_variance: number
  price_variance_pct: number
  variance_status: VarianceStatus
  qty_rejected?: number
  reject_reason?: string | null
  notes?: string | null
}

async function buildUomsMapForGrLines(lines: { product_id: string }[]): Promise<ProductUomsMap> {
  const productIds = [...new Set(lines.map((l) => l.product_id))]
  if (productIds.length === 0) return new Map()
  return buildProductUomsMap(await productUomsRepository.findAllUomsBatch(productIds))
}

function buildProcessedGrLine(
  line: CreateGoodsReceiptLineDto,
  uomPo: string,
  uomsMap: ProductUomsMap,
  unitPricePo: number,
): ProcessedGrLine {
  const qtyPoUom = line.qty_po_uom ?? line.qty_received
  const uomReceived = line.uom_received ?? uomPo
  const conversionFactor = qtyPoUom > 0 ? line.qty_received / qtyPoUom : 1
  const qtyAccepted = qtyPoUom - (line.qty_rejected ?? 0)

  const totalInvoice = computeGrLineInvoiceTotal(
    {
      product_id: line.product_id,
      qty_po_uom: qtyPoUom,
      qty_received: line.qty_received,
      uom_po: uomPo,
      uom_received: uomReceived,
      unit_price_invoice: line.unit_price_invoice,
      qty_rejected: line.qty_rejected,
    },
    uomsMap,
  )

  const poTotal = qtyAccepted * unitPricePo
  const variance = totalInvoice - poTotal
  const variancePct = poTotal > 0 ? Math.abs(variance / poTotal) * 100 : 0
  const varianceStatus: VarianceStatus =
    variancePct <= 0.01 ? 'OK' : variancePct <= 15 ? 'NOTICE' : 'DISPUTED'

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
    total_price_invoice: totalInvoice,
    price_variance: variance,
    price_variance_pct: variancePct,
    variance_status: varianceStatus,
    qty_rejected: line.qty_rejected,
    reject_reason: line.reject_reason,
    notes: line.notes ?? null,
  }
}

export class GoodsReceiptsService {
  async list(branchIds: string[], pagination: { page: number; limit: number }, filter?: { status?: string; po_id?: string; branch_id?: string; date_from?: string; date_to?: string; invoice_number?: string; source?: string; search?: string }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await goodsReceiptsRepository.findAll(branchIds, { limit: pagination.limit, offset }, filter)
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

    const openDraft = await goodsReceiptsRepository.findOpenDraftForPo(companyId, dto.po_id)
    if (openDraft) {
      throw new GoodsReceiptPendingDraftExistsError(openDraft.gr_number)
    }

    const wh = await goodsReceiptsRepository.findWarehouse(dto.warehouse_id, companyId)
    if (!wh) throw new InvalidReferenceError('warehouse not found or does not belong to your company')

    const poLines = await goodsReceiptsRepository.findPoLines(dto.po_id)
    const poLineMap = new Map(poLines.map(l => [l.id, l]))

    // Guard: hitung pending qty dari GR DRAFT yang belum confirm
    const pendingMap = await goodsReceiptsRepository.findPendingQtyByPo(dto.po_id)

    const uomsMap = await buildUomsMapForGrLines(dto.lines ?? [])

    const processedLines = (dto.lines ?? []).map((line) => {
      const poLine = poLineMap.get(line.po_line_id)
      if (!poLine) throw new InvalidReferenceError(`PO line ${line.po_line_id} not found`)

      const qtyPoUom = line.qty_po_uom ?? line.qty_received

      const pendingQty = pendingMap.get(line.po_line_id) ?? 0
      const remaining =
        Number(poLine.qty) - Number(poLine.qty_received) - Number(poLine.qty_short_closed) - pendingQty
      const qtyAccepted = qtyPoUom - (line.qty_rejected ?? 0)
      if (qtyAccepted > remaining) {
        throw new GoodsReceiptExceedsOrderedError(
          poLine.product_name, Number(poLine.qty), Number(poLine.qty_received) + pendingQty, qtyAccepted
        )
      }

      if ((line.qty_rejected ?? 0) > qtyPoUom) {
        throw new BusinessRuleError(`Qty ditolak (${line.qty_rejected}) tidak boleh melebihi qty diterima (${qtyPoUom}) untuk ${poLine.product_name}`)
      }

      return buildProcessedGrLine(line, poLine.uom, uomsMap, Number(poLine.unit_price))
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
        if (processedLines.length > 0) {
          await goodsReceiptsRepository.insertLines(client, created.id, processedLines)
        }
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

    if (gr.lines.length === 0) {
      throw new BusinessRuleError('Tambahkan minimal 1 item barang sebelum konfirmasi penerimaan')
    }
    const hasAcceptedQty = gr.lines.some(
      (l) => (Number(l.qty_po_uom) - Number(l.qty_rejected ?? 0)) > 0,
    )
    if (!hasAcceptedQty) {
      throw new BusinessRuleError('Minimal 1 item harus memiliki qty diterima lebih dari 0')
    }

    await goodsReceiptsRepository.withTransaction(async (client) => {
      const supplierId = await goodsReceiptsRepository.findPoSupplierId(client, gr.po_id)

      const poLines = await goodsReceiptsRepository.findPoLinesForUpdate(client, gr.po_id)
      const poLineMap = new Map(poLines.map(l => [l.id, l]))

      // 2. Re-validate qty inside transaction (after lock) — using net accepted qty
      for (const line of gr.lines) {
        const poLine = poLineMap.get(line.po_line_id)
        if (!poLine) continue
        const remaining =
          poLine.qty - poLine.qty_received - poLine.qty_short_closed
        const qtyAccepted = line.qty_po_uom - (line.qty_rejected ?? 0)
        if (qtyAccepted > remaining) {
          throw new GoodsReceiptExceedsOrderedError(
            line.product_name ?? 'Unknown', poLine.qty, poLine.qty_received + poLine.qty_short_closed, qtyAccepted
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

      // 5. Confirm current GR before cleaning up other draft GRs on the same PO.
      await goodsReceiptsRepository.updateStatus(client, id, 'CONFIRMED', {
        updated_by: userId,
      })

      if (newPoStatus === 'FULLY_RECEIVED') {
        await goodsReceiptsRepository.softDeleteDraftsByPoId(gr.po_id, companyId, userId, client)
      }

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

      // 5b. Kalau GR dari marketplace, session → RECEIVED hanya setelah semua GR session dikonfirmasi
      if (gr.source === 'MARKETPLACE') {
        const sessionStatus = await goodsReceiptsRepository.findMarketplaceSessionStatusForGr(client, id)
        if (!sessionStatus) {
          throw new BusinessRuleError('Session marketplace tidak ditemukan atau status bukan SHIPPED')
        }
        await goodsReceiptsRepository.markMarketplaceSessionReceivedIfComplete(client, userId, id)
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
      if (confirmed.source !== 'MARKETPLACE') {
        await this.ensurePendingGrDraft(confirmed.po_id, companyId, userId)
      }
    }
    return confirmed
  }

  /**
   * Satu draft GR kosong per PO (source PO_PENDING) agar cabang tidak perlu memilih PO dari dropdown.
   * Dipanggil saat PO ORDERED dan setelah GR dikonfirmasi jika PO masih belum lunas.
   */
  async ensurePendingGrDraft(poId: string, companyId: string, userId: string): Promise<string | null> {
    const po = await goodsReceiptsRepository.findPoForGr(poId, companyId)
    if (!po) return null
    if (!['ORDERED', 'PARTIAL_RECEIVED'].includes(po.status)) return null
    if (po.invoice_bypass_reason === 'marketplace') return null

    return goodsReceiptsRepository.withTransaction(async (client) => {
      const existing = await goodsReceiptsRepository.findOpenDraftForPo(companyId, poId, client)
      if (existing) return existing.id

      const fulfillment = await queryPoReceiptStatus(poId, client)
      if (fulfillment === 'FULLY_RECEIVED') return null

      const warehouseId = await goodsReceiptsRepository.findMainWarehouseId(client, po.branch_id, companyId)
      if (!warehouseId) return null

      if (!po.branch_code?.trim()) {
        throw new BusinessRuleError(
          `Cabang PO tidak memiliki branch_code; tidak dapat membuat nomor GR untuk PO ${poId}`,
        )
      }
      const grNumber = await goodsReceiptsRepository.generateGrNumber(client, companyId, po.branch_code)
      const created = await goodsReceiptsRepository.create(client, companyId, {
        branch_id: po.branch_id,
        po_id: poId,
        warehouse_id: warehouseId,
        gr_number: grNumber,
        notes: 'Menunggu kedatangan barang dari supplier',
        created_by: userId,
        source: 'PO_PENDING',
        status: 'DRAFT',
      })
      await AuditService.log('CREATE', 'goods_receipt', created.id, userId, undefined, {
        ...created,
        auto: 'PO_PENDING',
      })
      return created.id
    })
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

        const uomsMap = await buildUomsMapForGrLines(dto.lines)
        const processedLines = dto.lines.map((line) => {
          const poLine = poLineMap.get(line.po_line_id)
          const uomPo = poLine?.uom ?? line.uom_received ?? 'Gram'
          const unitPricePo = poLinePriceMap.get(line.po_line_id) ?? line.unit_price_invoice
          return buildProcessedGrLine(line, uomPo, uomsMap, unitPricePo)
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
