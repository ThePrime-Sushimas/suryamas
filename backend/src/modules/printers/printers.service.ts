import { printersRepository } from './printers.repository'
import { purchaseRequestsRepository } from '../purchase-requests/purchase-requests.repository'
import { PrinterNotFoundError, PrinterConnectionError } from './printers.errors'
import { PurchaseRequestNotFoundError } from '../purchase-requests/purchase-requests.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { buildDocReceipt, sendToPrinter, testPrinterConnection, fmt } from './printers.print'
import { logInfo } from '../../config/logger'
import type { CreatePrinterDto, UpdatePrinterDto, PrinterWithRelations } from './printers.types'

export class PrintersService {
  async list(companyId: string): Promise<PrinterWithRelations[]> {
    return printersRepository.findAll(companyId)
  }

  async getById(id: string, companyId: string): Promise<PrinterWithRelations> {
    const printer = await printersRepository.findById(id, companyId)
    if (!printer) throw new PrinterNotFoundError(id)
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

  async testConnection(id: string, companyId: string): Promise<boolean> {
    const printer = await printersRepository.findById(id, companyId)
    if (!printer) throw new PrinterNotFoundError(id)
    return testPrinterConnection(printer.ip_address, printer.port)
  }

  async printPurchaseRequest(printerId: string, prId: string, lineIds: string[], companyId: string, userId: string) {
    const printer = await printersRepository.findById(printerId, companyId)
    if (!printer) throw new PrinterNotFoundError(printerId)
    if (!printer.is_active) throw new PrinterConnectionError(printer.ip_address, printer.port, 'Printer is inactive')

    const pr = await purchaseRequestsRepository.findWithLines(prId, companyId)
    if (!pr) throw new PurchaseRequestNotFoundError(prId)

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
      if (printedByName) header.push({ key: 'Dicetak', value: printedByName })
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
}

export const printersService = new PrintersService()
