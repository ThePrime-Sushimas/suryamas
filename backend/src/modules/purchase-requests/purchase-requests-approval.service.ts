import { pool } from '../../config/db'
import { purchaseRequestsRepository } from './purchase-requests.repository'
import { purchaseOrdersRepository } from '../purchase-orders/purchase-orders.repository'
import { PurchaseRequestNotFoundError, PurchaseRequestInvalidStatusError } from './purchase-requests.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { logInfo } from '../../config/logger'
import type { PurchaseRequestWithLines, PurchaseRequestLineWithRelations } from './purchase-requests.types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApprovalItem {
  pr_line_id: string
  product_id: string
  product_code: string
  product_name: string
  qty: number
  uom: string
  latest_price: number | null
  latest_price_uom: string | null
  stock_balance: number
  stock_unit: string | null
  stock_warehouse_name: string
}

interface ApprovalSupplierGroup {
  supplier_id: string | null
  supplier_name: string
  supplier_phone: string | null
  supplier_payment_term_days: number | null
  supplier_payment_term_name: string | null
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
  lines: Array<{ pr_line_id: string; qty_approved: number }>
  payment_type: 'CASH' | 'CREDIT'
  payment_terms_days?: number | null
  expected_delivery_date?: string | null
  notes?: string | null
}

interface ApproveAndGenerateDto {
  supplier_selections: SupplierSelection[]
}

interface ApproveAndGenerateResult {
  pr_id: string
  po_ids: string[]
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class PurchaseRequestApprovalService {

  async getApprovalData(prId: string, companyId: string): Promise<ApprovalData> {
    const pr = await purchaseRequestsRepository.findWithLines(prId, companyId)
    if (!pr) throw new PurchaseRequestNotFoundError(prId)

    const warehouse = await purchaseRequestsRepository.findMainWarehouseByBranch(pr.branch_id)
    const warehouseId = warehouse?.id ?? null
    const warehouseName = warehouse?.warehouse_name ?? 'N/A'

    // Batch stock balances
    const productIds = pr.lines.map(l => l.product_id)
    const stockMap = new Map<string, { qty: number; base_unit_name: string | null }>()
    if (warehouseId && productIds.length > 0) {
      const stockRows = await purchaseRequestsRepository.findStockBalancesBatch(warehouseId, productIds)
      for (const r of stockRows) stockMap.set(r.product_id, { qty: r.qty, base_unit_name: r.base_unit_name })
    }

    // Batch base unit names for products without stock records
    const missingIds = productIds.filter(id => !stockMap.has(id))
    const baseUnitMap = missingIds.length > 0
      ? await purchaseRequestsRepository.findBaseUnitNamesBatch(missingIds)
      : new Map<string, string>()

    // Batch latest prices
    const supplierIds = [...new Set(pr.lines.map(l => l.supplier_id).filter(Boolean))] as string[]
    const priceMap = new Map<string, { price: number; uom: string | null }>()
    if (supplierIds.length > 0 && productIds.length > 0) {
      const priceRows = await purchaseRequestsRepository.findLatestPricesBatch(productIds, supplierIds)
      for (const r of priceRows) priceMap.set(`${r.product_id}:${r.supplier_id}`, { price: r.price, uom: r.price_uom })
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

      const items: ApprovalItem[] = lines.map(line => {
        const priceData = noSupplier ? null : (priceMap.get(`${line.product_id}:${key}`) ?? null)
        return {
          pr_line_id: line.id,
          product_id: line.product_id,
          product_code: line.product_code,
          product_name: line.product_name,
          qty: line.qty,
          uom: line.uom,
          latest_price: priceData?.price ?? null,
          latest_price_uom: priceData?.uom ?? null,
          stock_balance: stockMap.get(line.product_id)?.qty ?? 0,
          stock_unit: stockMap.get(line.product_id)?.base_unit_name ?? baseUnitMap.get(line.product_id) ?? null,
          stock_warehouse_name: warehouseName,
        }
      })

      const totalEstimated = items.reduce((sum, i) => sum + (i.latest_price ?? 0) * i.qty, 0)

      let supplierName = 'Tanpa Supplier'
      let supplierPhone: string | null = null
      let supplierPaymentTermDays: number | null = null
      let supplierPaymentTermName: string | null = null

      if (!noSupplier) {
        const sup = await purchaseRequestsRepository.findSupplierWithPaymentTerms(key)
        if (sup) {
          supplierName = sup.supplier_name
          supplierPhone = sup.phone
          supplierPaymentTermDays = sup.payment_term_days
          supplierPaymentTermName = sup.payment_term_name
        }
      }

      supplierGroups.push({
        supplier_id: noSupplier ? null : key,
        supplier_name: supplierName,
        supplier_phone: supplierPhone,
        supplier_payment_term_days: supplierPaymentTermDays,
        supplier_payment_term_name: supplierPaymentTermName,
        items,
        total_estimated: totalEstimated,
      })
    }

    return { pr, warehouse_id: warehouseId, warehouse_name: warehouseName, supplier_groups: supplierGroups }
  }

  async approveAndGenerate(prId: string, companyId: string, dto: ApproveAndGenerateDto, userId: string): Promise<ApproveAndGenerateResult> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Lock PR
      const pr = await purchaseRequestsRepository.lockPRForUpdate(client, prId, companyId)
      if (!pr) throw new PurchaseRequestNotFoundError(prId)
      if (pr.status !== 'PENDING_APPROVAL') throw new PurchaseRequestInvalidStatusError(pr.status, 'PENDING_APPROVAL')

      // Fetch lines
      const prLines = await purchaseRequestsRepository.findLinesWithProducts(client, prId)

      // Batch lookup latest prices from pricelist
      const productIds = prLines.map(l => l.product_id)
      const supplierIds = [...new Set(dto.supplier_selections.map(s => s.supplier_id))]
      const priceMap = new Map<string, number>()
      if (supplierIds.length > 0 && productIds.length > 0) {
        const priceRows = await purchaseRequestsRepository.findLatestPricesBatch(productIds, supplierIds)
        for (const r of priceRows) priceMap.set(`${r.product_id}:${r.supplier_id}`, r.price)
      }

      const poIds: string[] = []

      for (const sel of dto.supplier_selections) {
        const selLineIds = sel.lines.map(l => l.pr_line_id)
        const lines = prLines.filter(l => selLineIds.includes(l.id))
        if (lines.length === 0) continue

        // Build qty map from approval
        const qtyMap = new Map(sel.lines.map(l => [l.pr_line_id, l.qty_approved]))

        const poNumber = await purchaseOrdersRepository.generatePoNumber(client, companyId, pr.branch_code)
        const totalAmount = lines.reduce((s, l) => {
          const qty = qtyMap.get(l.id) ?? parseFloat(l.qty)
          const price = priceMap.get(`${l.product_id}:${sel.supplier_id}`) ?? 0
          return s + price * qty
        }, 0)

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

        await purchaseOrdersRepository.insertLines(client, po.id, lines.map(l => ({
          pr_line_id: l.id,
          product_id: l.product_id,
          qty: qtyMap.get(l.id) ?? parseFloat(l.qty),
          uom: l.uom,
          unit_price: priceMap.get(`${l.product_id}:${sel.supplier_id}`) ?? 0,
          notes: l.notes,
        })))

        poIds.push(po.id)
      }

      // Update PR → CONVERTED + set qty_approved
      await purchaseRequestsRepository.setConvertedStatus(client, prId, companyId, userId)
      const allSelectedLines = dto.supplier_selections.flatMap(s => s.lines)
      await purchaseRequestsRepository.setQtyApprovedBatchWithValues(client, allSelectedLines)

      await client.query('COMMIT')

      await AuditService.log('APPROVE_AND_GENERATE', 'purchase_request', prId, userId,
        { status: 'PENDING_APPROVAL' }, { status: 'CONVERTED', po_ids: poIds })
      logInfo('PR approved and POs generated', { pr_id: prId, po_count: poIds.length })

      return { pr_id: prId, po_ids: poIds }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
}

export const purchaseRequestApprovalService = new PurchaseRequestApprovalService()
