import type { PoolClient } from 'pg'
import { purchaseOrdersRepository } from '../purchase-orders/purchase-orders.repository'
import {
  purchaseInvoicesRepository,
  type GrLineDetailForInvoicing,
} from './purchase-invoices.repository'
import { AuditService } from '../monitoring/monitoring.service'
import { apPaymentsService } from '../ap-payments/ap-payments.service'
import {
  PurchaseInvoiceCannotEditPostedError,
  PurchaseInvoiceChargesInvalidError,
  PurchaseInvoiceDuplicateNumberError,
  PurchaseInvoiceGrLineOverAllocatedError,
  PurchaseInvoiceGrNotEligibleError,
  PurchaseInvoiceGpNotConfirmedError,
  PurchaseInvoiceHasChargesError,
  PurchaseInvoiceInvalidStatusError,
  PurchaseInvoiceJournalAlreadyExistsError,
  PurchaseInvoiceMixedAssetLinesError,
  PurchaseInvoiceNoJournalError,
  PurchaseInvoiceNotFoundError,
  PurchaseInvoiceNotPostedError,
  PurchaseInvoicePlaceholderNumberError,
  PurchaseInvoiceSplitValidationError,
} from './purchase-invoices.errors'
import {
  buildPiPaymentDueInfo,
  computePurchaseInvoiceDueDate,
} from './purchase-invoice-payment.util'
import type { PoPaymentTermSnapshot } from '../purchase-orders/purchase-order-payment.util'
import { getAccessibleBranchIds, getCompanyIdForBranch, requireBranchAccess } from '../../utils/branch-access.util'
import type {
  CreatePurchaseInvoiceChargeDto,
  CreatePurchaseInvoiceDto,
  PurchaseInvoiceDetail,
  PurchaseInvoiceLine,
  PurchaseInvoiceWithRelations,
  SplitPurchaseInvoiceDto,
  SplitPurchaseInvoiceResult,
  UpdatePurchaseInvoiceDto,
} from './purchase-invoices.types'
import { isStagingInvoiceNumber } from '../../utils/purchase-invoice-staging.util'
import {
  defaultQtyInvoicedInInvoiceUom,
  mergePricelistUomForConversion,
  normalizeUomName,
  qtyReceivedInInvoiceUom,
  resolveInvoiceUom,
  type ProductUomConversion,
} from '../../utils/purchase-invoice-uom.util'
import { pricelistsRepository } from '../pricelists/pricelists.repository'
import { pricelistsService } from '../pricelists/pricelists.service'
import type { PiLineForPricelistSync, PricelistSyncResult } from '../pricelists/pricelists.types'
import { recipesRepository } from '../food-production/recipes/recipes.repository'
import { logError, logInfo } from '../../config/logger'
import { productUomsRepository } from '../product-uoms/product-uoms.repository'
import { productOutputTemplateRepository } from '../product-output-template/product-output-template.repository'
import { buildProductUomsMap } from '../../utils/product-uom.util'
import {
  allocateLineCostToGpOutputs,
  buildBearsCostMap,
  resolveGpInputCostFromGrLine,
} from '../../utils/gp-cost-allocation.util'
import { suppliersRepository } from '../suppliers/suppliers.repository'
import type { CalculationType } from '../payment-terms/payment-terms.types'
import { notificationDispatcher } from '../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../notifications/notification-events'
import * as assetLifecycleService from '../fixed-assets/asset-lifecycle.service'
import * as fixedAssetsRepository from '../fixed-assets/fixed-assets.repository'
import { journalHeadersRepository } from '../accounting/journals/journal-headers/journal-headers.repository'
import { pool } from '../../config/db'
import { BusinessRuleError } from '../../utils/errors.base'

function computeLineTotals(qtyInvoiced: number, unitPrice: number, taxRate: number) {
  const subtotal = qtyInvoiced * unitPrice
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount
  return { subtotal, taxAmount, total }
}

function computeChargeTotals(amount: number, taxRate: number) {
  const taxAmount = amount * (taxRate / 100)
  const total = amount + taxAmount
  return { taxAmount, total }
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
  private async requireById(id: string, branchIds: string[]): Promise<PurchaseInvoiceDetail> {
    const detail = await purchaseInvoicesRepository.findByIdAccessible(id, branchIds)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    return detail
  }

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

  private toTermSnapshot(
    term: Awaited<ReturnType<typeof purchaseOrdersRepository.findSupplierPaymentTerm>>,
  ): PoPaymentTermSnapshot | null {
    if (!term) return null
    return {
      payment_term_id: term.payment_term_id,
      term_name: term.term_name,
      calculation_type: term.calculation_type as CalculationType,
      days: term.days,
      grace_period_days: term.grace_period_days,
      payment_dates: term.payment_dates,
      payment_day_of_week: term.payment_day_of_week,
    }
  }

  /** Compact JSON-safe snapshot for perm_audit_log (monitoring). */
  private snapshotPurchaseInvoiceForAudit(detail: PurchaseInvoiceDetail) {
    const attachments = (detail as PurchaseInvoiceDetail & { attachments?: unknown[] }).attachments
    return {
      invoice_number: detail.invoice_number,
      invoice_date: String(detail.invoice_date).slice(0, 10),
      due_date: detail.due_date ? String(detail.due_date).slice(0, 10) : null,
      status: detail.status,
      notes: detail.notes,
      supplier_name: detail.supplier_name,
      branch_name: detail.branch_name,
      subtotal: Number(detail.subtotal),
      total_tax: Number(detail.total_tax),
      total_charges: Number(detail.total_charges ?? 0),
      total_amount: Number(detail.total_amount),
      gr_links: detail.gr_links.map((g) => ({
        goods_receipt_id: g.goods_receipt_id,
        goods_receipt_number: g.goods_receipt_number,
        received_date: g.received_date ? String(g.received_date).slice(0, 10) : null,
      })),
      lines: detail.lines.map((l) => ({
        id: l.id,
        sort_order: l.sort_order,
        gr_line_id: l.gr_line_id,
        product_id: l.product_id,
        product_code: l.product_code,
        product_name: l.product_name,
        qty_invoiced: Number(l.qty_invoiced),
        unit_price: Number(l.unit_price),
        tax_rate: Number(l.tax_rate),
        subtotal: Number(l.subtotal),
        tax_amount: Number(l.tax_amount),
        total: Number(l.total),
        uom_received: l.uom_received,
        uom_invoice: l.uom_invoice,
      })),
      charges: (detail.charges ?? []).map((c) => ({
        id: c.id,
        charge_type: c.charge_type,
        description: c.description ?? null,
        amount: Number(c.amount),
        tax_rate: Number(c.tax_rate),
        tax_amount: Number(c.tax_amount),
        total: Number(c.total),
        sort_order: c.sort_order,
        affects_dpp: Boolean(c.affects_dpp),
      })),
      attachment_count: Array.isArray(attachments) ? attachments.length : 0,
    }
  }

  /** Tanggal invoice default = tanggal terima barang (GR) terbaru, sama seperti draft otomatis. */
  private async resolveInvoiceDateForNewDraft(
    client: PoolClient,
    invoiceDate: string,
    grIds: string[],
  ): Promise<string> {
    if (grIds.length === 0) return invoiceDate.slice(0, 10)
    const anchors = await purchaseInvoicesRepository.findGrPaymentAnchorDates(client, grIds)
    return anchors.max_received_date ?? invoiceDate.slice(0, 10)
  }

  /** Estimasi jatuh tempo — pakai acuan GR/PO seperti draft otomatis dari GR confirm. */
  private async computeDraftDueDate(
    client: PoolClient,
    supplierId: string,
    invoiceDate: string,
    grIds: string[],
  ): Promise<string | null> {
    const anchors =
      grIds.length > 0
        ? await purchaseInvoicesRepository.findGrPaymentAnchorDates(client, grIds)
        : { max_received_date: null, min_po_payment_due_date: null }
    const term = await purchaseOrdersRepository.findSupplierPaymentTerm(supplierId, client)
    return computePurchaseInvoiceDueDate({
      invoice_date: invoiceDate.slice(0, 10),
      gr_received_date: anchors.max_received_date,
      po_payment_due_date: anchors.min_po_payment_due_date,
      term: this.toTermSnapshot(term),
    })
  }

  /** Persist estimated due_date on draft PI (recalc on save). */
  private async syncDraftDueDate(
    client: PoolClient,
    invoiceId: string,
    supplierId: string,
    invoiceDate: string,
  ): Promise<void> {
    const grIds = await purchaseInvoicesRepository.findGrIdsForInvoice(client, invoiceId)
    const dueDate = await this.computeDraftDueDate(client, supplierId, invoiceDate, grIds)
    await purchaseInvoicesRepository.updateDueDate(client, invoiceId, dueDate)
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

  private buildEnrichedCharges(dtoCharges: CreatePurchaseInvoiceChargeDto[] | undefined, userId: string) {
    const list = dtoCharges ?? []
    let totalChargeTax = 0
    let totalCharges = 0
    let totalChargeAmount = 0
    const enrichedCharges: Array<{
      charge_type: string
      description: string | null
      amount: number
      tax_rate: number
      tax_amount: number
      total: number
      affects_dpp: boolean
      sort_order: number
      created_by: string
      updated_by: string
    }> = []

    for (let i = 0; i < list.length; i++) {
      const c = list[i]
      const amount = Number(c.amount)
      const taxRate = Number(c.tax_rate)
      const affectsDpp = Boolean(c.affects_dpp)
      const { taxAmount, total } = computeChargeTotals(amount, taxRate)
      totalChargeTax += taxAmount
      totalCharges += total
      totalChargeAmount += amount
      enrichedCharges.push({
        charge_type: c.charge_type,
        description: c.description ?? null,
        amount,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        affects_dpp: affectsDpp,
        sort_order: c.sort_order ?? i,
        created_by: userId,
        updated_by: userId,
      })
    }

    return { enrichedCharges, totalChargeTax, totalCharges, totalChargeAmount }
  }

  /**
   * Diskon dengan affects_dpp memperkecil DPP gabungan barang sebelum PPN (praktik umum).
   * PPN barang = tarif seragam × (Σ subtotal + Σ diskon affects_dpp), dialokasi proporsional ke baris.
   * Baris charge diskon tersebut dipaksa tanpa PPN sendiri.
   */
  private applyDppAdjustingDiscountToLineTax(
    enrichedLines: Array<{ subtotal: number; tax_rate: number; tax_amount: number; total: number }>,
    enrichedCharges: Array<{
      charge_type: string
      amount: number
      tax_rate: number
      tax_amount: number
      total: number
      affects_dpp: boolean
    }>,
  ): void {
    const dppDiscounts = enrichedCharges.filter(
      (c) => c.affects_dpp && c.charge_type === 'DISCOUNT' && c.amount < -0.000001,
    )
    if (dppDiscounts.length === 0) return

    const discountSum = dppDiscounts.reduce((s, c) => s + c.amount, 0)
    const S = enrichedLines.reduce((s, l) => s + l.subtotal, 0)
    if (S <= 0) {
      throw new PurchaseInvoiceChargesInvalidError('Tidak dapat menghitung DPP: subtotal barang tidak valid.')
    }

    const netDpp = S + discountSum
    if (netDpp < -0.0001) {
      throw new PurchaseInvoiceChargesInvalidError('DPP net setelah diskon tidak boleh negatif.')
    }

    const r0 = Number(enrichedLines[0].tax_rate)
    const uniform = enrichedLines.every((l) => Math.abs(Number(l.tax_rate) - r0) < 0.001)
    if (!uniform) {
      throw new PurchaseInvoiceChargesInvalidError(
        'Diskon memperkecil DPP hanya jika semua baris barang memiliki PPN % yang sama. Samakan tarif atau matikan opsi pada diskon.',
      )
    }

    const newGoodsPpn = netDpp * (r0 / 100)
    const n = enrichedLines.length
    let allocated = 0
    const SCALE = 1e4
    for (let i = 0; i < n; i++) {
      let tax: number
      if (i < n - 1) {
        tax = Math.round(((newGoodsPpn * enrichedLines[i].subtotal) / S) * SCALE) / SCALE
        allocated += tax
      } else {
        tax = Math.round((newGoodsPpn - allocated) * SCALE) / SCALE
      }
      enrichedLines[i].tax_amount = tax
      enrichedLines[i].total = enrichedLines[i].subtotal + tax
    }

    for (const c of enrichedCharges) {
      if (c.affects_dpp && c.charge_type === 'DISCOUNT') {
        c.tax_rate = 0
        c.tax_amount = 0
        c.total = c.amount
      }
    }
  }

  private computeHeaderTotalsFromLinesAndCharges(
    enrichedLines: Array<{ subtotal: number; tax_amount: number; total: number }>,
    enrichedCharges: Array<{ tax_amount: number; total: number; amount: number }>,
  ): {
    subtotal: number
    total_tax: number
    total_charges: number
    total_amount: number
    totalChargeAmount: number
  } {
    const lineSubtotal = enrichedLines.reduce((s, l) => s + l.subtotal, 0)
    const lineTax = enrichedLines.reduce((s, l) => s + l.tax_amount, 0)
    const lineGrand = enrichedLines.reduce((s, l) => s + l.total, 0)
    const chTax = enrichedCharges.reduce((s, c) => s + c.tax_amount, 0)
    const chTot = enrichedCharges.reduce((s, c) => s + c.total, 0)
    const chAmt = enrichedCharges.reduce((s, c) => s + c.amount, 0)
    return {
      subtotal: lineSubtotal,
      total_tax: lineTax + chTax,
      total_charges: chTot,
      total_amount: lineGrand + chTot,
      totalChargeAmount: chAmt,
    }
  }

  /** Inventory-side debit uses line subtotals + pre-tax charge amounts (e.g. freight in, discount out). */
  private assertHeaderInventoryNonNegative(lineSubtotal: number, totalChargeAmount: number) {
    const base = lineSubtotal + totalChargeAmount
    if (base < -0.0001) {
      throw new PurchaseInvoiceChargesInvalidError(
        'Total diskon/biaya tidak boleh membuat nilai persediaan (subtotal barang + biaya pra-pajak) negatif.',
      )
    }
  }

  private assertRealInvoiceNumber(invoiceNumber: string): void {
    if (isStagingInvoiceNumber(invoiceNumber)) {
      throw new PurchaseInvoicePlaceholderNumberError()
    }
  }

  private async assertGrLineAllocation(
    client: PoolClient,
    lines: Array<{ gr_line_id: string; qty_invoiced: number }>,
    excludeInvoiceId?: string,
  ): Promise<void> {
    if (lines.length === 0) return

    const grLineIds = lines.map((l) => l.gr_line_id)
    const summaries = await purchaseInvoicesRepository.findGrLineAllocationSummary(
      client,
      grLineIds,
      excludeInvoiceId,
    )
    const byId = new Map(summaries.map((s) => [s.gr_line_id, s]))

    for (const line of lines) {
      const summary = byId.get(line.gr_line_id)
      if (!summary) {
        throw new PurchaseInvoiceGrLineOverAllocatedError(line.gr_line_id, 'Baris GR tidak ditemukan.')
      }
      const nextTotal = summary.qty_allocated + line.qty_invoiced
      if (nextTotal > summary.qty_received + 0.0001) {
        throw new PurchaseInvoiceGrLineOverAllocatedError(
          line.gr_line_id,
          `Qty invoice melebihi qty diterima (tersedia: ${(summary.qty_received - summary.qty_allocated).toFixed(4)}, diminta: ${line.qty_invoiced}).`,
        )
      }
    }
  }

  async list(branchIds: string[], pagination: { page: number; limit: number }, filter?: { status?: string; supplier_id?: string; branch_id?: string; date_from?: string; date_to?: string; search?: string }) {
    const offset = (pagination.page - 1) * pagination.limit
    const result = await purchaseInvoicesRepository.findAll(branchIds, { limit: pagination.limit, offset }, filter)
    const data = await this.enrichListWithPaymentDue(result.data)
    const totalPages = Math.ceil(result.total / pagination.limit)
    return {
      data,
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

  async getAvailableGrs(branchIds: string[], supplierId: string, branchId: string | null) {
    if (branchId) requireBranchAccess(branchId, branchIds)
    return purchaseInvoicesRepository.findAvailableGrs(branchIds, supplierId, branchId)
  }

  async getById(id: string, branchIds: string[]): Promise<PurchaseInvoiceDetail> {
    const detail = await purchaseInvoicesRepository.findByIdAccessible(id, branchIds)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    return this.enrichDetail(detail)
  }

  async getByIdForUser(id: string, userId: string): Promise<PurchaseInvoiceDetail> {
    const { getAccessibleBranchIds } = await import('../../utils/branch-access.util')
    return this.getById(id, await getAccessibleBranchIds(userId))
  }

  private async enrichDetail(detail: PurchaseInvoiceDetail): Promise<PurchaseInvoiceDetail> {
    const withUom = await this.enrichDetailWithInvoiceUom(detail)
    return this.enrichDetailWithPaymentDue(withUom)
  }

  private async enrichListWithPaymentDue(
    invoices: PurchaseInvoiceWithRelations[],
  ): Promise<PurchaseInvoiceWithRelations[]> {
    if (invoices.length === 0) return invoices

    const ctxMap = await purchaseInvoicesRepository.findPaymentContextBatch(invoices.map((i) => i.id))
    const supplierIds = [...new Set(invoices.map((i) => i.supplier_id))]
    const termBySupplier = new Map<string, Awaited<ReturnType<typeof purchaseOrdersRepository.findSupplierPaymentTerm>>>()

    await Promise.all(
      supplierIds.map(async (supplierId) => {
        const term = await purchaseOrdersRepository.findSupplierPaymentTerm(supplierId)
        termBySupplier.set(supplierId, term)
      }),
    )

    return invoices.map((inv) => {
      const ctx = ctxMap.get(inv.id)
      const term = termBySupplier.get(inv.supplier_id) ?? null
      const payment_due_info = buildPiPaymentDueInfo({
        status: inv.status,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        po_payment_due_date: ctx?.po_payment_due_date ?? null,
        gr_received_date: ctx?.gr_received_date ?? null,
        term: this.toTermSnapshot(term),
      })
      return { ...inv, payment_due_info }
    })
  }

  private async enrichDetailWithPaymentDue(detail: PurchaseInvoiceDetail): Promise<PurchaseInvoiceDetail> {
    const ctxMap = await purchaseInvoicesRepository.findPaymentContextBatch([detail.id])
    const ctx = ctxMap.get(detail.id)
    const grReceivedFromLinks =
      detail.gr_links.length > 0
        ? detail.gr_links.reduce<string | null>((max, gl) => {
            const d = gl.received_date?.slice(0, 10) ?? null
            if (!d) return max
            return !max || d > max ? d : max
          }, null)
        : null

    const term = await purchaseOrdersRepository.findSupplierPaymentTerm(detail.supplier_id)
    const payment_due_info = buildPiPaymentDueInfo({
      status: detail.status,
      invoice_date: detail.invoice_date,
      due_date: detail.due_date,
      po_payment_due_date: ctx?.po_payment_due_date ?? null,
      gr_received_date: ctx?.gr_received_date ?? grReceivedFromLinks,
      term: this.toTermSnapshot(term),
    })

    return { ...detail, payment_due_info }
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

  private resolveUomIdForInvoiceLine(
    productId: string,
    uomInvoice: string,
    uomRows: Array<{ product_id: string; uom_id: string; unit_name: string }>,
  ): string | null {
    const key = normalizeUomName(uomInvoice)
    const match = uomRows.find(
      (r) => r.product_id === productId && normalizeUomName(r.unit_name) === key,
    )
    return match?.uom_id ?? null
  }

  private async buildPricelistSyncLines(
    detail: PurchaseInvoiceDetail,
    client?: PoolClient,
  ): Promise<PiLineForPricelistSync[]> {
    // enrichDetailWithInvoiceUom: read-only (pool), no writes — resolves uom_invoice from GR/pricelist master.
    const enriched = await this.enrichDetailWithInvoiceUom(detail)
    const productIds = enriched.lines.map((l) => l.product_id)
    const uomRows = await productUomsRepository.findAllUomsWithIdsBatch(productIds, client)
    return enriched.lines.map((line) => ({
      id: line.id,
      product_id: line.product_id,
      product_name: line.product_name,
      unit_price: Number(line.unit_price),
      uom_invoice: line.uom_invoice ?? '',
      uom_id: line.uom_invoice
        ? this.resolveUomIdForInvoiceLine(line.product_id, line.uom_invoice, uomRows)
        : null,
    }))
  }

  /**
   * Recipe/WIP/menu cost propagation runs after pricelist tx commits.
   * Failures are logged — invoice post/unpost is not rolled back; recalc can be retried manually.
   */
  private async recalculateRecipesAfterPricelistChange(
    productIds: Iterable<string>,
    companyId: string,
    context: { invoiceId: string; action: 'post' | 'unpost' },
  ): Promise<void> {
    for (const productId of productIds) {
      try {
        await recipesRepository.recalculateCostFromProduct(productId, companyId)
      } catch (err) {
        logError('Recipe recalc failed after purchase invoice pricelist sync', {
          productId,
          invoiceId: context.invoiceId,
          action: context.action,
          err: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  private async assertAndAssignSupplierBank(
    client: PoolClient,
    invoiceId: string,
    companyId: string,
    supplierId: string,
    supplierBankAccountId: number | null | undefined,
    userId: string,
  ): Promise<void> {
    if (supplierBankAccountId === undefined) return
    if (supplierBankAccountId != null) {
      const valid = await purchaseInvoicesRepository.validateSupplierBankForSupplier(
        client,
        supplierBankAccountId,
        supplierId,
      )
      if (!valid) {
        throw new PurchaseInvoiceSplitValidationError('Rekening supplier tidak valid.')
      }
    }
    await purchaseInvoicesRepository.assignSupplierBankAccount(
      client,
      invoiceId,
      companyId,
      supplierBankAccountId,
      userId,
    )
  }

  async create(branchIds: string[], dto: CreatePurchaseInvoiceDto, userId: string) {
    requireBranchAccess(dto.branch_id, branchIds)
    const companyId = (await getCompanyIdForBranch(dto.branch_id)) ?? ''
    if (!companyId) throw new PurchaseInvoiceNotFoundError(dto.branch_id)

    const invoice = await purchaseInvoicesRepository.withTransaction(async (client) => {
      const grLineIds = dto.lines.map((l) => l.gr_line_id)
      const grLineDetails = await purchaseInvoicesRepository.findGrLineDetailsForInvoicing(client, grLineIds)
      const productIds = grLineDetails.map((g) => g.product_id)
      const maps = await this.loadInvoiceUomMaps(dto.supplier_id, productIds)
      const { enrichedLines, grIds } = this.buildEnrichedLines(
        dto.lines,
        grLineDetails,
        userId,
        dto.supplier_id,
        maps,
      )
      const { enrichedCharges } = this.buildEnrichedCharges(dto.charges, userId)
      this.applyDppAdjustingDiscountToLineTax(enrichedLines, enrichedCharges)
      const hdr = this.computeHeaderTotalsFromLinesAndCharges(enrichedLines, enrichedCharges)
      this.assertHeaderInventoryNonNegative(hdr.subtotal, hdr.totalChargeAmount)
      await this.assertGrLineAllocation(client, dto.lines)

      const invoiceDate = await this.resolveInvoiceDateForNewDraft(client, dto.invoice_date, grIds)
      const dueDate = await this.computeDraftDueDate(client, dto.supplier_id, invoiceDate, grIds)

      const created = await purchaseInvoicesRepository.create(client, companyId, {
        supplier_id: dto.supplier_id,
        branch_id: dto.branch_id,
        invoice_number: dto.invoice_number,
        invoice_date: invoiceDate,
        notes: dto.notes ?? null,
        subtotal: hdr.subtotal,
        total_tax: hdr.total_tax,
        total_charges: hdr.total_charges,
        total_amount: hdr.total_amount,
        due_date: dueDate,
        created_by: userId,
      })

      await purchaseInvoicesRepository.replaceLines(client, created.id, enrichedLines)
      await purchaseInvoicesRepository.replaceCharges(client, created.id, enrichedCharges)
      await purchaseInvoicesRepository.insertGrLinks(client, created.id, grIds)
      await purchaseInvoicesRepository.copyAttachmentsFromGrs(client, created.id, grIds)
      await this.assertAndAssignSupplierBank(
        client,
        created.id,
        companyId,
        dto.supplier_id,
        dto.supplier_bank_account_id,
        userId,
      )
      return created
    })

    const created = await purchaseInvoicesRepository.findById(invoice.id, companyId)
    if (!created) throw new PurchaseInvoiceNotFoundError(invoice.id)
    await AuditService.log(
      'CREATE',
      'purchase_invoices',
      invoice.id,
      userId,
      null,
      this.snapshotPurchaseInvoiceForAudit(created),
    )
    return this.enrichDetail(created)
  }

  async update(id: string, branchIds: string[], dto: UpdatePurchaseInvoiceDto, userId: string) {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (existing.status === 'POSTED') throw new PurchaseInvoiceCannotEditPostedError()
    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') throw new PurchaseInvoiceInvalidStatusError(existing.status, 'DRAFT/REJECTED')

    const previousAudit = this.snapshotPurchaseInvoiceForAudit(existing)

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      const grLineIds = dto.lines.map((l) => l.gr_line_id)
      const grLineDetails = await purchaseInvoicesRepository.findGrLineDetailsForInvoicing(client, grLineIds)
      const maps = await this.loadInvoiceUomMaps(existing.supplier_id, grLineDetails.map((g) => g.product_id))
      const { enrichedLines, grIds } = this.buildEnrichedLines(
        dto.lines,
        grLineDetails,
        userId,
        existing.supplier_id,
        maps,
      )
      const { enrichedCharges } = this.buildEnrichedCharges(dto.charges, userId)
      this.applyDppAdjustingDiscountToLineTax(enrichedLines, enrichedCharges)
      const hdr = this.computeHeaderTotalsFromLinesAndCharges(enrichedLines, enrichedCharges)
      this.assertHeaderInventoryNonNegative(hdr.subtotal, hdr.totalChargeAmount)
      await this.assertGrLineAllocation(client, dto.lines, id)

      await purchaseInvoicesRepository.replaceLines(client, id, enrichedLines)
      await purchaseInvoicesRepository.replaceCharges(client, id, enrichedCharges)
      await purchaseInvoicesRepository.replaceGrLinks(client, id, grIds)
      await purchaseInvoicesRepository.copyAttachmentsFromGrs(client, id, grIds)
      await purchaseInvoicesRepository.updateStatus(client, id, existing.status, {
        subtotal: hdr.subtotal,
        total_tax: hdr.total_tax,
        total_charges: hdr.total_charges,
        total_amount: hdr.total_amount,
        notes: dto.notes ?? existing.notes,
        invoice_date: dto.invoice_date,
        invoice_number: dto.invoice_number,
        updated_by: userId,
      })
      await this.syncDraftDueDate(client, id, existing.supplier_id, dto.invoice_date)
      await this.assertAndAssignSupplierBank(
        client,
        id,
        companyId,
        existing.supplier_id,
        dto.supplier_bank_account_id,
        userId,
      )
    })

    const refreshed = await purchaseInvoicesRepository.findById(id, companyId)
    if (!refreshed) throw new PurchaseInvoiceNotFoundError(id)
    await AuditService.log(
      'UPDATE',
      'purchase_invoices',
      id,
      userId,
      previousAudit,
      this.snapshotPurchaseInvoiceForAudit(refreshed),
    )
    return this.enrichDetail(refreshed)
  }

  async submit(id: string, branchIds: string[], userId: string) {
    const detail = await this.requireById(id, branchIds)
    const companyId = detail.company_id
    if (detail.status !== 'DRAFT' && detail.status !== 'REJECTED') throw new PurchaseInvoiceInvalidStatusError(detail.status, 'DRAFT/REJECTED')
    this.assertRealInvoiceNumber(detail.invoice_number)

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      await purchaseInvoicesRepository.updateStatus(client, id, 'SUBMITTED', {
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
        updated_by: userId,
      })
    })
    await AuditService.log('UPDATE', 'purchase_invoices', id, userId, { status: detail.status }, { status: 'SUBMITTED' })

    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_SUBMITTED,
      companyId,
      {
        entityId: id,
        variables: { invoice_number: detail.invoice_number },
        excludeUserIds: [userId],
      }
    )

    return this.getByIdForUser(id, userId)
  }

  async approve(id: string, branchIds: string[], userId: string) {
    const detail = await this.requireById(id, branchIds)
    const companyId = detail.company_id
    if (detail.status !== 'SUBMITTED') throw new PurchaseInvoiceInvalidStatusError(detail.status, 'SUBMITTED')

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      await purchaseInvoicesRepository.updateStatus(client, id, 'APPROVED', {
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_by: userId,
      })
    })
    await AuditService.log('UPDATE', 'purchase_invoices', id, userId, { status: detail.status }, { status: 'APPROVED' })

    const recipientId = detail.submitted_by || detail.created_by
    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_APPROVED,
      companyId,
      {
        entityId: id,
        variables: { invoice_number: detail.invoice_number },
        additionalRecipientIds: recipientId ? [recipientId] : [],
        excludeUserIds: [userId],
      }
    )

    // AP Payment draft is NOT auto-created here.
    // Invoice will appear in Outstanding tab for manual payment creation.

    return this.getByIdForUser(id, userId)
  }

  async reject(id: string, branchIds: string[], reason: string, userId: string) {
    const detail = await this.requireById(id, branchIds)
    const companyId = detail.company_id
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

    const recipientId = detail.submitted_by || detail.created_by
    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_REJECTED,
      companyId,
      {
        entityId: id,
        variables: {
          invoice_number: detail.invoice_number,
          rejection_reason: reason,
        },
        additionalRecipientIds: recipientId ? [recipientId] : [],
        excludeUserIds: [userId],
      }
    )

    try {
      await apPaymentsService.cancelDraftPaymentsForRejectedInvoice(id, userId)
    } catch (err) {
      logInfo('AP draft cancel failed after PI reject (non-blocking)', { id, err })
    }

    return this.getByIdForUser(id, userId)
  }

  async post(id: string, branchIds: string[], userId: string) {
    const detail = await this.requireById(id, branchIds)
    const companyId = detail.company_id
    if (detail.status !== 'APPROVED') throw new PurchaseInvoiceInvalidStatusError(detail.status, 'APPROVED')
    if (detail.journal_id) throw new PurchaseInvoiceJournalAlreadyExistsError()

    let pricelistSync: PricelistSyncResult = { synced: 0, skipped: 0, warnings: [] }
    const recipeProductIds = new Set<string>()

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      const unconfirmedGpNumber = await purchaseInvoicesRepository.findUnconfirmedGpProcessingNumber(client, id)
      if (unconfirmedGpNumber) {
        throw new PurchaseInvoiceGpNotConfirmedError(unconfirmedGpNumber)
      }

      const postingRows = await purchaseInvoicesRepository.findPostingRowsForInvoice(client, id)

      // For pure-asset PIs, postingRows will be empty (no GP inputs/outputs).
      // Check if ALL PI lines are asset products — if so, skip inventory posting logic.
      const isPureAssetInvoice = (!postingRows || postingRows.length === 0)
        ? await purchaseInvoicesRepository.checkAllLinesAreAssets(client, id)
        : false

      if (!postingRows || postingRows.length === 0) {
        if (!isPureAssetInvoice) {
          throw new PurchaseInvoiceGrNotEligibleError()
        }
      }

      // ─── Defense: reject mixed asset + non-asset invoices ──────────────────
      // Business rule: PI harus homogen (semua asset atau semua non-asset).
      // Constraint ini enforced di UI (product picker), tapi guard ini
      // mencegah double-booking AP jika constraint UI ter-bypass.
      if (!isPureAssetInvoice && postingRows && postingRows.length > 0) {
        const hasAssetLine = await purchaseInvoicesRepository.checkHasAnyAssetLine(client, id)
        if (hasAssetLine) {
          throw new PurchaseInvoiceMixedAssetLinesError()
        }
      }

      // ─── Inventory cost allocation (non-asset lines only) ──────────────────
      // For pure-asset PIs, postingRows is empty — skip cost allocation entirely.
      if (postingRows && postingRows.length > 0) {
        const rowsByLineId = new Map<string, typeof postingRows>()
        for (const r of postingRows) {
          const key = r.purchase_invoice_line_id
          const arr = rowsByLineId.get(key) ?? []
          arr.push(r)
          rowsByLineId.set(key, arr)
        }

        const productIds = [
          ...new Set(postingRows.flatMap((r) => [r.product_id, r.input_product_id])),
        ]
        const uomsMap = buildProductUomsMap(await productUomsRepository.findAllUomsBatch(productIds))

        const inputProductIds = [...new Set(postingRows.map((r) => r.input_product_id))]
        const templatesByInput = await productOutputTemplateRepository.findByProductIds(inputProductIds)

        const recomputePairs: Array<{ product_id: string; warehouse_id: string }> = []
        const seenPairs = new Set<string>()

        for (const [purchase_invoice_line_id, lineRows] of rowsByLineId.entries()) {
          const head = lineRows[0]
          const inputProductId = head.input_product_id
          const lineSubtotal = resolveGpInputCostFromGrLine(
            {
              product_id: inputProductId,
              total_price_invoice: Number(head.line_subtotal),
              unit_price_invoice: Number(head.unit_price),
              qty_po_uom: Number(head.qty_po_uom),
              qty_received: Number(head.qty_received),
              uom_po: head.uom_po,
              uom_received: head.uom_received,
              qty_rejected: Number(head.qty_rejected ?? 0),
            },
            uomsMap,
          )
          const bearsCostMap = buildBearsCostMap(
            (templatesByInput[inputProductId] ?? []).map((t) => ({
              output_product_id: t.output_product_id,
              bears_cost: t.bears_cost,
            })),
          )

          const allocations = allocateLineCostToGpOutputs(
            lineSubtotal,
            lineRows.map((r) => ({
              ...r,
              output_sort_order: Number(r.output_sort_order),
            })),
            bearsCostMap,
            uomsMap,
          )

          const hasCostBearingQty = allocations.some((a) => a.baseQty > 0 && a.allocatedCost > 0)
          if (!hasCostBearingQty && lineSubtotal > 0) continue

          for (const { output: out, allocatedCost, unitCost } of allocations) {
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
      }

      const coaByCode = new Map<string, string>()
      for (const r of await purchaseInvoicesRepository.findCoaIdsByCodes(client, companyId, ['110501', '510304', '210101'])) {
        coaByCode.set(r.account_code, r.id)
      }

      const coaInv = coaByCode.get('110501')
      const coaTax = coaByCode.get('510304') // PPN Masukan
      const coaPayable = coaByCode.get('210101')
      if (!coaInv || !coaTax || !coaPayable) {
        throw new Error('COA codes missing for purchase invoice posting')
      }

      const subtotal = Number(detail.subtotal ?? 0)
      const chargeAmountSum = (detail.charges ?? []).reduce((s, c) => s + Number(c.amount), 0)
      const debitInventory = subtotal + chargeAmountSum
      const totalTax = Number(detail.total_tax ?? 0)
      const totalAmount = Number(detail.total_amount ?? 0)

      const hasChargeBase = Math.abs(chargeAmountSum) > 0.000001
      const fmtIdr = (n: number) =>
        new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(n))

      const journalDescriptionBase = `Faktur Pembelian ${detail.invoice_number}${detail.supplier_name ? ` - ${detail.supplier_name}` : ''}`
      const journalDescription = hasChargeBase
        ? `${journalDescriptionBase}. Posting: debit persediaan = nilai net (subtotal barang Rp ${fmtIdr(subtotal)} + Σ amount charges pra-PPN Rp ${fmtIdr(chargeAmountSum)}; diskon sebagai nilai negatif).`
        : journalDescriptionBase
      const inventoryDebitDescription = hasChargeBase
        ? `${journalDescriptionBase} — Persediaan (net Rp ${fmtIdr(debitInventory)}) = subtotal barang Rp ${fmtIdr(subtotal)} + penyesuaian charges pra-PPN Rp ${fmtIdr(chargeAmountSum)}`
        : journalDescriptionBase

      const period = await purchaseInvoicesRepository.findFiscalPeriodForDate(client, companyId, detail.invoice_date)
      if (!period) {
        throw new Error(`Fiscal period not found for invoice date ${detail.invoice_date}`)
      }

      // ─── Pure-asset PI with no PPN: skip journal entirely ──────────────────
      // No inventory to debit, no tax to record. capitalizeAssetsFromInvoice
      // will handle the full accounting (Dr Asset, Cr AP) after this tx commits.
      // journal_id stays null — consistent with other modules (production_orders,
      // stock_transfers) that can be "posted/completed" without a journal.
      let journalId: string | null = null

      if (!(isPureAssetInvoice && totalTax === 0)) {
        const sequence = await purchaseInvoicesRepository.getNextJournalSequence(client, companyId, period)
        const year = detail.invoice_date.substring(0, 4)
        const month = detail.invoice_date.substring(5, 7)
        const journalNumber = `JG/${year}${month}/${String(sequence).padStart(5, '0')}`

        // ─── Pure-asset PI with PPN: only record PPN portion ─────────────────
        // Asset cost (subtotal) will be journaled by capitalizeAssetsFromInvoice
        // (Dr Asset COA, Cr AP). PI posting only handles the PPN portion here.
        const journalTotalDebit = isPureAssetInvoice ? totalTax : (debitInventory + totalTax)
        const journalTotalCredit = isPureAssetInvoice ? totalTax : totalAmount
        const journalDescriptionFinal = isPureAssetInvoice
          ? `${journalDescriptionBase} — PPN atas pembelian aset tetap`
          : journalDescription

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
          description: journalDescriptionFinal,
          totalDebit: journalTotalDebit,
          totalCredit: journalTotalCredit,
          createdBy: userId,
        })

        journalId = journalHeader.id

        if (isPureAssetInvoice) {
          // Pure-asset PI with PPN > 0: only PPN journal lines.
          await purchaseInvoicesRepository.createJournalLines(client, {
            journalHeaderId: journalHeader.id,
            debitAccountId: coaTax,
            debitAmount: totalTax,
            taxAccountId: coaTax,
            taxAmount: 0,
            creditAccountId: coaPayable,
            creditAmount: totalTax,
            description: journalDescriptionFinal,
            inventoryDebitDescription: journalDescriptionFinal,
          })
        } else {
          // Normal PI: full inventory + PPN journal
          await purchaseInvoicesRepository.createJournalLines(client, {
            journalHeaderId: journalHeader.id,
            debitAccountId: coaInv,
            debitAmount: debitInventory,
            taxAccountId: coaTax,
            taxAmount: totalTax,
            creditAccountId: coaPayable,
            creditAmount: totalAmount,
            description: journalDescription,
            inventoryDebitDescription,
          })
        }
      }

      const grIds = await purchaseInvoicesRepository.findGrIdsForInvoice(client, id)
      const dueDate = await this.computeDraftDueDate(
        client,
        detail.supplier_id,
        String(detail.invoice_date),
        grIds,
      )
      const supplierTerm = await purchaseOrdersRepository.findSupplierPaymentTerm(detail.supplier_id, client)
      if (dueDate) {
        await purchaseInvoicesRepository.updateDueDate(client, id, dueDate)
        if (supplierTerm?.calculation_type === 'from_invoice') {
          await purchaseInvoicesRepository.updatePaymentDueDateForReferencedPOs(client, id, dueDate)
        }
      }

      await purchaseInvoicesRepository.updateGoodsReceiptQtyInvoiced(client, id)

      const detailInTx = await purchaseInvoicesRepository.findById(id, companyId, client)
      if (detailInTx) {
        const syncLines = await this.buildPricelistSyncLines(detailInTx, client)
        const { result, affectedProductIds } = await pricelistsService.syncAllFromPostedPurchaseInvoice({
          client,
          companyId,
          supplierId: detail.supplier_id,
          invoiceId: id,
          invoiceDate: String(detail.invoice_date).slice(0, 10),
          userId,
          lines: syncLines,
        })
        pricelistSync = result
        for (const productId of affectedProductIds) {
          recipeProductIds.add(productId)
        }
      }

      // ─── Fixed Asset Capitalization Hook ─────────────────────────────────────────
      // Deferred until after PI transaction commits (see post() after withTransaction)

      await purchaseInvoicesRepository.updateStatus(client, id, 'POSTED', {
        posted_by: userId,
        posted_at: new Date().toISOString(),
        updated_by: userId,
        journal_id: journalId,
      })
    })

    const { rows: assetCheck } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM purchase_invoice_lines pil
         JOIN products p ON p.id = pil.product_id
         WHERE pil.purchase_invoice_id = $1 AND p.is_asset = true AND pil.deleted_at IS NULL
       ) AS exists`,
      [id],
    )
    if (assetCheck[0]?.exists) {
      await assetLifecycleService.capitalizeAssetsFromInvoice(
        id,
        String(detail.invoice_date).slice(0, 10),
        userId,
      )
    }

    await this.recalculateRecipesAfterPricelistChange(recipeProductIds, companyId, {
      invoiceId: id,
      action: 'post',
    })

    await AuditService.log('UPDATE', 'purchase_invoices', id, userId, { status: detail.status }, { status: 'POSTED' })

    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_POSTED,
      companyId,
      {
        entityId: id,
        variables: { invoice_number: detail.invoice_number },
        excludeUserIds: [userId],
      }
    )

    const invoice = await this.getByIdForUser(id, userId)
    return { ...invoice, pricelist_sync: pricelistSync }
  }

  /**
   * Reverse all side effects of post() in one transaction (hard-delete journal, not reversal).
   *
   * Design notes:
   * - avg_cost: recomputeStockBalanceAvgCost recalculates WA from ALL positive IN movements
   *   with cost > 0 after movement costs are zeroed — full recompute, not partial.
   * - PO payment_due_date: only touched when term calculation_type === 'from_invoice',
   *   symmetric with post() which only sets PO due from PI on that term type.
   *   Other terms (from_delivery, weekly, …) keep PO due from GR confirm — unchanged here.
   * - qty_invoiced: recalculateGrQtyInvoicedForGrLines sums ALL POSTED PIs per GR line.
   * - Fiscal period: checked on invoice_date (same as journal_date on post), not posted_at.
   *   Unpost hard-deletes the journal in that period; closed period → block (audit integrity).
   * - PurchaseInvoicePricelistSupersededError (409): thrown inside tx → full rollback incl. pricelist revert.
   * - TODO(purchase-payments): guard when purchase_payment linked to this invoice exists.
   */
  async unpost(id: string, branchIds: string[], userId: string) {
    const detail = await this.requireById(id, branchIds)
    const companyId = detail.company_id
    if (detail.status !== 'POSTED') throw new PurchaseInvoiceNotPostedError()

    const journalId = detail.journal_id

    // TODO(purchase-payments): if (await hasLinkedPayments(client, id)) throw PurchaseInvoiceHasPaymentsError()

    const recipeProductIds = new Set<string>()

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      // ─── Narrow guard: journal_id null is valid ONLY for pure-asset PI with no tax ─
      if (!journalId) {
        const allAsset = await purchaseInvoicesRepository.checkAllLinesAreAssets(client, id)
        const totalTax = Number(detail.total_tax ?? 0)
        if (!(allAsset && totalTax === 0)) {
          // Anomalous: PI is POSTED without journal but is NOT a valid pure-asset-no-tax case.
          throw new PurchaseInvoiceNoJournalError()
        }
      }

      // Journal is created with journal_date = invoice_date on post — period gate matches that date.
      const periodOpen = await purchaseInvoicesRepository.isFiscalPeriodOpen(
        client,
        companyId,
        String(detail.invoice_date),
      )
      if (!periodOpen) {
        throw new PurchaseInvoiceInvalidStatusError(
          'closed fiscal period',
          'open fiscal period for invoice date',
        )
      }

      // ─── Asset Capitalization Reversal Guard & Execution ───────────────────
      // Must run BEFORE any writes to ensure clean rollback if guard throws.
      const { rows: capitalizedAssets } = await client.query<{
        id: string; asset_code: string; status: string; cost: number; journal_id: string | null
      }>(
        `SELECT id, asset_code, status, cost, journal_id FROM fixed_assets
         WHERE purchase_invoice_id = $1 AND deleted_at IS NULL
         ORDER BY id
         FOR UPDATE`,
        [id],
      )

      if (capitalizedAssets.length > 0) {
        for (const asset of capitalizedAssets) {
          if (asset.status === 'DISPOSED') {
            throw new BusinessRuleError(
              `Tidak dapat unpost: aset "${asset.asset_code}" sudah di-dispose`
            )
          }
          if (asset.status === 'MAINTENANCE') {
            const { rows: [{ has_journal }] } = await client.query<{ has_journal: boolean }>(
              `SELECT EXISTS(
                 SELECT 1 FROM asset_maintenance
                 WHERE fixed_asset_id = $1 AND journal_id IS NOT NULL AND deleted_at IS NULL
               ) AS has_journal`,
              [asset.id],
            )
            if (has_journal) {
              throw new BusinessRuleError(
                `Tidak dapat unpost: aset "${asset.asset_code}" sedang maintenance dengan jurnal terkait`
              )
            }
          }
          const { rows: [{ has_depr }] } = await client.query<{ has_depr: boolean }>(
            `SELECT EXISTS(
               SELECT 1 FROM asset_depreciation_entries WHERE fixed_asset_id = $1
             ) AS has_depr`,
            [asset.id],
          )
          if (has_depr) {
            throw new BusinessRuleError(
              `Tidak dapat unpost: aset "${asset.asset_code}" sudah memiliki catatan penyusutan. ` +
              `Batalkan penyusutan terlebih dahulu.`
            )
          }
        }

        // All assets passed guard — safe to revert
        const assetJournalIds = [...new Set(
          capitalizedAssets.map(a => a.journal_id).filter((jId): jId is string => jId != null)
        )]

        for (const asset of capitalizedAssets) {
          await fixedAssetsRepository.revertCapitalization(
            asset.id, companyId, { cost: asset.cost, updated_by: userId }, client,
          )
          await client.query(
            `DELETE FROM asset_movements
             WHERE fixed_asset_id = $1
               AND movement_type = 'CAPITALIZE'
               AND reference_id = $2
               AND reference_type = 'purchase_invoice'`,
            [asset.id, id],
          )
        }

        if (assetJournalIds.length > 0) {
          await journalHeadersRepository.bulkHardDelete(assetJournalIds, client)
        }
      }

      const affectedProducts = await pricelistsService.revertPricelistOnPurchaseInvoiceUnpost({
        client,
        companyId,
        invoiceId: id,
        invoiceDate: String(detail.invoice_date).slice(0, 10),
        userId,
      })
      for (const productId of affectedProducts) {
        recipeProductIds.add(productId)
      }

      const stockPairs = await purchaseInvoicesRepository.findUnpostStockPairsForInvoice(client, id)

      await purchaseInvoicesRepository.resetStockMovementCostsForInvoice(client, id)
      await purchaseInvoicesRepository.resetGpOutputCostsForInvoice(client, id)

      const seenPairs = new Set<string>()
      for (const row of stockPairs) {
        const pairKey = `${row.product_id}-${row.warehouse_id}`
        if (seenPairs.has(pairKey)) continue
        seenPairs.add(pairKey)
        await purchaseInvoicesRepository.recomputeStockBalanceAvgCost(
          client,
          row.warehouse_id,
          row.product_id,
        )
      }

      await purchaseInvoicesRepository.updateStatus(client, id, 'APPROVED', {
        journal_id: null,
        posted_by: null,
        posted_at: null,
        updated_by: userId,
      })

      // Only delete journal if one was created during post (skip for pure-asset no-tax PIs)
      if (journalId) {
        await journalHeadersRepository.bulkHardDelete([journalId], client)
      }

      const grIds = await purchaseInvoicesRepository.findGrIdsForInvoice(client, id)
      const draftDueDate = await this.computeDraftDueDate(
        client,
        detail.supplier_id,
        String(detail.invoice_date),
        grIds,
      )
      await purchaseInvoicesRepository.updateDueDate(client, id, draftDueDate)

      await purchaseInvoicesRepository.recalculateGrQtyInvoicedForGrLines(client, id)

      // Mirror post(): PO due only flows from PI when term is from_invoice.
      const supplierTerm = await purchaseOrdersRepository.findSupplierPaymentTerm(detail.supplier_id, client)
      if (supplierTerm?.calculation_type === 'from_invoice') {
        const poIds = await purchaseInvoicesRepository.findPoIdsForInvoice(client, id)
        for (const poId of poIds) {
          const latestDue = await purchaseInvoicesRepository.findLatestPostedPiDueDateForPo(client, poId)
          await purchaseInvoicesRepository.updatePoPaymentDueDate(client, poId, latestDue)
        }
      }
    })

    await this.recalculateRecipesAfterPricelistChange(recipeProductIds, companyId, {
      invoiceId: id,
      action: 'unpost',
    })

    await AuditService.log(
      'UPDATE',
      'purchase_invoices',
      id,
      userId,
      { status: 'POSTED', journal_id: journalId },
      { status: 'APPROVED', journal_id: null, unpost: true },
    )
    return this.getByIdForUser(id, userId)
  }

  async createDraftFromGr(client: PoolClient, companyId: string, grId: string, userId: string) {
    const existingId = await purchaseInvoicesRepository.findActiveDraftInvoiceForGr(
      client,
      grId,
      companyId,
    )
    if (existingId) {
      const existing = await purchaseInvoicesRepository.findById(existingId, companyId, client)
      if (existing) return existing
    }

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

    const today = new Date().toISOString().split('T')[0]
    const grReceived = gr.received_date ? String(gr.received_date).slice(0, 10) : today
    const invoiceDate = grReceived
    const estimatedDueDate = await this.computeDraftDueDate(client, gr.supplier_id, invoiceDate, [grId])

    // 3. Create PI Header (invoice_date = tanggal terima barang; due_date = estimasi dari term)
    const invoice = await purchaseInvoicesRepository.create(client, companyId, {
      supplier_id: gr.supplier_id,
      branch_id: gr.branch_id,
      invoice_number: `[INV] ${gr.gr_number}`,      
      invoice_date: invoiceDate,
      notes: `Auto-generated from GR ${gr.gr_number}`,
      subtotal,
      total_tax: totalTax,
      total_charges: 0,
      total_amount: totalAmount,
      due_date: estimatedDueDate,
      created_by: userId,
    })

    // 4. Insert Lines & GR Links
    await purchaseInvoicesRepository.replaceLines(client, invoice.id, piLines)
    await purchaseInvoicesRepository.insertGrLinks(client, invoice.id, [grId])

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

  async delete(id: string, branchIds: string[], userId: string) {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id

    await purchaseInvoicesRepository.withTransaction(async (client) => {
      await purchaseInvoicesRepository.softDelete(client, id, companyId, userId)
    })
    await AuditService.log('DELETE', 'purchase_invoices', id, userId)
    return true
  }

  async mergeInvoices(branchIds: string[], invoiceIds: string[], userId: string) {
    if (invoiceIds.length < 2) throw new Error('At least two invoices are required to merge')

    for (const invId of invoiceIds) {
      await this.requireById(invId, branchIds)
    }
    const first = await this.requireById(invoiceIds[0], branchIds)
    const companyId = first.company_id

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
        total_charges: 0,
        total_amount: 0,
        created_by: userId,
      })

      await purchaseInvoicesRepository.moveLinesToMasterInvoice(client, created.id, userId, invoiceIds)
      await purchaseInvoicesRepository.moveGrLinksToMasterInvoice(client, created.id, invoiceIds)
      await purchaseInvoicesRepository.moveChargesToMasterInvoice(client, created.id, invoiceIds)
      await purchaseInvoicesRepository.moveAttachmentsToMasterInvoice(client, created.id, invoiceIds)

      const totals = await purchaseInvoicesRepository.sumFullInvoiceHeaderTotals(client, created.id)
      await purchaseInvoicesRepository.updateMasterInvoiceAfterMerge(client, created.id, totals, invoiceIds, userId)
      await purchaseInvoicesRepository.softDeleteInvoicesByIds(client, invoiceIds, userId)

      const mergedGrIds = await purchaseInvoicesRepository.findGrIdsForInvoice(client, created.id)
      const mergedInvoiceDate = await this.resolveInvoiceDateForNewDraft(
        client,
        new Date().toISOString().split('T')[0],
        mergedGrIds,
      )
      const mergedDueDate = await this.computeDraftDueDate(
        client,
        supplierId,
        mergedInvoiceDate,
        mergedGrIds,
      )
      await purchaseInvoicesRepository.updateDraftHeaderDates(
        client,
        created.id,
        mergedInvoiceDate,
        mergedDueDate,
      )
      return created
    })

    await AuditService.log('CREATE', 'purchase_invoices', master.id, userId, { merged_from: invoiceIds })
    return this.getByIdForUser(master.id, userId)
  }

  /**
   * Pecah 1 PI DRAFT menjadi beberapa PI (1 nota supplier = 1 PI).
   * Semua baris source wajib dialokasi tepat sekali; tidak boleh ada sisa di source.
   */
  async splitInvoice(
    sourceId: string,
    branchIds: string[],
    dto: SplitPurchaseInvoiceDto,
    userId: string,
  ): Promise<SplitPurchaseInvoiceResult> {
    const scoped = await this.requireById(sourceId, branchIds)
    const companyId = scoped.company_id
    if (dto.splits.length < 2) {
      throw new PurchaseInvoiceSplitValidationError(
        'Minimal 2 nota untuk pecah invoice. Jika hanya 1 nota, edit invoice staging dan isi nomor invoice supplier.',
      )
    }

    const created = await purchaseInvoicesRepository.withTransaction(async (client) => {
      const source = await purchaseInvoicesRepository.findById(sourceId, companyId, client)
      if (!source) throw new PurchaseInvoiceNotFoundError(sourceId)
      if (source.status !== 'DRAFT' && source.status !== 'REJECTED') {
        throw new PurchaseInvoiceInvalidStatusError(source.status, 'DRAFT/REJECTED')
      }

      const chargeCount = await purchaseInvoicesRepository.countActiveCharges(client, sourceId)
      if (chargeCount > 0) {
        throw new PurchaseInvoiceHasChargesError()
      }

      const sourceLineIds = new Set(source.lines.map((l) => l.gr_line_id))
      const lineByGrId = new Map(source.lines.map((l) => [l.gr_line_id, l]))
      const allSplitGrLineIds = dto.splits.flatMap((s) => s.gr_line_ids)
      const grLineDetails = await purchaseInvoicesRepository.findGrLineDetailsForInvoicing(
        client,
        allSplitGrLineIds,
      )
      const grIdByLineId = new Map(grLineDetails.map((g) => [g.id, g.gr_id]))

      const allocated = new Set<string>()
      const numbersInBatch = new Set<string>()

      for (const split of dto.splits) {
        const num = split.invoice_number.trim()
        if (numbersInBatch.has(num.toLowerCase())) {
          throw new PurchaseInvoiceSplitValidationError(
            `Nomor invoice "${num}" duplikat dalam permintaan pecah.`,
          )
        }
        numbersInBatch.add(num.toLowerCase())

        if (split.gr_line_ids.length === 0) {
          throw new PurchaseInvoiceSplitValidationError(
            `Nota "${num}" harus memiliki minimal 1 baris item.`,
          )
        }

        for (const grLineId of split.gr_line_ids) {
          if (!sourceLineIds.has(grLineId)) {
            throw new PurchaseInvoiceSplitValidationError(
              `Baris GR tidak ada di invoice sumber: ${grLineId}`,
            )
          }
          if (allocated.has(grLineId)) {
            throw new PurchaseInvoiceSplitValidationError(
              `Baris GR ${grLineId} dialokasi lebih dari sekali.`,
            )
          }
          allocated.add(grLineId)
        }

        const duplicate = await purchaseInvoicesRepository.findDuplicateInvoiceNumber(
          client,
          companyId,
          source.supplier_id,
          num,
          [sourceId],
        )
        if (duplicate) {
          throw new PurchaseInvoiceDuplicateNumberError(num)
        }
      }

      if (allocated.size !== sourceLineIds.size) {
        const missing = [...sourceLineIds].filter((id) => !allocated.has(id))
        throw new PurchaseInvoiceSplitValidationError(
          `Semua baris wajib dialokasi ke nota (${missing.length} baris belum dipilih).`,
        )
      }

      const createdInvoices: Array<{ id: string; invoice_number: string }> = []

      for (const split of dto.splits) {
        const piLineIds = split.gr_line_ids.map((gid) => lineByGrId.get(gid)!.id)
        const grIds = [
          ...new Set(
            split.gr_line_ids
              .map((gid) => grIdByLineId.get(gid))
              .filter((x): x is string => x != null),
          ),
        ]

        const movedLines = split.gr_line_ids.map((gid) => lineByGrId.get(gid)!)
        const subtotal = movedLines.reduce((s, l) => s + Number(l.subtotal), 0)
        const totalTax = movedLines.reduce((s, l) => s + Number(l.tax_amount), 0)
        const totalAmount = movedLines.reduce((s, l) => s + Number(l.total), 0)

        const dueDate = await this.computeDraftDueDate(
          client,
          source.supplier_id,
          split.invoice_date,
          grIds.length > 0 ? grIds : await purchaseInvoicesRepository.findGrIdsForInvoice(client, sourceId),
        )

        const header = await purchaseInvoicesRepository.create(client, companyId, {
          supplier_id: source.supplier_id,
          branch_id: source.branch_id,
          invoice_number: split.invoice_number.trim(),
          invoice_date: split.invoice_date,
          notes: split.notes ?? null,
          subtotal,
          total_tax: totalTax,
          total_charges: 0,
          total_amount: totalAmount,
          due_date: dueDate,
          created_by: userId,
        })

        await purchaseInvoicesRepository.moveInvoiceLinesByIds(
          client,
          piLineIds,
          header.id,
          userId,
        )

        await purchaseInvoicesRepository.insertGrLinks(client, header.id, grIds)
        await purchaseInvoicesRepository.copyAttachmentsFromGrs(client, header.id, grIds)

        if (split.supplier_bank_account_id != null) {
          const valid = await purchaseInvoicesRepository.validateSupplierBankForSupplier(
            client,
            split.supplier_bank_account_id,
            source.supplier_id,
          )
          if (!valid) {
            throw new PurchaseInvoiceSplitValidationError(
              `Rekening supplier tidak valid untuk nota "${split.invoice_number.trim()}".`,
            )
          }
          await purchaseInvoicesRepository.assignSupplierBankAccount(
            client,
            header.id,
            companyId,
            split.supplier_bank_account_id,
            userId,
          )
        }

        createdInvoices.push({ id: header.id, invoice_number: header.invoice_number })
      }

      await purchaseInvoicesRepository.softDelete(client, sourceId, companyId, userId)

      return createdInvoices
    })

    await AuditService.log('UPDATE', 'purchase_invoices', sourceId, userId, null, {
      action: 'split',
      created_invoices: created,
    })

    for (const inv of created) {
      await AuditService.log('CREATE', 'purchase_invoices', inv.id, userId, null, {
        split_from: sourceId,
      })
    }

    return {
      source_invoice_id: sourceId,
      created_invoices: created,
    }
  }

  async getCounts(branchIds: string[]) {
    return purchaseInvoicesRepository.findStatusCounts(branchIds)
  }
}

export const purchaseInvoicesService = new PurchaseInvoicesService()