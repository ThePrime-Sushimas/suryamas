import type { PoolClient } from 'pg'
import { purchaseOrdersRepository } from '../purchase-orders/purchase-orders.repository'
import {
  purchaseInvoicesRepository,
  type GrLineDetailForInvoicing,
} from './purchase-invoices.repository'
import { AuditService } from '../monitoring/monitoring.service'
import {
  PurchaseInvoiceCannotEditPostedError,
  PurchaseInvoiceGrNotEligibleError,
  PurchaseInvoiceGpNotConfirmedError,
  PurchaseInvoiceInvalidStatusError,
  PurchaseInvoiceJournalAlreadyExistsError,
  PurchaseInvoiceNotFoundError,
} from './purchase-invoices.errors'
import type {
  CreatePurchaseInvoiceDto,
  PurchaseInvoiceDetail,
  PurchaseInvoiceLine,
  UpdatePurchaseInvoiceDto,
} from './purchase-invoices.types'
import { calculateDueDate } from '../../utils/due-date.util'
import {
  defaultQtyInvoicedInInvoiceUom,
  mergePricelistUomForConversion,
  normalizeUomName,
  qtyReceivedInInvoiceUom,
  resolveInvoiceUom,
  type ProductUomConversion,
} from '../../utils/purchase-invoice-uom.util'
import { pricelistsRepository } from '../pricelists/pricelists.repository'
import { productUomsRepository } from '../product-uoms/product-uoms.repository'
import { suppliersRepository } from '../suppliers/suppliers.repository'

function computeLineTotals(qtyInvoiced: number, unitPrice: number, taxRate: number) {
  const subtotal = qtyInvoiced * unitPrice
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount
  return { subtotal, taxAmount, total }
}

type InvoiceLineInput = {
  gr_line_id: string
  qty_invoiced: number
  unit_price: number
  tax_rate: number
  sort_order?: number
}

type InvoiceUomMaps = {
  pricelistByProduct: Map<string, { price: number; uom_name: string; conversion_factor: number }>
  uomsByProduct: Map<string, ProductUomConversion[]>
}

export class PurchaseInvoicesService {
  private async loadInvoiceUomMaps(
    supplierId: string,
    productIds: string[],
  ): Promise<InvoiceUomMaps> {
    const uniqueIds = [...new Set(productIds)]
    const [pricelistByProduct, uomRows] = await Promise.all([
      pricelistsRepository.batchLookupBySupplier(supplierId, uniqueIds),
      uniqueIds.length > 0 ? productUomsRepository.findAllUomsBatch(uniqueIds) : Promise.resolve([]),
    ])
    const uomsByProduct = new Map<string, ProductUomConversion[]>()
    for (const row of uomRows) {
      const list = uomsByProduct.get(row.product_id) ?? []
      list.push({
        unit_name: row.unit_name,
        conversion_factor: Number(row.conversion_factor),
      })
      uomsByProduct.set(row.product_id, list)
    }
    return { pricelistByProduct, uomsByProduct }
  }

  private resolveGrLineInvoiceUom(
    grl: GrLineDetailForInvoicing,
    maps: InvoiceUomMaps,
  ): { uom_invoice: string; product_uoms: ProductUomConversion[] } {
    const pl = maps.pricelistByProduct.get(grl.product_id)
    const product_uoms = mergePricelistUomForConversion(
      maps.uomsByProduct.get(grl.product_id) ?? [],
      pl,
    )
    const uom_invoice = resolveInvoiceUom(pl?.uom_name, String(grl.uom_po), String(grl.uom_received))
    return { uom_invoice, product_uoms }
  }

  private buildEnrichedLines(
    dtoLines: InvoiceLineInput[],
    grLineDetails: GrLineDetailForInvoicing[],
    userId: string,
    supplierId: string,
    maps: InvoiceUomMaps,
  ) {
    const grLineMap = new Map(grLineDetails.map((r) => [r.id, r]))
    const grIds = [...new Set(grLineDetails.map((r) => r.gr_id))]

    let subtotal = 0
    let totalTax = 0
    let totalAmount = 0
    const enrichedLines: Array<{
      gr_line_id: string
      product_id: string
      qty_received: number
      qty_invoiced: number
      unit_price: number
      tax_rate: number
      subtotal: number
      tax_amount: number
      total: number
      qty_po: number
      unit_price_po: number
      variance_qty: number
      variance_price: number
      match_status: 'MATCH' | 'OVER' | 'UNDER'
      sort_order: number
      created_by: string
      updated_by: string
    }> = []

    for (let i = 0; i < dtoLines.length; i++) {
      const l = dtoLines[i]
      const grl = grLineMap.get(l.gr_line_id)
      if (!grl) throw new Error(`Goods receipt line ${l.gr_line_id} not found`)

      const qtyInvoiced = Number(l.qty_invoiced)
      const unitPrice = Number(l.unit_price)
      const taxRate = Number(l.tax_rate)

      const qtyReceived = Number(grl.qty_received)
      const unitPricePo = Number(grl.unit_price_po)
      const { uom_invoice, product_uoms } = this.resolveGrLineInvoiceUom(grl, maps)
      const qtyReceivedInvoiceUom = qtyReceivedInInvoiceUom({
        qty_received: qtyReceived,
        uom_received: String(grl.uom_received),
        uom_invoice,
        product_uoms,
      })
      let qtyInvoicedFinal = qtyInvoiced
      if (
        normalizeUomName(String(grl.uom_received)) !== normalizeUomName(uom_invoice) &&
        Math.abs(qtyInvoiced - qtyReceived) < 0.0001
      ) {
        qtyInvoicedFinal = defaultQtyInvoicedInInvoiceUom({
          qty_received: qtyReceived,
          uom_received: String(grl.uom_received),
          qty_po_uom: Number(grl.qty_po_uom),
          uom_po: String(grl.uom_po),
          uom_invoice,
          product_uoms,
        })
      }
      const totalsAdjusted = computeLineTotals(qtyInvoicedFinal, unitPrice, taxRate)

      subtotal += totalsAdjusted.subtotal
      totalTax += totalsAdjusted.taxAmount
      totalAmount += totalsAdjusted.total

      const varianceQty = qtyInvoicedFinal - qtyReceivedInvoiceUom
      const variancePrice = unitPrice - unitPricePo

      enrichedLines.push({
        gr_line_id: l.gr_line_id,
        product_id: grl.product_id,
        qty_received: qtyReceived,
        qty_invoiced: qtyInvoicedFinal,
        unit_price: unitPrice,
        tax_rate: taxRate,
        subtotal: totalsAdjusted.subtotal,
        tax_amount: totalsAdjusted.taxAmount,
        total: totalsAdjusted.total,
        qty_po: Number(grl.qty_po_uom),
        unit_price_po: unitPricePo,
        variance_qty: varianceQty,
        variance_price: variancePrice,
        match_status: varianceQty === 0 ? 'MATCH' : varianceQty > 0 ? 'OVER' : 'UNDER',
        sort_order: l.sort_order ?? i,
        created_by: userId,
        updated_by: userId,
      })
    }

    return { enrichedLines, grIds, subtotal, totalTax, totalAmount }
  }

  async list(companyId: string, pagination: { page: number; limit: number }, filter?: any) {
    const offset = (pagination.page - 1) * pagination.limit
    const result = await purchaseInvoicesRepository.findAll(companyId, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(result.total / pagination.limit)
    return {
      data: result.data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    }
  }

  async getAvailableGrs(companyId: string, supplierId: string, branchId: string | null) {
    return purchaseInvoicesRepository.findAvailableGrs(companyId, supplierId, branchId)
  }

  async getById(id: string, companyId: string): Promise<PurchaseInvoiceDetail> {
    const detail = await purchaseInvoicesRepository.findById(id, companyId)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    return this.enrichDetailWithInvoiceUom(detail)
  }

  private async enrichDetailWithInvoiceUom(detail: PurchaseInvoiceDetail): Promise<PurchaseInvoiceDetail> {
    const productIds = detail.lines.map((l) => l.product_id)
    const maps = await this.loadInvoiceUomMaps(detail.supplier_id, productIds)
    const lines: PurchaseInvoiceLine[] = detail.lines.map((line) => {
      const grl: GrLineDetailForInvoicing = {
        id: line.gr_line_id,
        gr_id: '',
        product_id: line.product_id,
        qty_received: line.qty_received,
        qty_po_uom: line.qty_po_uom,
        uom_po: line.uom_po,
        uom_received: line.uom_received,
        unit_price_invoice: line.unit_price,
        unit_price_po: line.unit_price_po ?? 0,
      }
      const { uom_invoice, product_uoms } = this.resolveGrLineInvoiceUom(grl, maps)
      const qty_received_invoice_uom = qtyReceivedInInvoiceUom({
        qty_received: Number(line.qty_received),
        uom_received: line.uom_received,
        uom_invoice,
        product_uoms,
      })
      return {
        ...line,
        uom_invoice,
        qty_received_invoice_uom,
      }
    })
    return { ...detail, lines }
  }

  async create(companyId: string, dto: CreatePurchaseInvoiceDto, userId: string) {
    const invoice = await purchaseInvoicesRepository.withTransaction(async (client) => {
      const grLineIds = dto.lines.map((l) => l.gr_line_id)
      const grLineDetails = await purchaseInvoicesRepository.findGrLineDetailsForInvoicing(client, grLineIds)
      const productIds = grLineDetails.map((g) => g.product_id)
      const maps = await this.loadInvoiceUomMaps(dto.supplier_id, productIds)
      const { enrichedLines, grIds, subtotal, totalTax, totalAmount } = this.buildEnrichedLines(
        dto.lines,
        grLineDetails,
        userId,
        dto.supplier_id,
        maps,
      )

      const created = await purchaseInvoicesRepository.create(client, companyId, {
        supplier_id: dto.supplier_id,
        branch_id: dto.branch_id,
        invoice_number: dto.invoice_number,
        invoice_date: dto.invoice_date,
        notes: dto.notes ?? null,
        subtotal,
        total_tax: totalTax,
        total_amount: totalAmount,
        created_by: userId,
      })

      await purchaseInvoicesRepository.replaceLines(client, created.id, enrichedLines)
      await purchaseInvoicesRepository.insertGrLinks(client, created.id, grIds)
      await purchaseInvoicesRepository.copyAttachmentsFromGrs(client, created.id, grIds)
      return created
    })

    await AuditService.log('CREATE', 'purchase_invoices', invoice.id, userId)
    const created = await purchaseInvoicesRepository.findById(invoice.id, companyId)
    if (!created) throw new PurchaseInvoiceNotFoundError(invoice.id)
    return this.enrichDetailWithInvoiceUom(created)
  }

  async update(companyId: string, id: string, dto: UpdatePurchaseInvoiceDto, userId: string) {
    const existing = await purchaseInvoicesRepository.findById(id, companyId)
    if (!existing) throw new PurchaseInvoiceNotFoundError(id)
    if (existing.status === 'POSTED') throw new PurchaseInvoiceCannotEditPostedError()
    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') throw new PurchaseInvoiceInvalidStatusError(existing.status, 'DRAFT/REJECTED')

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      const grLineIds = dto.lines.map((l) => l.gr_line_id)
      const grLineDetails = await purchaseInvoicesRepository.findGrLineDetailsForInvoicing(client, grLineIds)
      const maps = await this.loadInvoiceUomMaps(existing.supplier_id, grLineDetails.map((g) => g.product_id))
      const { enrichedLines, grIds, subtotal, totalTax, totalAmount } = this.buildEnrichedLines(
        dto.lines,
        grLineDetails,
        userId,
        existing.supplier_id,
        maps,
      )

      await purchaseInvoicesRepository.replaceLines(client, id, enrichedLines)
      await purchaseInvoicesRepository.replaceGrLinks(client, id, grIds)
      await purchaseInvoicesRepository.copyAttachmentsFromGrs(client, id, grIds)
      await purchaseInvoicesRepository.updateStatus(client, id, existing.status, {
        subtotal,
        total_tax: totalTax,
        total_amount: totalAmount,
        notes: dto.notes ?? existing.notes,
        updated_by: userId,
      })
    })

    await AuditService.log('UPDATE', 'purchase_invoices', id, userId)
    return this.getById(id, companyId)
  }

  async submit(companyId: string, id: string, userId: string) {
    const detail = await purchaseInvoicesRepository.findById(id, companyId)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    if (detail.status !== 'DRAFT' && detail.status !== 'REJECTED') throw new PurchaseInvoiceInvalidStatusError(detail.status, 'DRAFT/REJECTED')

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      await purchaseInvoicesRepository.updateStatus(client, id, 'SUBMITTED', {
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
        updated_by: userId,
      })
    })
    await AuditService.log('UPDATE', 'purchase_invoices', id, userId, { status: detail.status }, { status: 'SUBMITTED' })
    return purchaseInvoicesRepository.findById(id, companyId)
  }

  async approve(companyId: string, id: string, userId: string) {
    const detail = await purchaseInvoicesRepository.findById(id, companyId)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    if (detail.status !== 'SUBMITTED') throw new PurchaseInvoiceInvalidStatusError(detail.status, 'SUBMITTED')

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      await purchaseInvoicesRepository.updateStatus(client, id, 'APPROVED', {
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_by: userId,
      })
    })
    await AuditService.log('UPDATE', 'purchase_invoices', id, userId, { status: detail.status }, { status: 'APPROVED' })
    return purchaseInvoicesRepository.findById(id, companyId)
  }

  async reject(companyId: string, id: string, reason: string, userId: string) {
    const detail = await purchaseInvoicesRepository.findById(id, companyId)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    if (detail.status !== 'SUBMITTED') throw new PurchaseInvoiceInvalidStatusError(detail.status, 'SUBMITTED')

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      await purchaseInvoicesRepository.updateStatus(client, id, 'REJECTED', {
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
        updated_by: userId,
      })
    })
    await AuditService.log('UPDATE', 'purchase_invoices', id, userId, { status: detail.status }, { status: 'REJECTED' })
    return purchaseInvoicesRepository.findById(id, companyId)
  }

  async post(companyId: string, id: string, userId: string, employeeId?: string) {
    const detail = await purchaseInvoicesRepository.findById(id, companyId)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    if (detail.status !== 'APPROVED') throw new PurchaseInvoiceInvalidStatusError(detail.status, 'APPROVED')
    if (detail.journal_id) throw new PurchaseInvoiceJournalAlreadyExistsError()

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      const unconfirmedGpNumber = await purchaseInvoicesRepository.findUnconfirmedGpProcessingNumber(client, id)
      if (unconfirmedGpNumber) {
        throw new PurchaseInvoiceGpNotConfirmedError(unconfirmedGpNumber)
      }

      const postingRows = await purchaseInvoicesRepository.findPostingRowsForInvoice(client, id)
      if (!postingRows || postingRows.length === 0) {
        throw new PurchaseInvoiceGrNotEligibleError()
      }

      const rowsByLineId = new Map<string, typeof postingRows>()
      for (const r of postingRows) {
        const key = r.purchase_invoice_line_id
        const arr = rowsByLineId.get(key) ?? []
        arr.push(r)
        rowsByLineId.set(key, arr)
      }

      const recomputePairs: Array<{ product_id: string; warehouse_id: string }> = []
      const seenPairs = new Set<string>()

      for (const [purchase_invoice_line_id, lineRows] of rowsByLineId.entries()) {
        const lineSubtotal = Number(lineRows[0].line_subtotal)
        const totalAllocableQty = lineRows.reduce((s, r) => s + Number(r.qty_output), 0)
        if (totalAllocableQty <= 0) continue

        let allocated = 0
        const sorted = [...lineRows].sort((a, b) => Number(a.output_sort_order) - Number(b.output_sort_order))

        for (let i = 0; i < sorted.length; i++) {
          const out = sorted[i]
          let allocatedCost: number

          if (i === sorted.length - 1) {
            allocatedCost = lineSubtotal - allocated
          } else {
            const ratio = Number(out.qty_output) / totalAllocableQty
            allocatedCost = Math.round(lineSubtotal * ratio)
            allocated += allocatedCost
          }

          const unitCost = Number(out.qty_output) > 0 ? allocatedCost / Number(out.qty_output) : 0

          await purchaseInvoicesRepository.updateGpOutputCostAndLinkToInvoiceLine(client, {
            goods_processing_output_id: out.goods_processing_output_id,
            purchase_invoice_line_id,
            allocatedCost,
            unitCost,
          })

          if (out.stock_movement_id) {
            await purchaseInvoicesRepository.updateStockMovementCost(client, {
              stock_movement_id: out.stock_movement_id,
              costPerUnit: unitCost,
              totalCost: allocatedCost,
            })

            const pairKey = `${out.product_id}-${out.warehouse_id}`
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey)
              recomputePairs.push({ product_id: out.product_id, warehouse_id: out.warehouse_id })
            }
          }
        }
      }

      for (const pair of recomputePairs) {
        await purchaseInvoicesRepository.recomputeStockBalanceAvgCost(client, pair.warehouse_id, pair.product_id)
      }

      const coaByCode = new Map<string, string>()
      for (const r of await purchaseInvoicesRepository.findCoaIdsByCodes(client, companyId, ['110501', '110601', '210101'])) {
        coaByCode.set(r.account_code, r.id)
      }

      const coaInv = coaByCode.get('110501')
      const coaTax = coaByCode.get('110601')
      const coaPayable = coaByCode.get('210101')
      if (!coaInv || !coaTax || !coaPayable) {
        throw new Error('COA codes missing for purchase invoice posting')
      }

      const subtotal = Number(detail.subtotal ?? 0)
      const totalTax = Number(detail.total_tax ?? 0)
      const totalAmount = Number(detail.total_amount ?? 0)

      const period = await purchaseInvoicesRepository.findFiscalPeriodForDate(client, companyId, detail.invoice_date)
      if (!period) {
        throw new Error(`Fiscal period not found for invoice date ${detail.invoice_date}`)
      }

      const sequence = await purchaseInvoicesRepository.getNextJournalSequence(client, companyId, period)
      const year = detail.invoice_date.substring(0, 4)
      const month = detail.invoice_date.substring(5, 7)
      const journalNumber = `JG/${year}${month}/${String(sequence).padStart(5, '0')}`

      const journalDescription = `Faktur Pembelian ${detail.invoice_number}${detail.supplier_name ? ` - ${detail.supplier_name}` : ''}`

      const journalHeader = await purchaseInvoicesRepository.createJournalHeader(client, {
        companyId,
        branchId: detail.branch_id,
        journalNumber,
        sequenceNumber: sequence,
        journalDate: detail.invoice_date,
        period,
        currency: 'IDR',
        journalType: 'GENERAL',
        referenceType: 'purchase_invoice',
        referenceId: id,
        referenceNumber: detail.invoice_number,
        description: journalDescription,
        totalDebit: subtotal + totalTax,
        totalCredit: totalAmount,
        createdBy: employeeId ?? null,
      })

      await purchaseInvoicesRepository.createJournalLines(client, {
        journalHeaderId: journalHeader.id,
        debitAccountId: coaInv,
        debitAmount: subtotal,
        taxAccountId: coaTax,
        taxAmount: totalTax,
        creditAccountId: coaPayable,
        creditAmount: totalAmount,
        description: journalDescription,
      })

      const supplierTerm = await purchaseOrdersRepository.findSupplierPaymentTerm(detail.supplier_id, client)
      if (supplierTerm?.calculation_type === 'from_invoice') {
        const dueDate = calculateDueDate({
          calculation_type: 'from_invoice',
          days: supplierTerm.days,
          grace_period_days: supplierTerm.grace_period_days,
          payment_dates: supplierTerm.payment_dates,
          payment_day_of_week: supplierTerm.payment_day_of_week,
        }, detail.invoice_date)

        await purchaseInvoicesRepository.updateDueDate(client, id, dueDate)
        await purchaseInvoicesRepository.updatePaymentDueDateForReferencedPOs(client, id, dueDate)
      }

      await purchaseInvoicesRepository.updateGoodsReceiptQtyInvoiced(client, id)

      await purchaseInvoicesRepository.updateStatus(client, id, 'POSTED', {
        posted_by: userId,
        posted_at: new Date().toISOString(),
        updated_by: userId,
        journal_id: journalHeader.id,
      })
    })

    await AuditService.log('UPDATE', 'purchase_invoices', id, userId, { status: detail.status }, { status: 'POSTED' })
    return purchaseInvoicesRepository.findById(id, companyId)
  }

  async createDraftFromGr(client: PoolClient, companyId: string, grId: string, userId: string) {
    const gr = await purchaseInvoicesRepository.findGrWithPoForDraft(client, grId, companyId)
    if (!gr) return

    const lines = await purchaseInvoicesRepository.findGrLinesForDraft(client, grId)
    const attachments = await purchaseInvoicesRepository.findGrAttachmentsForDraft(client, grId)
    const supplier = await suppliersRepository.findById(gr.supplier_id)
    const taxRate = Number(supplier?.default_tax_rate ?? 11)

    const grLineDetails: GrLineDetailForInvoicing[] = lines.map((l: GrLineDetailForInvoicing & { id: string }) => ({
      id: l.id,
      gr_id: grId,
      product_id: l.product_id,
      qty_received: l.qty_received,
      qty_po_uom: l.qty_po_uom,
      uom_po: l.uom_po,
      uom_received: l.uom_received,
      unit_price_invoice: l.unit_price_invoice,
      unit_price_po: l.unit_price_po,
    }))
    const maps = await this.loadInvoiceUomMaps(gr.supplier_id, grLineDetails.map((g) => g.product_id))

    let subtotal = 0
    let totalTax = 0
    let totalAmount = 0

    const piLines = grLineDetails.map((grl, i) => {
      const qtyReceived = Number(grl.qty_received)
      const unitPrice = Number(grl.unit_price_invoice ?? grl.unit_price_po ?? 0)
      const unitPricePo = Number(grl.unit_price_po ?? 0)
      const { uom_invoice, product_uoms } = this.resolveGrLineInvoiceUom(grl, maps)
      const qtyInvoiced = defaultQtyInvoicedInInvoiceUom({
        qty_received: qtyReceived,
        uom_received: String(grl.uom_received),
        qty_po_uom: Number(grl.qty_po_uom),
        uom_po: String(grl.uom_po),
        uom_invoice,
        product_uoms,
      })
      const totals = computeLineTotals(qtyInvoiced, unitPrice, taxRate)

      subtotal += totals.subtotal
      totalTax += totals.taxAmount
      totalAmount += totals.total

      return {
        gr_line_id: grl.id,
        product_id: grl.product_id,
        qty_received: qtyReceived,
        qty_invoiced: qtyInvoiced,
        unit_price: unitPrice,
        tax_rate: taxRate,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total: totals.total,
        qty_po: Number(grl.qty_po_uom),
        unit_price_po: unitPricePo,
        variance_qty: 0,
        variance_price: unitPrice - unitPricePo,
        match_status: 'MATCH' as const,
        sort_order: i,
        created_by: userId,
        updated_by: userId,
      }
    })

    // 3. Create PI Header
    const invoice = await purchaseInvoicesRepository.create(client, companyId, {
      supplier_id: gr.supplier_id,
      branch_id: gr.branch_id,
      invoice_number: `[DRAFT-AUTO] ${gr.gr_number}`,
      invoice_date: new Date().toISOString().split('T')[0],
      notes: `Auto-generated from GR ${gr.gr_number}`,
      subtotal,
      total_tax: totalTax,
      total_amount: totalAmount,
      created_by: userId
    });

    // 4. Insert Lines & GR Links
    await purchaseInvoicesRepository.replaceLines(client, invoice.id, piLines);
    await purchaseInvoicesRepository.insertGrLinks(client, invoice.id, [grId]);

    for (const att of attachments) {
      await purchaseInvoicesRepository.insertInvoiceAttachment(
        client,
        invoice.id,
        att.file_path,
        att.file_name,
        att.file_type,
        userId,
      )
    }

    return invoice
  }

  async getAttachments(invoiceId: string) {
    return purchaseInvoicesRepository.findAttachmentsByInvoiceId(invoiceId)
  }

  async delete(companyId: string, id: string, userId: string) {
    const existing = await purchaseInvoicesRepository.findById(id, companyId)
    if (!existing) throw new Error('Purchase invoice not found')

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      await purchaseInvoicesRepository.softDelete(client, id, companyId, userId)
    })
    await AuditService.log('DELETE', 'purchase_invoices', id, userId)
    return true
  }

  async mergeInvoices(companyId: string, invoiceIds: string[], userId: string) {
    if (invoiceIds.length < 2) throw new Error('At least two invoices are required to merge')
    
    const master = await purchaseInvoicesRepository.withTransaction(async (client) => {
      const invoices = await purchaseInvoicesRepository.findDraftInvoicesForMerge(client, invoiceIds, companyId)
      if (invoices.length !== invoiceIds.length) {
        throw new Error('Some invoices were not found or are not in DRAFT status')
      }

      const supplierId = invoices[0].supplier_id
      const branchId = invoices[0].branch_id
      const allSame = invoices.every((inv) => inv.supplier_id === supplierId && inv.branch_id === branchId)
      if (!allSame) {
        throw new Error('All invoices must belong to the same supplier and branch to be merged')
      }

      const created = await purchaseInvoicesRepository.create(client, companyId, {
        supplier_id: supplierId,
        branch_id: branchId,
        invoice_number: '[DRAFT-MERGED]',
        invoice_date: new Date().toISOString().split('T')[0],
        notes: `Merged from ${invoices.length} drafts: ${invoices.map((i) => i.invoice_number).join(', ')}`,
        subtotal: 0,
        total_tax: 0,
        total_amount: 0,
        created_by: userId,
      })

      await purchaseInvoicesRepository.moveLinesToMasterInvoice(client, created.id, userId, invoiceIds)
      await purchaseInvoicesRepository.moveGrLinksToMasterInvoice(client, created.id, invoiceIds)
      await purchaseInvoicesRepository.moveAttachmentsToMasterInvoice(client, created.id, invoiceIds)

      const totals = await purchaseInvoicesRepository.sumLineTotalsForInvoice(client, created.id)
      await purchaseInvoicesRepository.updateMasterInvoiceAfterMerge(client, created.id, totals, invoiceIds, userId)
      await purchaseInvoicesRepository.softDeleteInvoicesByIds(client, invoiceIds, userId)
      return created
    })

    await AuditService.log('CREATE', 'purchase_invoices', master.id, userId, { merged_from: invoiceIds })
    return master
  }

  async getCounts(companyId: string) {
    return purchaseInvoicesRepository.findStatusCounts(companyId)
  }
}

export const purchaseInvoicesService = new PurchaseInvoicesService()

