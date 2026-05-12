import { pool } from '../../config/db'
import { goodsReceiptsRepository } from './goods-receipts.repository'
import { stockRepository } from '../stock/stock.repository'
import {
  GoodsReceiptNotFoundError, GoodsReceiptDuplicateError, GoodsReceiptAlreadyConfirmedError,
  GoodsReceiptInvalidPOStatusError, GoodsReceiptExceedsOrderedError, GoodsReceiptInvoiceRequiredError
} from './goods-receipts.errors'
import { InvalidReferenceError } from '../stock/stock.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { isPostgresError } from '../../utils/postgres-error.util'
import type { CreateGoodsReceiptDto, GoodsReceiptWithLines, VarianceStatus } from './goods-receipts.types'

export class GoodsReceiptsService {
  async list(companyId: string, pagination: { page: number; limit: number }, filter?: { status?: string; po_id?: string; branch_id?: string; date_from?: string; date_to?: string }) {
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
    // Verify PO exists, belongs to company, and is in correct status
    const { rows: poRows } = await pool.query(
      `SELECT po.id, po.status, po.branch_id, b.branch_code
       FROM purchase_orders po
       JOIN branches b ON b.id = po.branch_id
       WHERE po.id = $1 AND po.company_id = $2 AND po.deleted_at IS NULL`,
      [dto.po_id, companyId]
    )
    const po = poRows[0]
    if (!po) throw new InvalidReferenceError('purchase order not found')
    if (!['ORDERED', 'PARTIAL_RECEIVED'].includes(po.status)) {
      throw new GoodsReceiptInvalidPOStatusError(po.status)
    }

    // Verify warehouse belongs to company
    const { rows: whRows } = await pool.query(
      'SELECT id FROM warehouses WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [dto.warehouse_id, companyId]
    )
    if (!whRows[0]) throw new InvalidReferenceError('warehouse not found or does not belong to your company')

    // Fetch PO lines to validate qty and get unit_price_po + product names
    const { rows: poLines } = await pool.query(
      `SELECT pol.id, pol.product_id, pol.qty, pol.qty_received, pol.unit_price, pol.uom, p.product_name
       FROM purchase_order_lines pol
       JOIN products p ON p.id = pol.product_id
       WHERE pol.po_id = $1`,
      [dto.po_id]
    )
    const poLineMap = new Map(poLines.map(l => [l.id, l]))

    // Validate lines and calculate variance
    const processedLines = dto.lines.map(line => {
      const poLine = poLineMap.get(line.po_line_id)
      if (!poLine) throw new InvalidReferenceError(`PO line ${line.po_line_id} not found`)

      const remaining = Number(poLine.qty) - Number(poLine.qty_received)
      if (line.qty_received > remaining) {
        throw new GoodsReceiptExceedsOrderedError(
          poLine.product_name, Number(poLine.qty), Number(poLine.qty_received), line.qty_received
        )
      }

      const unitPricePo = Number(poLine.unit_price)
      const variance = (line.unit_price_invoice - unitPricePo) * line.qty_received
      const variancePct = unitPricePo > 0 ? Math.abs((line.unit_price_invoice - unitPricePo) / unitPricePo) * 100 : 0
      const varianceStatus: VarianceStatus = variancePct <= 0.01 ? 'OK' : variancePct <= 15 ? 'NOTICE' : 'DISPUTED'

      return {
        ...line,
        unit_price_po: unitPricePo,
        price_variance: variance,
        price_variance_pct: variancePct,
        variance_status: varianceStatus,
      }
    })

    const branchCode = po.branch_code ?? 'XXX'

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const grNumber = await goodsReceiptsRepository.generateGrNumber(client, companyId, branchCode)

      const gr = await goodsReceiptsRepository.create(client, companyId, {
        branch_id: po.branch_id,
        po_id: dto.po_id,
        warehouse_id: dto.warehouse_id,
        gr_number: grNumber,
        received_date: dto.received_date,
        invoice_number: dto.invoice_number,
        invoice_date: dto.invoice_date,
        invoice_photo_url: dto.invoice_photo_url,
        notes: dto.notes,
        created_by: userId,
      })

      await goodsReceiptsRepository.insertLines(client, gr.id, processedLines)

      await client.query('COMMIT')

      await AuditService.log('CREATE', 'goods_receipt', gr.id, userId, undefined, gr)
      return goodsReceiptsRepository.findWithLines(gr.id, companyId)
    } catch (e) {
      await client.query('ROLLBACK')
      if (isPostgresError(e, '23505')) throw new GoodsReceiptDuplicateError('auto-generated')
      if (isPostgresError(e, '23503')) throw new InvalidReferenceError('Invalid reference in GR lines')
      throw e
    } finally {
      client.release()
    }
  }

  /**
   * Confirm GR: update stock + create journal + update PO qty_received + update PO status
   * ALL operations in a single transaction via client.
   */
  async confirm(id: string, companyId: string, userId: string, invoicePhotoUrl?: string) {
    const gr = await goodsReceiptsRepository.findWithLines(id, companyId)
    if (!gr) throw new GoodsReceiptNotFoundError(id)
    if (gr.status === 'CONFIRMED') throw new GoodsReceiptAlreadyConfirmedError()

    // Invoice photo required
    const photoUrl = invoicePhotoUrl ?? gr.invoice_photo_url
    if (!photoUrl) throw new GoodsReceiptInvoiceRequiredError()

    // Get PO for payment_type
    const { rows: poRows } = await pool.query('SELECT payment_type FROM purchase_orders WHERE id = $1', [gr.po_id])
    const paymentType = poRows[0]?.payment_type ?? 'CREDIT'

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Create stock movements for each line (using client, not pool)
      for (const line of gr.lines) {
        // Lock balance row
        const { rows: lockRows } = await client.query(
          'SELECT * FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
          [gr.warehouse_id, line.product_id]
        )
        const currentQty = lockRows[0] ? Number(lockRows[0].qty) : 0
        const currentAvgCost = lockRows[0] ? Number(lockRows[0].avg_cost) : 0
        const newQty = currentQty + line.qty_received

        // Weighted average cost
        const totalExisting = currentQty * currentAvgCost
        const incoming = line.qty_received * line.unit_price_invoice
        const newAvgCost = newQty > 0 ? (totalExisting + incoming) / newQty : line.unit_price_invoice

        // Insert movement
        await stockRepository.createMovement(client, {
          warehouse_id: gr.warehouse_id,
          product_id: line.product_id,
          movement_type: 'IN_PURCHASE',
          qty: line.qty_received,
          cost_per_unit: line.unit_price_invoice,
          reference_type: 'purchase_order',
          reference_id: gr.po_id,
          notes: `GR ${gr.gr_number}`,
          created_by: userId,
        }, newQty)

        // Update balance
        await stockRepository.upsertBalance(client, gr.warehouse_id, line.product_id, newQty, newAvgCost)
      }

      // 2. Update PO lines qty_received
      for (const line of gr.lines) {
        await client.query(
          'UPDATE purchase_order_lines SET qty_received = qty_received + $1 WHERE id = $2',
          [line.qty_received, line.po_line_id]
        )
      }

      // 3. Update PO status (PARTIAL or FULLY RECEIVED)
      const { rows: updatedPoLines } = await client.query(
        'SELECT qty, qty_received FROM purchase_order_lines WHERE po_id = $1',
        [gr.po_id]
      )
      const allReceived = updatedPoLines.every(l => Number(l.qty_received) >= Number(l.qty))
      const newPoStatus = allReceived ? 'FULLY_RECEIVED' : 'PARTIAL_RECEIVED'
      await client.query(
        'UPDATE purchase_orders SET status = $1, updated_at = now(), updated_by = $2 WHERE id = $3',
        [newPoStatus, userId, gr.po_id]
      )

      // 4. Generate journal entry
      // Accounting logic:
      //   DEBIT  Persediaan = totalInvoice (actual cost of goods received)
      //   CREDIT Hutang     = totalInvoice (liability to supplier)
      //   Variance is informational only — recorded in GR lines, not in journal
      //   (Variance journal entry is optional, only if company wants to track PO vs Invoice diff)
      const totalInvoice = gr.lines.reduce((s, l) => s + l.qty_received * l.unit_price_invoice, 0)

      // Get COA IDs
      const { rows: coaRows } = await client.query(
        `SELECT account_code, id FROM chart_of_accounts
         WHERE company_id = $1 AND account_code IN ('110501', '210101')`,
        [companyId]
      )
      const coaMap = new Map(coaRows.map(r => [r.account_code, r.id]))
      const persediaanCoaId = coaMap.get('110501')
      const hutangCoaId = coaMap.get('210101')

      let journalId: string | null = null

      if (persediaanCoaId && hutangCoaId) {
        // Create journal header
        const { rows: journalRows } = await client.query(
          `INSERT INTO journal_headers (company_id, branch_id, journal_date, journal_type, source_module, reference_type, reference_id, reference_number, description, status, is_auto, created_by, updated_by)
           VALUES ($1, $2, $3, 'GENERAL', 'purchase', 'goods_receipt', $4, $5, $6, 'POSTED', true, $7, $7) RETURNING id`,
          [companyId, gr.branch_id, gr.received_date, gr.id, gr.gr_number,
           `Penerimaan Barang ${gr.gr_number} - ${gr.supplier_name ?? ''}`, userId]
        )
        journalId = journalRows[0].id

        // DEBIT Persediaan Bahan Baku
        await client.query(
          `INSERT INTO journal_lines (journal_id, account_id, description, debit, credit, sort_order)
           VALUES ($1, $2, 'Persediaan Bahan Baku', $3, 0, 1)`,
          [journalId, persediaanCoaId, totalInvoice]
        )

        // CREDIT Hutang Dagang / Kas
        await client.query(
          `INSERT INTO journal_lines (journal_id, account_id, description, debit, credit, sort_order)
           VALUES ($1, $2, $3, 0, $4, 2)`,
          [journalId, hutangCoaId, paymentType === 'CASH' ? 'Kas / Petty Cash' : 'Hutang Dagang', totalInvoice]
        )
      }

      // 5. Update GR status + invoice_photo_url + journal_id
      await goodsReceiptsRepository.updateStatus(client, id, 'CONFIRMED', {
        journal_id: journalId ?? undefined,
        updated_by: userId,
        invoice_photo_url: photoUrl,
      })

      await client.query('COMMIT')

      await AuditService.log('UPDATE', 'goods_receipt', id, userId, { status: 'DRAFT' }, { status: 'CONFIRMED' })
      return goodsReceiptsRepository.findWithLines(id, companyId)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
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
