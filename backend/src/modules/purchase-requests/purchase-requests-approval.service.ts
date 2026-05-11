import { pool } from '../../config/db'
import { purchaseRequestsRepository } from './purchase-requests.repository'
import { purchaseOrdersRepository } from '../purchase-orders/purchase-orders.repository'
import { PurchaseRequestNotFoundError, PurchaseRequestInvalidStatusError } from './purchase-requests.errors'
import { whatsappService } from '../../services/whatsapp.service'
import { AuditService } from '../monitoring/monitoring.service'
import { logInfo, logError } from '../../config/logger'
import type { PurchaseRequestWithLines, PurchaseRequestLineWithRelations } from './purchase-requests.types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApprovalItem {
  pr_line_id: string
  product_id: string
  product_code: string
  product_name: string
  qty: number
  uom: string
  estimated_price: number | null
  latest_price: number | null
  stock_balance: number
  stock_warehouse_name: string
}

interface ApprovalSupplierGroup {
  supplier_id: string | null
  supplier_name: string
  supplier_phone: string | null
  items: ApprovalItem[]
  total_estimated: number
}

interface ApprovalData {
  pr: PurchaseRequestWithLines
  warehouse_id: string | null
  warehouse_name: string
  supplier_groups: ApprovalSupplierGroup[]
}

interface SupplierSelection {
  supplier_id: string
  line_ids: string[]
  payment_type: 'CASH' | 'CREDIT'
  payment_terms_days?: number | null
  expected_delivery_date?: string | null
  notes?: string | null
}

interface ApproveAndGenerateDto {
  supplier_selections: SupplierSelection[]
  send_whatsapp?: boolean
}

interface ApproveAndGenerateResult {
  pr_id: string
  po_ids: string[]
  whatsapp_sent: string[]
  whatsapp_failed: string[]
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class PurchaseRequestApprovalService {

  async getApprovalData(prId: string, companyId: string): Promise<ApprovalData> {
    const pr = await purchaseRequestsRepository.findWithLines(prId, companyId)
    if (!pr) throw new PurchaseRequestNotFoundError(prId)
    if (pr.status !== 'PENDING_APPROVAL') {
      throw new PurchaseRequestInvalidStatusError(pr.status, 'PENDING_APPROVAL')
    }

    // Warehouse MAIN for this branch
    const { rows: whRows } = await pool.query(
      `SELECT id, warehouse_name FROM warehouses WHERE branch_id = $1 AND warehouse_type = 'MAIN' AND deleted_at IS NULL LIMIT 1`,
      [pr.branch_id]
    )
    const warehouse = whRows[0] ?? { id: null, warehouse_name: 'N/A' }

    // Batch stock balances
    const productIds = pr.lines.map(l => l.product_id)
    const stockMap = new Map<string, number>()
    if (warehouse.id && productIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT product_id, qty FROM stock_balances WHERE warehouse_id = $1 AND product_id = ANY($2::uuid[])`,
        [warehouse.id, productIds]
      )
      for (const r of rows) stockMap.set(r.product_id, parseFloat(r.qty))
    }

    // Batch latest prices
    const supplierIds = [...new Set(pr.lines.map(l => l.supplier_id).filter(Boolean))] as string[]
    const priceMap = new Map<string, number>()
    if (supplierIds.length > 0 && productIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT DISTINCT ON (pl.product_id, pl.supplier_id)
           pl.product_id, pl.supplier_id, pl.price
         FROM pricelists pl
         WHERE pl.product_id = ANY($1::uuid[]) AND pl.supplier_id = ANY($2::uuid[])
           AND pl.status = 'APPROVED' AND pl.is_active = true AND pl.deleted_at IS NULL
           AND pl.valid_from <= CURRENT_DATE AND (pl.valid_to IS NULL OR pl.valid_to >= CURRENT_DATE)
         ORDER BY pl.product_id, pl.supplier_id, pl.valid_from DESC, pl.created_at DESC`,
        [productIds, supplierIds]
      )
      for (const r of rows) priceMap.set(`${r.product_id}:${r.supplier_id}`, parseFloat(r.price))
    }

    // Group lines by supplier
    const grouped = new Map<string, PurchaseRequestLineWithRelations[]>()
    for (const line of pr.lines) {
      const key = line.supplier_id ?? '__none__'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(line)
    }

    // Build supplier groups
    const supplierGroups: ApprovalSupplierGroup[] = []
    for (const [key, lines] of grouped) {
      const noSupplier = key === '__none__'

      const items: ApprovalItem[] = lines.map(line => ({
        pr_line_id: line.id,
        product_id: line.product_id,
        product_code: line.product_code,
        product_name: line.product_name,
        qty: line.qty,
        uom: line.uom,
        estimated_price: line.estimated_price,
        latest_price: noSupplier ? null : (priceMap.get(`${line.product_id}:${key}`) ?? null),
        stock_balance: stockMap.get(line.product_id) ?? 0,
        stock_warehouse_name: warehouse.warehouse_name,
      }))

      const totalEstimated = items.reduce((sum, i) => sum + (i.latest_price ?? i.estimated_price ?? 0) * i.qty, 0)

      let supplierName = 'Tanpa Supplier'
      let supplierPhone: string | null = null
      if (!noSupplier) {
        const { rows } = await pool.query(`SELECT supplier_name, phone FROM suppliers WHERE id = $1`, [key])
        if (rows[0]) { supplierName = rows[0].supplier_name; supplierPhone = rows[0].phone }
      }

      supplierGroups.push({ supplier_id: noSupplier ? null : key, supplier_name: supplierName, supplier_phone: supplierPhone, items, total_estimated: totalEstimated })
    }

    return { pr, warehouse_id: warehouse.id, warehouse_name: warehouse.warehouse_name, supplier_groups: supplierGroups }
  }

  async approveAndGenerate(prId: string, companyId: string, dto: ApproveAndGenerateDto, userId: string): Promise<ApproveAndGenerateResult> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Lock PR
      const { rows: prRows } = await client.query(
        `SELECT pr.*, b.branch_code, b.branch_name FROM purchase_requests pr
         JOIN branches b ON b.id = pr.branch_id
         WHERE pr.id = $1 AND pr.company_id = $2 AND pr.deleted_at IS NULL FOR UPDATE`,
        [prId, companyId]
      )
      const pr = prRows[0]
      if (!pr) throw new PurchaseRequestNotFoundError(prId)
      if (pr.status !== 'PENDING_APPROVAL') throw new PurchaseRequestInvalidStatusError(pr.status, 'PENDING_APPROVAL')

      // Fetch lines
      const { rows: prLines } = await client.query(
        `SELECT prl.*, p.product_name, p.product_code FROM purchase_request_lines prl
         JOIN products p ON p.id = prl.product_id WHERE prl.request_id = $1`,
        [prId]
      )

      const poIds: string[] = []
      const whatsappSent: string[] = []
      const whatsappFailed: string[] = []

      for (const sel of dto.supplier_selections) {
        const lines = prLines.filter((l: { id: string }) => sel.line_ids.includes(l.id))
        if (lines.length === 0) continue

        const poNumber = await purchaseOrdersRepository.generatePoNumber(client, companyId, pr.branch_code)
        const totalAmount = lines.reduce((s: number, l: { estimated_price: string | null; qty: string }) => s + (parseFloat(l.estimated_price ?? '0')) * parseFloat(l.qty), 0)

        const po = await purchaseOrdersRepository.create(client, companyId, {
          branch_id: pr.branch_id,
          supplier_id: sel.supplier_id,
          purchase_request_id: prId,
          po_number: poNumber,
          payment_type: sel.payment_type,
          payment_terms_days: sel.payment_terms_days ?? null,
          expected_delivery_date: sel.expected_delivery_date ?? null,
          notes: sel.notes ?? null,
          total_amount: totalAmount,
          created_by: userId,
        })

        await purchaseOrdersRepository.insertLines(client, po.id, lines.map((l: { id: string; product_id: string; qty: string; uom: string; estimated_price: string | null; notes: string | null }) => ({
          pr_line_id: l.id,
          product_id: l.product_id,
          qty: parseFloat(l.qty),
          uom: l.uom,
          unit_price: parseFloat(l.estimated_price ?? '0'),
          notes: l.notes,
        })))

        poIds.push(po.id)

        // WhatsApp (non-blocking)
        if (dto.send_whatsapp) {
          const { rows: supRows } = await client.query(`SELECT supplier_name, phone FROM suppliers WHERE id = $1`, [sel.supplier_id])
          const sup = supRows[0]
          if (sup?.phone) {
            try {
              await whatsappService.sendPONotification({
                po_number: poNumber,
                order_date: new Date().toISOString().slice(0, 10),
                expected_delivery_date: sel.expected_delivery_date ?? null,
                supplier_name: sup.supplier_name,
                branch_name: pr.branch_name,
                total_amount: totalAmount,
                lines: lines.map((l: { product_name: string; qty: string; uom: string; estimated_price: string | null }) => ({
                  product_name: l.product_name, qty: parseFloat(l.qty), uom: l.uom, unit_price: parseFloat(l.estimated_price ?? '0'),
                })),
              }, sup.phone)
              whatsappSent.push(sup.phone)
            } catch (e: unknown) {
              logError('WhatsApp send failed', { po_number: poNumber, error: e })
              whatsappFailed.push(sup.phone)
            }
          }
        }
      }

      // Update PR → CONVERTED
      await client.query(
        `UPDATE purchase_requests SET status = 'CONVERTED', approved_by = $1, approved_at = now(), updated_by = $1, updated_at = now()
         WHERE id = $2 AND company_id = $3`,
        [userId, prId, companyId]
      )

      await client.query('COMMIT')

      await AuditService.log('APPROVE_AND_GENERATE', 'purchase_request', prId, userId,
        { status: 'PENDING_APPROVAL' }, { status: 'CONVERTED', po_ids: poIds })
      logInfo('PR approved and POs generated', { pr_id: prId, po_count: poIds.length })

      return { pr_id: prId, po_ids: poIds, whatsapp_sent: whatsappSent, whatsapp_failed: whatsappFailed }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
}

export const purchaseRequestApprovalService = new PurchaseRequestApprovalService()
