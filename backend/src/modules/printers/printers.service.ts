import { printersRepository } from './printers.repository'
import { purchaseRequestsRepository } from '../purchase-requests/purchase-requests.repository'
import { PrinterNotFoundError, PrinterConnectionError } from './printers.errors'
import { PurchaseRequestNotFoundError } from '../purchase-requests/purchase-requests.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { buildPRReceipt, sendToPrinter, testPrinterConnection } from './printers.print'
import { logInfo, logError } from '../../config/logger'
import type { CreatePrinterDto, UpdatePrinterDto, PrinterWithRelations } from './printers.types'
import type { PrintPRData } from './printers.print'

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

    // Print one receipt per supplier group
    for (const [supplierName, lines] of grouped) {
      const printData: PrintPRData = {
        request_number: pr.request_number,
        request_date: new Date(pr.request_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
        branch_name: pr.branch_name,
        needed_by_date: pr.needed_by_date ? new Date(pr.needed_by_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
        status: pr.status,
        supplier_name: supplierName === '__none__' ? null : supplierName,
        paper_width: printer.paper_width,
        lines: lines.map(l => ({
          product_name: l.product_name,
          qty: l.qty,
          uom: l.uom,
          estimated_price: l.estimated_price,
        })),
      }

      const receipt = buildPRReceipt(printData)
      await sendToPrinter(printer.ip_address, printer.port, receipt)
    }

    logInfo('PR printed', { pr_id: prId, printer_id: printerId, lines: lineIds.length })
    await AuditService.log('PRINT', 'purchase_request', prId, userId, undefined, { printer_id: printerId, line_count: lineIds.length })
  }
}

export const printersService = new PrintersService()
