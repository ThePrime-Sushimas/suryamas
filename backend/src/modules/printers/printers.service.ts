import { printersRepository } from './printers.repository'
import { purchaseRequestsRepository } from '../purchase-requests/purchase-requests.repository'
import { PrinterNotFoundError, PrinterConnectionError } from './printers.errors'
import { PurchaseRequestNotFoundError } from '../purchase-requests/purchase-requests.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { buildDocReceipt, buildGoodsReceiptReceipt, buildDailyPrepOrderReceipt, buildStockTransferReceipt, sendToPrinter, testPrinterConnection, fmt } from './printers.print'
import { goodsReceiptsRepository } from '../goods-receipts/goods-receipts.repository'
import { GoodsReceiptNotFoundError } from '../goods-receipts/goods-receipts.errors'
import { dailyPrepOrdersRepository } from '../daily-prep-orders/daily-prep-orders.repository'
import { DpoNotFoundError } from '../daily-prep-orders/daily-prep-orders.errors'
import { stockTransfersRepository } from '../stock-transfers/stock-transfers.repository'
import { StockTransferNotFoundError } from '../stock-transfers/stock-transfers.errors'
import { productionRequestsRepository } from '../production-requests/production-requests.repository'
import type { GoodsReceiptLineWithRelations } from '../goods-receipts/goods-receipts.types'
import { BusinessRuleError } from '../../utils/errors.base'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'
import { logInfo } from '../../config/logger'
import type { CreatePrinterDto, UpdatePrinterDto, PrinterWithRelations } from './printers.types'

export class PrintersService {
  async list(companyId: string, userId: string): Promise<PrinterWithRelations[]> {
    const accessibleBranchIds = await getAccessibleBranchIds(userId)
    return printersRepository.findAllAccessible(companyId, accessibleBranchIds)
  }

  private async assertPrintAccess(
    printer: PrinterWithRelations,
    userId: string,
    documentBranchId: string,
  ): Promise<void> {
    const accessibleBranchIds = await getAccessibleBranchIds(userId)
    if (!accessibleBranchIds.includes(documentBranchId)) {
      throw new BusinessRuleError('Anda tidak memiliki akses ke cabang dokumen ini')
    }
    if (printer.branch_id && !accessibleBranchIds.includes(printer.branch_id)) {
      throw new BusinessRuleError('Anda tidak memiliki akses ke printer cabang ini')
    }
  }

  private async assertPrinterAccess(
    printer: PrinterWithRelations,
    userId: string,
  ): Promise<void> {
    const accessibleBranchIds = await getAccessibleBranchIds(userId)
    if (printer.branch_id && !accessibleBranchIds.includes(printer.branch_id)) {
      throw new PrinterNotFoundError(printer.id)
    }
  }

  async getById(id: string, companyId: string, userId: string): Promise<PrinterWithRelations> {
    const printer = await printersRepository.findById(id, companyId)
    if (!printer) throw new PrinterNotFoundError(id)
    await this.assertPrinterAccess(printer, userId)
    return printer
  }

  async create(companyId: string, dto: CreatePrinterDto, userId: string) {
    if (dto.is_default) {
      await printersRepository.clearDefault(companyId, dto.branch_id)
    }
    const printer = await printersRepository.create(companyId, { ...dto, created_by: userId, updated_by: userId })
    await AuditService.log('CREATE', 'printer', printer.id, userId, undefined, printer)
    return printer
  }

  async update(id: string, companyId: string, dto: UpdatePrinterDto, userId: string) {
    const existing = await printersRepository.findById(id, companyId)
    if (!existing) throw new PrinterNotFoundError(id)

    if (dto.is_default) {
      await printersRepository.clearDefault(companyId, dto.branch_id ?? existing.branch_id, id)
    }

    const updated = await printersRepository.update(id, companyId, { ...dto, updated_by: userId })
    await AuditService.log('UPDATE', 'printer', id, userId, existing, dto)
    return updated
  }

  async delete(id: string, companyId: string, userId: string) {
    const existing = await printersRepository.findById(id, companyId)
    if (!existing) throw new PrinterNotFoundError(id)
    await printersRepository.softDelete(id, companyId, userId)
    await AuditService.log('DELETE', 'printer', id, userId, existing)
  }

  async testConnection(id: string, companyId: string, userId: string): Promise<boolean> {
    const printer = await printersRepository.findById(id, companyId)
    if (!printer) throw new PrinterNotFoundError(id)
    await this.assertPrinterAccess(printer, userId)
    return testPrinterConnection(printer.ip_address, printer.port)
  }

  async printPurchaseRequest(
    printerId: string,
    prId: string,
    lineIds: string[],
    companyId: string,
    userId: string,
  ) {
    const pr = await purchaseRequestsRepository.findWithLines(prId, await getAccessibleBranchIds(userId))
    if (!pr) throw new PurchaseRequestNotFoundError(prId)

    const printer = await printersRepository.findById(printerId, companyId)
    if (!printer) throw new PrinterNotFoundError(printerId)
    if (!printer.is_active) throw new PrinterConnectionError(printer.ip_address, printer.port, 'Printer is inactive')
    await this.assertPrintAccess(printer, userId, pr.branch_id)

    // Filter lines by selected IDs
    const selectedLines = pr.lines.filter(l => lineIds.includes(l.id))
    if (selectedLines.length === 0) throw new PurchaseRequestNotFoundError(prId)

    // Group by supplier
    const grouped = new Map<string, typeof selectedLines>()
    for (const line of selectedLines) {
      const key = line.supplier_name ?? '__none__'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(line)
    }

    // Resolve printer user name
    const printedByName = await printersRepository.getEmployeeName(userId)

    // Print one receipt per supplier group
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

    for (const [supplierName, lines] of grouped) {

      const header = [
        { key: 'No', value: pr.request_number },
        { key: 'Tgl', value: fmtDate(pr.request_date) },
        { key: 'Branch', value: pr.branch_name },
      ]
      if (pr.needed_by_date) header.push({ key: 'Dibutuhkan', value: fmtDate(pr.needed_by_date) })
      if (supplierName !== '__none__') header.push({ key: 'Supplier', value: supplierName })
      if (pr.requested_by_name) header.push({ key: 'Dibuat', value: pr.requested_by_name })
      if (pr.approved_by_name) header.push({ key: 'Disetujui', value: pr.approved_by_name })
      header.push({ key: 'Status', value: pr.status })
      const relatedPo = pr.purchase_orders?.find(po => po.supplier_name === supplierName)
      if (relatedPo) header.push({ key: 'PO', value: relatedPo.po_number })

      const items = lines.map((l, idx) => {
        const ordered = Number(l.qty_ordered ?? 0)
        return {
          label: `${idx + 1}. ${l.product_name}`,
          detail: `Req: ${l.qty} ${l.uom}`,
          amount: ordered > 0 ? `Ord: ${ordered} ${l.uom}` : '',
        }
      })

      const receipt = buildDocReceipt({
        paper_width: printer.paper_width,
        doc_title: 'Purchase Request',
        header,
        items,
        total_label: 'Total Item',
        total_amount: `${lines.length} item`,
        footer: `Dicetak oleh: ${printedByName ?? '-'} \u00b7 ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`,
      })

      await sendToPrinter(printer.ip_address, printer.port, receipt)
    }

    logInfo('PR printed', { pr_id: prId, printer_id: printerId, lines: lineIds.length })
    await AuditService.log('PRINT', 'purchase_request', prId, userId, undefined, { printer_id: printerId, line_count: lineIds.length })
  }

  private formatGrLineQtyDetail(line: GoodsReceiptLineWithRelations): string {
    const hasDual =
      line.uom_po && line.uom_received && line.uom_po !== line.uom_received
    const netQty = Number(line.qty_po_uom ?? line.qty_received) - Number(line.qty_rejected ?? 0)
    const rejected = Number(line.qty_rejected ?? 0)
    let qtyPart: string
    if (hasDual) {
      qtyPart = `Terima: ${fmt(netQty)} ${line.uom_po} (${fmt(line.qty_received)} ${line.uom_received})`
    } else {
      qtyPart = `Terima: ${fmt(netQty)} ${line.uom ?? line.uom_received ?? ''}`
    }
    if (rejected > 0) {
      qtyPart += ` | Tolak: ${fmt(rejected)}`
    }
    return qtyPart
  }

  async printGoodsReceipt(
    printerId: string,
    grId: string,
    lineIds: string[],
    companyId: string,
    userId: string,
  ): Promise<void> {
    const gr = await goodsReceiptsRepository.findWithLines(grId, companyId)
    if (!gr) throw new GoodsReceiptNotFoundError(grId)

    const printer = await printersRepository.findById(printerId, companyId)
    if (!printer) throw new PrinterNotFoundError(printerId)
    if (!printer.is_active) {
      throw new PrinterConnectionError(printer.ip_address, printer.port, 'Printer is inactive')
    }
    await this.assertPrintAccess(printer, userId, gr.branch_id)

    const selectedLines = gr.lines.filter((l) => l.id && lineIds.includes(l.id))
    if (selectedLines.length === 0) throw new GoodsReceiptNotFoundError(grId)

    const printedByName = await printersRepository.getEmployeeName(userId)
    const fmtDate = (d: string) =>
      new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

    const header = [
      { key: 'No GR', value: gr.gr_number },
      { key: 'Tgl', value: fmtDate(gr.received_date) },
      { key: 'PO', value: gr.po_number },
      { key: 'Supplier', value: gr.supplier_name },
      { key: 'Gudang', value: gr.warehouse_name },
      { key: 'Cabang', value: gr.branch_name },
      { key: 'Status', value: gr.status },
    ]
    if (gr.invoice_number) header.push({ key: 'No Inv', value: gr.invoice_number })
    if (gr.confirmed_by_name) header.push({ key: 'Konfirmasi', value: gr.confirmed_by_name })

    const items = selectedLines.map((l, idx) => ({
      label: `${idx + 1}. ${l.product_name ?? l.product_code ?? 'Item'}`,
      detail: this.formatGrLineQtyDetail(l),
    }))

    const receipt = buildGoodsReceiptReceipt({
      paper_width: printer.paper_width,
      header,
      items,
      footer: `Dicetak oleh: ${printedByName ?? '-'} · ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`,
    })

    await sendToPrinter(printer.ip_address, printer.port, receipt)

    logInfo('GR printed', { gr_id: grId, printer_id: printerId, lines: lineIds.length })
    await AuditService.log('PRINT', 'goods_receipt', grId, userId, undefined, {
      printer_id: printerId,
      line_count: lineIds.length,
    })
  }

  // ─── PRINT DAILY PREP ORDER ─────────────────────────────────────────────────

  async printDailyPrepOrder(
    printerId: string,
    dpoId: string,
    lineIds: string[],
    companyId: string,
    userId: string,
  ): Promise<void> {
    const dpo = await dailyPrepOrdersRepository.findDetail(dpoId, companyId)
    if (!dpo) throw new DpoNotFoundError(dpoId)

    const printer = await printersRepository.findById(printerId, companyId)
    if (!printer) throw new PrinterNotFoundError(printerId)
    if (!printer.is_active) {
      throw new PrinterConnectionError(printer.ip_address, printer.port, 'Printer is inactive')
    }
    await this.assertPrintAccess(printer, userId, dpo.branch_id)

    const selectedLines = dpo.lines.filter((l) => lineIds.includes(l.id))
    if (selectedLines.length === 0) throw new BusinessRuleError('Tidak ada line yang dipilih untuk dicetak')

    const printedByName = await printersRepository.getEmployeeName(userId)
    const fmtDate = (d: string) =>
      new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

    const header = [
      { key: 'No DPO', value: dpo.dpo_number },
      { key: 'Tgl Prep', value: fmtDate(dpo.prep_date) },
      { key: 'Cabang', value: dpo.branch_name },
      { key: 'Dari', value: dpo.source_warehouse_name },
      { key: 'Ke', value: dpo.target_warehouse_name },
      { key: 'Status', value: dpo.status },
    ]
    if (dpo.confirmed_by_name) header.push({ key: 'Konfirmasi', value: dpo.confirmed_by_name })

    const formatQty = (n: number) => parseFloat(n.toFixed(4)).toString()
    const items = selectedLines.map((l, idx) => ({
      label: `${idx + 1}. ${l.product_name}`,
      detail: `${formatQty(l.confirmed_qty ?? l.suggested_qty)} ${l.uom}`,
    }))

    const receipt = buildDailyPrepOrderReceipt({
      paper_width: printer.paper_width,
      header,
      items,
      footer: `Dicetak oleh: ${printedByName ?? '-'} · ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`,
    })

    await sendToPrinter(printer.ip_address, printer.port, receipt)

    logInfo('DPO printed', { dpo_id: dpoId, printer_id: printerId, lines: lineIds.length })
    await AuditService.log('PRINT', 'daily_prep_orders', dpoId, userId, undefined, {
      printer_id: printerId,
      line_count: lineIds.length,
    })
  }

  // ─── PRINT STOCK TRANSFER ──────────────────────────────────────────────────

  async printStockTransfer(
    printerId: string,
    transferId: string,
    lineIds: string[],
    companyId: string,
    userId: string,
  ): Promise<void> {
    const branchIds = await getAccessibleBranchIds(userId)
    const transfer = await stockTransfersRepository.findById(transferId, branchIds)
    if (!transfer) throw new StockTransferNotFoundError(transferId)

    const printer = await printersRepository.findById(printerId, companyId)
    if (!printer) throw new PrinterNotFoundError(printerId)
    if (!printer.is_active) {
      throw new PrinterConnectionError(printer.ip_address, printer.port, 'Printer is inactive')
    }
    await this.assertPrintAccess(printer, userId, transfer.source_branch_id)

    const selectedLines = transfer.lines.filter((l) => lineIds.includes(l.id))
    if (selectedLines.length === 0) throw new BusinessRuleError('Tidak ada line yang dipilih untuk dicetak')

    const printedByName = await printersRepository.getEmployeeName(userId)
    const fmtDate = (d: string) =>
      new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

    const header = [
      { key: 'No', value: transfer.transfer_number },
      { key: 'Tgl', value: fmtDate(transfer.transfer_date) },
      { key: 'Tipe', value: transfer.transfer_type },
      { key: 'Dari', value: `${transfer.source_warehouse_name} (${transfer.source_branch_name})` },
      { key: 'Ke', value: `${transfer.target_warehouse_name} (${transfer.target_branch_name})` },
      { key: 'Status', value: transfer.status },
    ]
    if (transfer.confirmed_by_name) header.push({ key: 'Konfirmasi', value: transfer.confirmed_by_name })
    if (transfer.notes) header.push({ key: 'Catatan', value: transfer.notes })

    const formatQty = (n: number) => parseFloat(n.toFixed(4)).toString()
    const items = selectedLines.map((l, idx) => ({
      label: `${idx + 1}. ${l.product_name}`,
      detail: `${formatQty(Number(l.qty))} ${l.base_unit_name ?? ''}`,
    }))

    const receipt = buildStockTransferReceipt({
      paper_width: printer.paper_width,
      header,
      items,
      footer: `Dicetak oleh: ${printedByName ?? '-'} · ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`,
    })

    await sendToPrinter(printer.ip_address, printer.port, receipt)

    logInfo('Stock transfer printed', { transfer_id: transferId, printer_id: printerId, lines: lineIds.length })
    await AuditService.log('PRINT', 'stock_transfer', transferId, userId, undefined, {
      printer_id: printerId,
      line_count: lineIds.length,
    })
  }
  // ─── PRINT PRODUCTION REQUEST (single detail) ────────────────────────────────

  async printProductionRequest(
    printerId: string,
    prId: string,
    companyId: string,
    userId: string,
  ) {
    const printer = await printersRepository.findById(printerId, companyId)
    if (!printer) throw new PrinterNotFoundError(printerId)
    if (!printer.is_active) throw new PrinterConnectionError(printer.ip_address, printer.port, 'Printer is inactive')

    const branchIds = await getAccessibleBranchIds(userId)
    const detail = await productionRequestsRepository.findById(prId, branchIds)
    if (!detail) throw new BusinessRuleError('Production request tidak ditemukan')

    const printedByName = await printersRepository.getEmployeeName(userId)

    const header: Array<{ key: string; value: string }> = [
      { key: 'No', value: detail.request_number },
      { key: 'Status', value: detail.status },
      { key: 'Tanggal', value: new Date(detail.request_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) },
      { key: 'Peminta', value: detail.requesting_branch_name },
      { key: 'Central', value: detail.fulfilling_branch_name },
    ]
    if (detail.notes) header.push({ key: 'Catatan', value: detail.notes })
    if (detail.accept_notes) header.push({ key: 'Catatan CK', value: detail.accept_notes })

    const items = detail.lines.map((l, idx) => {
      const approved = l.qty_approved ?? l.qty
      return {
        label: `${idx + 1}. ${l.product_name}`,
        detail: `Diminta: ${l.qty} ${l.uom}`,
        amount: `Setuju: ${approved} ${l.uom}`,
      }
    })

    const totalItems = detail.lines.length

    const receipt = buildDocReceipt({
      paper_width: printer.paper_width,
      doc_title: 'Request Produksi',
      header,
      items,
      total_label: 'Total',
      total_amount: `${totalItems} item`,
      footer: `Dicetak: ${printedByName ?? '-'} · ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`,
    })

    await sendToPrinter(printer.ip_address, printer.port, receipt)
    logInfo('Production request printed', { pr_id: prId, printer_id: printerId })
    await AuditService.log('PRINT', 'production_request', prId, userId, undefined, { printer_id: printerId })
  }

  // ─── PRINT PRODUCTION REQUEST SUMMARY ────────────────────────────────────────

  async printProductionRequestSummary(
    printerId: string,
    companyId: string,
    userId: string,
    filter?: { status?: string; date_from?: string; date_to?: string }
  ) {
    const printer = await printersRepository.findById(printerId, companyId)
    if (!printer) throw new PrinterNotFoundError(printerId)
    if (!printer.is_active) throw new PrinterConnectionError(printer.ip_address, printer.port, 'Printer is inactive')

    const summary = await productionRequestsRepository.getSummary(companyId, filter)
    if (summary.length === 0) throw new BusinessRuleError('Tidak ada request produksi untuk diprint')

    const printedByName = await printersRepository.getEmployeeName(userId)
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

    const header: Array<{ key: string; value: string }> = [
      { key: 'Tanggal', value: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) },
    ]
    if (filter?.date_from) header.push({ key: 'Dari', value: fmtDate(filter.date_from) })
    if (filter?.date_to) header.push({ key: 'Sampai', value: fmtDate(filter.date_to) })
    header.push({ key: 'Status', value: filter?.status ?? 'Semua' })

    const items = summary.map((s, idx) => {
      const branchList = s.branches.map(b => `${b.branch_name}: ${b.qty}`).join(', ')
      return {
        label: `${idx + 1}. ${s.product_name}`,
        detail: `${branchList}`,
        amount: `${s.total_qty} ${s.uom}`,
      }
    })

    const receipt = buildDocReceipt({
      paper_width: printer.paper_width,
      doc_title: 'Rekap Request Produksi',
      header,
      items,
      total_label: 'Total',
      total_amount: `${summary.length} produk`,
      footer: `Dicetak: ${printedByName ?? '-'} · ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`,
    })

    await sendToPrinter(printer.ip_address, printer.port, receipt)
    logInfo('Production request summary printed', { printer_id: printerId, wip_count: summary.length })
    await AuditService.log('PRINT', 'production_request_summary', companyId, userId, undefined, { printer_id: printerId, wip_count: summary.length })
  }
}

export const printersService = new PrintersService()
