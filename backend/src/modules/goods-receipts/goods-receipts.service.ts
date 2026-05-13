import { pool } from '../../config/db'
import { goodsReceiptsRepository } from './goods-receipts.repository'
import { BusinessRuleError } from '../../utils/errors.base'
import {
  GoodsReceiptNotFoundError, GoodsReceiptDuplicateError, GoodsReceiptAlreadyConfirmedError,
  GoodsReceiptInvalidPOStatusError, GoodsReceiptExceedsOrderedError
} from './goods-receipts.errors'
import { InvalidReferenceError } from '../stock/stock.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { isPostgresError } from '../../utils/postgres-error.util'
import type { CreateGoodsReceiptDto, UpdateGoodsReceiptDto, GoodsReceiptWithLines, VarianceStatus } from './goods-receipts.types'

export class GoodsReceiptsService {
  async list(companyId: string, pagination: { page: number; limit: number }, filter?: { status?: string; po_id?: string; branch_id?: string; branch_ids?: string[]; date_from?: string; date_to?: string }) {
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
    const po = await goodsReceiptsRepository.findPoForGr(dto.po_id, companyId)
    if (!po) throw new InvalidReferenceError('purchase order not found')
    if (!['ORDERED', 'PARTIAL_RECEIVED'].includes(po.status)) {
      throw new GoodsReceiptInvalidPOStatusError(po.status)
    }

    const wh = await goodsReceiptsRepository.findWarehouse(dto.warehouse_id, companyId)
    if (!wh) throw new InvalidReferenceError('warehouse not found or does not belong to your company')

    const poLines = await goodsReceiptsRepository.findPoLines(dto.po_id)
    const poLineMap = new Map(poLines.map(l => [l.id, l]))

    // Guard: hitung pending qty dari GR DRAFT yang belum confirm
    const pendingMap = await goodsReceiptsRepository.findPendingQtyByPo(dto.po_id)

    const processedLines = dto.lines.map(line => {
      const poLine = poLineMap.get(line.po_line_id)
      if (!poLine) throw new InvalidReferenceError(`PO line ${line.po_line_id} not found`)

      const pendingQty = pendingMap.get(line.po_line_id) ?? 0
      const remaining = Number(poLine.qty) - Number(poLine.qty_received) - pendingQty
      if (line.qty_received > remaining) {
        throw new GoodsReceiptExceedsOrderedError(
          poLine.product_name, Number(poLine.qty), Number(poLine.qty_received) + pendingQty, line.qty_received
        )
      }

      if ((line.qty_rejected ?? 0) > line.qty_received) {
        throw new BusinessRuleError(`Qty ditolak (${line.qty_rejected}) tidak boleh melebihi qty diterima (${line.qty_received}) untuk ${poLine.product_name}`)
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

  async confirm(id: string, companyId: string, userId: string) {
    const gr = await goodsReceiptsRepository.findWithLines(id, companyId)
    if (!gr) throw new GoodsReceiptNotFoundError(id)
    if (gr.status === 'CONFIRMED') throw new GoodsReceiptAlreadyConfirmedError()

    // Check at least one attachment exists (surat jalan / foto)
    const attachments = await goodsReceiptsRepository.findAttachments(id)
    if (attachments.length === 0) {
      throw new BusinessRuleError('Upload minimal 1 dokumen (surat jalan / foto barang) sebelum konfirmasi')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Lock PO lines FOR UPDATE to prevent concurrent confirm race condition
      const poLines = await goodsReceiptsRepository.findPoLinesForUpdate(client, gr.po_id)
      const poLineMap = new Map(poLines.map(l => [l.id, l]))

      // 2. Re-validate qty inside transaction (after lock)
      for (const line of gr.lines) {
        const poLine = poLineMap.get(line.po_line_id)
        if (!poLine) continue
        const remaining = poLine.qty - poLine.qty_received
        if (line.qty_received > remaining) {
          throw new GoodsReceiptExceedsOrderedError(
            line.product_name ?? 'Unknown', poLine.qty, poLine.qty_received, line.qty_received
          )
        }
      }

      // 3. Update PO lines qty_received
      for (const line of gr.lines) {
        await goodsReceiptsRepository.incrementPoLineQtyReceived(client, line.po_line_id, line.qty_received)
      }

      // 4. Update PO status
      const newPoStatus = await goodsReceiptsRepository.resolvePoStatus(client, gr.po_id)
      await goodsReceiptsRepository.updatePoStatus(client, gr.po_id, newPoStatus, userId)

      // 5. Update GR status (no journal — journal created by Purchase Invoice module)
      await goodsReceiptsRepository.updateStatus(client, id, 'CONFIRMED', {
        updated_by: userId,
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

  async update(id: string, companyId: string, dto: UpdateGoodsReceiptDto, userId: string) {
    const existing = await goodsReceiptsRepository.findById(id, companyId)
    if (!existing) throw new GoodsReceiptNotFoundError(id)
    if (existing.status !== 'DRAFT') throw new GoodsReceiptAlreadyConfirmedError()

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

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

        const processedLines = dto.lines.map(line => {
          const unitPricePo = poLinePriceMap.get(line.po_line_id) ?? line.unit_price_invoice
          const variance = line.unit_price_invoice - unitPricePo
          const variancePct = unitPricePo > 0 ? Math.abs(variance / unitPricePo) * 100 : 0
          const varianceStatus = variancePct > 15 ? 'DISPUTED' : variancePct > 5 ? 'NOTICE' : 'OK'
          return {
            po_line_id: line.po_line_id,
            product_id: line.product_id,
            qty_received: line.qty_received,
            unit_price_invoice: line.unit_price_invoice,
            unit_price_po: unitPricePo,
            variance,
            variance_pct: variancePct,
            variance_status: varianceStatus,
            qty_rejected: line.qty_rejected,
            reject_reason: line.reject_reason,
          }
        })

        await goodsReceiptsRepository.replaceLines(client, id, processedLines)
      }

      await client.query('COMMIT')
      await AuditService.log('UPDATE', 'goods_receipt', id, userId, existing)
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
