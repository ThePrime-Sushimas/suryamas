import { pool } from '../../config/db'
import { purchaseOrdersRepository } from '../purchase-orders/purchase-orders.repository'
import { purchaseInvoicesRepository } from './purchase-invoices.repository'
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

function computeLineTotals(qtyInvoiced: number, unitPrice: number, taxRate: number) {
  const subtotal = qtyInvoiced * unitPrice
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount
  return { subtotal, taxAmount, total }
}

export class PurchaseInvoicesService {
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

  async getAvailableGrs(companyId: string, supplierId: string, branchId: string) {
    return purchaseInvoicesRepository.findAvailableGrs(companyId, supplierId, branchId)
  }

  async getById(id: string, companyId: string): Promise<PurchaseInvoiceDetail> {
    const detail = await purchaseInvoicesRepository.findById(id, companyId)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    return detail
  }

  async create(companyId: string, dto: CreatePurchaseInvoiceDto, userId: string) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Build totals from lines (qty_invoiced * unit_price, tax per line)
      let subtotal = 0
      let totalTax = 0
      let totalAmount = 0

      // For match_status/variance need PO info - for MVP keep as MATCH and 0 variance if unknown.
      // Full 3-way match can be enhanced once goods_receipt_lines expose PO qty/price consistently.
      // Enrich lines with GR data
      const grLineIds = dto.lines.map((l) => l.gr_line_id)
      const { rows: grLineDetails } = await client.query(
        `SELECT grl.id, grl.gr_id, grl.product_id, grl.qty_received, grl.unit_price_po, pol.qty AS qty_po
         FROM goods_receipt_lines grl
         JOIN purchase_order_lines pol ON pol.id = grl.po_line_id
         WHERE grl.id = ANY($1::uuid[])`,
        [grLineIds],
      )
      const grLineMap = new Map(grLineDetails.map((r) => [r.id, r]))
      const grIds = [...new Set(grLineDetails.map((r) => r.gr_id))]

      const enrichedLines: any[] = []

      for (let i = 0; i < dto.lines.length; i++) {
        const l = dto.lines[i]
        const grl = grLineMap.get(l.gr_line_id)
        if (!grl) throw new Error(`Goods receipt line ${l.gr_line_id} not found`)

        const qtyInvoiced = Number(l.qty_invoiced)
        const unitPrice = Number(l.unit_price)
        const taxRate = Number(l.tax_rate)
        const totals = computeLineTotals(qtyInvoiced, unitPrice, taxRate)

        const qtyReceived = Number(grl.qty_received)
        const unitPricePo = Number(grl.unit_price_po)
        const qtyPo = Number(grl.qty_po)

        subtotal += totals.subtotal
        totalTax += totals.taxAmount
        totalAmount += totals.total

        const varianceQty = qtyInvoiced - qtyReceived
        const variancePrice = unitPrice - unitPricePo

        enrichedLines.push({
          gr_line_id: l.gr_line_id,
          product_id: grl.product_id,
          qty_received: qtyReceived,
          qty_invoiced: qtyInvoiced,
          unit_price: unitPrice,
          tax_rate: taxRate,
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total: totals.total,
          qty_po: qtyPo,
          unit_price_po: unitPricePo,
          variance_qty: varianceQty,
          variance_price: variancePrice,
          match_status: varianceQty === 0 ? 'MATCH' : varianceQty > 0 ? 'OVER' : 'UNDER',
          sort_order: l.sort_order ?? i,
          created_by: userId,
          updated_by: userId,
        })
      }

      // Create header
      const invoice = await purchaseInvoicesRepository.create(client, companyId, {
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

      // Lines: for now, insert using client-level enrichment later.
      // Minimal MVP: expects repository to accept product_id; we must enrich properly.
      // So we need goods_receipt_lines join to products.
      // This will be completed in next step after we inspect goods_receipt_lines columns.
      await purchaseInvoicesRepository.replaceLines(client, invoice.id, enrichedLines)
      await purchaseInvoicesRepository.insertGrLinks(client, invoice.id, grIds)

      await client.query('COMMIT')
      await AuditService.log('CREATE', 'purchase_invoices', invoice.id, userId)
      return purchaseInvoicesRepository.findById(invoice.id, companyId)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async update(companyId: string, id: string, dto: UpdatePurchaseInvoiceDto, userId: string) {
    const existing = await purchaseInvoicesRepository.findById(id, companyId)
    if (!existing) throw new PurchaseInvoiceNotFoundError(id)
    if (existing.status === 'POSTED') throw new PurchaseInvoiceCannotEditPostedError()
    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') throw new PurchaseInvoiceInvalidStatusError(existing.status, 'DRAFT/REJECTED')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Enrich lines with GR data
      const grLineIds = dto.lines.map((l) => l.gr_line_id)
      const { rows: grLineDetails } = await client.query(
        `SELECT grl.id, grl.gr_id, grl.product_id, grl.qty_received, grl.unit_price_po, pol.qty AS qty_po
         FROM goods_receipt_lines grl
         JOIN purchase_order_lines pol ON pol.id = grl.po_line_id
         WHERE grl.id = ANY($1::uuid[])`,
        [grLineIds],
      )
      const grLineMap = new Map(grLineDetails.map((r) => [r.id, r]))
      const grIds = [...new Set(grLineDetails.map((r) => r.gr_id))]

      let subtotal = 0
      let totalTax = 0
      let totalAmount = 0
      const enrichedLines: any[] = []

      for (let i = 0; i < dto.lines.length; i++) {
        const l = dto.lines[i]
        const grl = grLineMap.get(l.gr_line_id)
        if (!grl) throw new Error(`Goods receipt line ${l.gr_line_id} not found`)

        const qtyInvoiced = Number(l.qty_invoiced)
        const unitPrice = Number(l.unit_price)
        const taxRate = Number(l.tax_rate)
        const totals = computeLineTotals(qtyInvoiced, unitPrice, taxRate)

        const qtyReceived = Number(grl.qty_received)
        const unitPricePo = Number(grl.unit_price_po)
        const qtyPo = Number(grl.qty_po)

        subtotal += totals.subtotal
        totalTax += totals.taxAmount
        totalAmount += totals.total

        const varianceQty = qtyInvoiced - qtyReceived
        const variancePrice = unitPrice - unitPricePo

        enrichedLines.push({
          gr_line_id: l.gr_line_id,
          product_id: grl.product_id,
          qty_received: qtyReceived,
          qty_invoiced: qtyInvoiced,
          unit_price: unitPrice,
          tax_rate: taxRate,
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total: totals.total,
          qty_po: qtyPo,
          unit_price_po: unitPricePo,
          variance_qty: varianceQty,
          variance_price: variancePrice,
          match_status: varianceQty === 0 ? 'MATCH' : varianceQty > 0 ? 'OVER' : 'UNDER',
          sort_order: l.sort_order ?? i,
          created_by: userId,
          updated_by: userId,
        })
      }

      await purchaseInvoicesRepository.replaceLines(client, id, enrichedLines)
      await purchaseInvoicesRepository.replaceGrLinks(client, id, grIds)

      // Update header totals and notes in one go
      await purchaseInvoicesRepository.updateStatus(client, id, existing.status, {
        subtotal,
        total_tax: totalTax,
        total_amount: totalAmount,
        notes: dto.notes ?? existing.notes,
        updated_by: userId,
      })

      await client.query('COMMIT')
      await AuditService.log('UPDATE', 'purchase_invoices', id, userId)
      return purchaseInvoicesRepository.findById(id, companyId)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async submit(companyId: string, id: string, userId: string) {
    const detail = await purchaseInvoicesRepository.findById(id, companyId)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    if (detail.status !== 'DRAFT' && detail.status !== 'REJECTED') throw new PurchaseInvoiceInvalidStatusError(detail.status, 'DRAFT/REJECTED')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await purchaseInvoicesRepository.updateStatus(client, id, 'SUBMITTED', {
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
        updated_by: userId,
      })
      await client.query('COMMIT')
      await AuditService.log('UPDATE', 'purchase_invoices', id, userId, { status: detail.status }, { status: 'SUBMITTED' })
      return purchaseInvoicesRepository.findById(id, companyId)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async approve(companyId: string, id: string, userId: string) {
    const detail = await purchaseInvoicesRepository.findById(id, companyId)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    if (detail.status !== 'SUBMITTED') throw new PurchaseInvoiceInvalidStatusError(detail.status, 'SUBMITTED')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await purchaseInvoicesRepository.updateStatus(client, id, 'APPROVED', {
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_by: userId,
      })
      await client.query('COMMIT')
      await AuditService.log('UPDATE', 'purchase_invoices', id, userId, { status: detail.status }, { status: 'APPROVED' })
      return purchaseInvoicesRepository.findById(id, companyId)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async reject(companyId: string, id: string, reason: string, userId: string) {
    const detail = await purchaseInvoicesRepository.findById(id, companyId)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    if (detail.status !== 'SUBMITTED') throw new PurchaseInvoiceInvalidStatusError(detail.status, 'SUBMITTED')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await purchaseInvoicesRepository.updateStatus(client, id, 'REJECTED', {
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
        updated_by: userId,
      })
      await client.query('COMMIT')
      await AuditService.log('UPDATE', 'purchase_invoices', id, userId, { status: detail.status }, { status: 'REJECTED' })
      return purchaseInvoicesRepository.findById(id, companyId)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async post(companyId: string, id: string, userId: string) {
    const detail = await purchaseInvoicesRepository.findById(id, companyId)
    if (!detail) throw new PurchaseInvoiceNotFoundError(id)
    if (detail.status !== 'APPROVED') throw new PurchaseInvoiceInvalidStatusError(detail.status, 'APPROVED')
    if (detail.journal_id) throw new PurchaseInvoiceJournalAlreadyExistsError()

    // Validate that all linked Goods Processing are CONFIRMED
    const unconfirmedGp = await pool.query(`
      SELECT gp.processing_number
      FROM purchase_invoice_lines pil
      JOIN goods_processing_inputs gpi ON gpi.gr_line_id = pil.gr_line_id
      JOIN goods_processing gp ON gp.id = gpi.goods_processing_id
      WHERE pil.purchase_invoice_id = $1 AND gp.status != 'CONFIRMED'
      LIMIT 1
    `, [id])

    if (unconfirmedGp.rows.length > 0) {
      throw new PurchaseInvoiceGpNotConfirmedError(unconfirmedGp.rows[0].processing_number)
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

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

      // Recalculate avg_cost inline
      for (const pair of recomputePairs) {
        const { rows } = await client.query(
          `SELECT
             CASE WHEN sb.qty > 0
               THEN (
                 SELECT SUM(sm.qty * sm.cost_per_unit) / NULLIF(SUM(sm.qty), 0)
                 FROM stock_movements sm
                 WHERE sm.warehouse_id = $1 AND sm.product_id = $2
                   AND sm.qty > 0 AND sm.cost_per_unit > 0
               )
               ELSE 0
             END AS new_avg_cost
           FROM stock_balances sb
           WHERE sb.warehouse_id = $1 AND sb.product_id = $2`,
          [pair.warehouse_id, pair.product_id],
        )

        const newAvgCost = Number(rows[0]?.new_avg_cost ?? 0)
        await client.query(
          'UPDATE stock_balances SET avg_cost = $1, updated_at = now() WHERE warehouse_id = $2 AND product_id = $3',
          [newAvgCost, pair.warehouse_id, pair.product_id],
        )
      }

      // Journal creation (COA lookup)
      const coaRows = await client.query(
        `SELECT id, account_code
         FROM chart_of_accounts
         WHERE company_id = $1 AND account_code IN ('110501','110601','210101')`,
        [companyId],
      )

      const coaByCode = new Map<string, string>()
      for (const r of coaRows.rows) coaByCode.set(String(r.account_code), String(r.id))

      const coaInv = coaByCode.get('110501')
      const coaTax = coaByCode.get('110601')
      const coaPayable = coaByCode.get('210101')
      if (!coaInv || !coaTax || !coaPayable) {
        throw new Error('COA codes missing for purchase invoice posting')
      }

      const subtotal = Number(detail.subtotal ?? 0)
      const totalTax = Number(detail.total_tax ?? 0)
      const totalAmount = Number(detail.total_amount ?? 0)

      const journalHeader = await purchaseInvoicesRepository.createJournalHeader(client, {
        companyId,
        branchId: detail.branch_id,
        journalDate: detail.invoice_date,
        currency: 'IDR',
        journalType: 'PURCHASE_INVOICE',
        referenceType: 'purchase_invoice',
        referenceId: id,
        referenceNumber: detail.invoice_number,
        description: `Purchase Invoice ${detail.invoice_number}`,
        totalDebit: subtotal + totalTax,
        totalCredit: totalAmount,
        createdBy: userId,
      })

      await purchaseInvoicesRepository.createJournalLines(client, {
        journalHeaderId: journalHeader.id,
        debitAccountId: coaInv,
        debitAmount: subtotal,
        taxAccountId: coaTax,
        taxAmount: totalTax,
        creditAccountId: coaPayable,
        creditAmount: totalAmount,
        createdBy: userId,
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

      await client.query('COMMIT')
      await AuditService.log('UPDATE', 'purchase_invoices', id, userId, { status: detail.status }, { status: 'POSTED' })
      return purchaseInvoicesRepository.findById(id, companyId)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async createDraftFromGr(client: any, companyId: string, grId: string, userId: string) {
    // 1. Fetch GR + PO info + Lines + Attachments
    const { rows: grRows } = await client.query(`
      SELECT gr.*, po.supplier_id, po.branch_id
      FROM goods_receipts gr
      JOIN purchase_orders po ON po.id = gr.po_id
      WHERE gr.id = $1 AND gr.company_id = $2
    `, [grId, companyId]);
    
    const gr = grRows[0];
    if (!gr) return;

    const { rows: lines } = await client.query(`
      SELECT grl.*, pol.unit_price AS unit_price_po, pol.qty AS qty_po
      FROM goods_receipt_lines grl
      JOIN purchase_order_lines pol ON pol.id = grl.po_line_id
      WHERE grl.gr_id = $1
    `, [grId]);

    const { rows: attachments } = await client.query(`
      SELECT * FROM goods_receipt_attachments WHERE gr_id = $1
    `, [grId]);

    // 2. Prepare PI Lines
    let subtotal = 0;
    let totalTax = 0;
    let totalAmount = 0;
    
    const piLines = lines.map((l: any, i: number) => {
      const qtyInvoiced = Number(l.qty_received);
      const unitPrice = Number(l.unit_price_invoice ?? l.unit_price_po);
      const taxRate = 11; // Default tax 11%
      const totals = computeLineTotals(qtyInvoiced, unitPrice, taxRate);
      
      subtotal += totals.subtotal;
      totalTax += totals.taxAmount;
      totalAmount += totals.total;

      return {
        gr_line_id: l.id,
        product_id: l.product_id,
        qty_received: Number(l.qty_received),
        qty_invoiced: qtyInvoiced,
        unit_price: unitPrice,
        tax_rate: taxRate,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total: totals.total,
        qty_po: Number(l.qty_po),
        unit_price_po: Number(l.unit_price_po),
        variance_qty: 0,
        variance_price: unitPrice - Number(l.unit_price_po),
        match_status: 'MATCH',
        sort_order: i,
        created_by: userId,
        updated_by: userId
      };
    });

    // 3. Create PI Header
    const invoice = await purchaseInvoicesRepository.create(client, companyId, {
      supplier_id: gr.supplier_id,
      branch_id: gr.branch_id,
      invoice_number: `AUTO-${gr.gr_number}`,
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

    // 5. Copy Attachments to PI
    for (const att of attachments) {
      await client.query(`
        INSERT INTO purchase_invoice_attachments (
          purchase_invoice_id, file_path, file_name, file_type, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5)
      `, [invoice.id, att.file_path, att.file_name, att.file_type, userId]);
    }

    return invoice;
  }

  async getAttachments(invoiceId: string) {
    const { rows } = await pool.query(
      `SELECT * FROM purchase_invoice_attachments WHERE purchase_invoice_id = $1 ORDER BY uploaded_at DESC`,
      [invoiceId],
    )
    return rows
  }

  async delete(companyId: string, id: string, userId: string) {
    const existing = await purchaseInvoicesRepository.findById(id, companyId)
    if (!existing) throw new Error('Purchase invoice not found')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await purchaseInvoicesRepository.softDelete(client, id, companyId, userId)
      await client.query('COMMIT')
      await AuditService.log('DELETE', 'purchase_invoices', id, userId)
      return true
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async mergeInvoices(companyId: string, invoiceIds: string[], userId: string) {
    if (invoiceIds.length < 2) throw new Error('At least two invoices are required to merge')
    
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Fetch all source invoices
      const { rows: invoices } = await client.query(`
        SELECT * FROM purchase_invoices 
        WHERE id = ANY($1::uuid[]) AND company_id = $2 AND status = 'DRAFT' AND deleted_at IS NULL
      `, [invoiceIds, companyId])

      if (invoices.length !== invoiceIds.length) {
        throw new Error('Some invoices were not found or are not in DRAFT status')
      }

      // 2. Validate same supplier and branch
      const supplierId = invoices[0].supplier_id
      const branchId = invoices[0].branch_id
      const allSame = invoices.every(inv => inv.supplier_id === supplierId && inv.branch_id === branchId)
      if (!allSame) {
        throw new Error('All invoices must belong to the same supplier and branch to be merged')
      }

      // 3. Create Master Invoice
      const masterInvoiceNumber = `[DRAFT-MERGED]`
      const master = await purchaseInvoicesRepository.create(client, companyId, {
        supplier_id: supplierId,
        branch_id: branchId,
        invoice_number: masterInvoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        notes: `Merged from ${invoices.length} drafts: ${invoices.map(i => i.invoice_number).join(', ')}`,
        subtotal: 0,
        total_tax: 0,
        total_amount: 0,
        created_by: userId
      })

      // 4. Move Lines
      await client.query(`
        UPDATE purchase_invoice_lines 
        SET purchase_invoice_id = $1, updated_by = $2, updated_at = NOW()
        WHERE purchase_invoice_id = ANY($3::uuid[]) AND deleted_at IS NULL
      `, [master.id, userId, invoiceIds])

      // 5. Move GR Links
      await client.query(`
        UPDATE purchase_invoice_gr_links 
        SET purchase_invoice_id = $1
        WHERE purchase_invoice_id = ANY($2::uuid[])
      `, [master.id, invoiceIds])

      // 6. Move Attachments
      await client.query(`
        UPDATE purchase_invoice_attachments 
        SET purchase_invoice_id = $1
        WHERE purchase_invoice_id = ANY($2::uuid[])
      `, [master.id, invoiceIds])

      // 7. Recompute Totals for Master
      const { rows: totals } = await client.query(`
        SELECT SUM(subtotal) as subtotal, SUM(tax_amount) as total_tax, SUM(total) as total_amount
        FROM purchase_invoice_lines
        WHERE purchase_invoice_id = $1 AND deleted_at IS NULL
      `, [master.id])

      await client.query(`
        UPDATE purchase_invoices 
        SET subtotal = $1, total_tax = $2, total_amount = $3, 
            merged_from_invoice_ids = $4, updated_by = $5, updated_at = NOW()
        WHERE id = $6
      `, [totals[0].subtotal || 0, totals[0].total_tax || 0, totals[0].total_amount || 0, invoiceIds, userId, master.id])

      // 8. Soft delete sources
      await client.query(`
        UPDATE purchase_invoices 
        SET deleted_at = NOW(), updated_by = $1, updated_at = NOW()
        WHERE id = ANY($2::uuid[])
      `, [userId, invoiceIds])

      await client.query('COMMIT')
      await AuditService.log('CREATE', 'purchase_invoices', master.id, userId, { merged_from: invoiceIds })
      
      return master
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async getCounts(companyId: string) {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('DRAFT', 'REJECTED')) as verify_count,
        COUNT(*) FILTER (WHERE status = 'SUBMITTED') as approval_count,
        COUNT(*) FILTER (WHERE status = 'APPROVED') as final_count
      FROM purchase_invoices
      WHERE company_id = $1 AND deleted_at IS NULL
    `, [companyId])
    return rows[0]
  }
}

export const purchaseInvoicesService = new PurchaseInvoicesService()

