import { pool } from '../../config/db'
import { goodsProcessingRepository } from './goods-processing.repository'
import { stockRepository } from '../stock/stock.repository'
import {
  GoodsProcessingNotFoundError,
  GoodsProcessingInvalidStatusError,
  GoodsProcessingOutputExceedsInputError,
  GoodsProcessingPhotoRequiredError,
} from './goods-processing.errors'
import { AuditService } from '../monitoring/monitoring.service'
import type { UpdateGoodsProcessingDto, RejectDto, GoodsProcessingDetail } from './goods-processing.types'

export class GoodsProcessingService {
  async list(companyId: string, pagination: { page: number; limit: number }, filter?: { status?: string; branch_id?: string; branch_ids?: string[]; date_from?: string; date_to?: string }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await goodsProcessingRepository.findAll(companyId, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  async getById(id: string, companyId: string): Promise<GoodsProcessingDetail> {
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)
    return detail
  }

  async start(id: string, companyId: string, userId: string) {
    const gp = await goodsProcessingRepository.findById(id, companyId)
    if (!gp) throw new GoodsProcessingNotFoundError(id)
    if (gp.status !== 'DRAFT') throw new GoodsProcessingInvalidStatusError(gp.status, 'DRAFT')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await goodsProcessingRepository.updateStatus(client, id, 'PROCESSING', {
        processed_by: userId,
        processed_at: new Date().toISOString(),
      })
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await AuditService.log('UPDATE', 'goods_processing', id, userId, { status: 'DRAFT' }, { status: 'PROCESSING' })
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async update(id: string, companyId: string, dto: UpdateGoodsProcessingDto, userId: string) {
    const gp = await goodsProcessingRepository.findById(id, companyId)
    if (!gp) throw new GoodsProcessingNotFoundError(id)
    if (!['DRAFT', 'PROCESSING', 'REJECTED'].includes(gp.status)) {
      throw new GoodsProcessingInvalidStatusError(gp.status, 'DRAFT/PROCESSING/REJECTED')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      await goodsProcessingRepository.updateHeader(client, id, {
        processing_type: dto.processing_type,
        notes: dto.notes,
        updated_by: userId,
      })

      for (const inp of dto.inputs) {
        const outputs = inp.outputs.map((o, i) => ({
          product_id: o.product_id,
          qty_output: o.qty_output,
          uom: o.uom,
          is_waste: o.is_waste,
          waste_reason: o.waste_reason ?? null,
          photo_urls: o.photo_urls ?? null,
          sort_order: o.sort_order ?? i,
        }))
        await goodsProcessingRepository.replaceOutputs(client, id, inp.id, outputs)
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await AuditService.log('UPDATE', 'goods_processing', id, userId)
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async submitQc(id: string, companyId: string, userId: string) {
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)
    if (!['DRAFT', 'PROCESSING', 'REJECTED'].includes(detail.status)) {
      throw new GoodsProcessingInvalidStatusError(detail.status, 'DRAFT/PROCESSING/REJECTED')
    }

    // Validate: total output <= input per input line
    for (const inp of detail.inputs) {
      const totalOutput = inp.outputs.reduce((s, o) => s + Number(o.qty_output), 0)
      if (totalOutput > Number(inp.qty_input)) {
        throw new GoodsProcessingOutputExceedsInputError(inp.product_name, Number(inp.qty_input), totalOutput)
      }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await goodsProcessingRepository.updateStatus(client, id, 'QC_REVIEW', { updated_by: userId })
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await AuditService.log('UPDATE', 'goods_processing', id, userId, { status: detail.status }, { status: 'QC_REVIEW' })
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async confirm(id: string, companyId: string, userId: string) {
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)
    if (detail.status !== 'QC_REVIEW') throw new GoodsProcessingInvalidStatusError(detail.status, 'QC_REVIEW')

    // Validate disassembly: photo required for non-waste outputs
    if (detail.processing_type === 'DISASSEMBLY') {
      for (const inp of detail.inputs) {
        for (const out of inp.outputs) {
          if (!out.is_waste && (!out.photo_urls || out.photo_urls.length === 0)) {
            throw new GoodsProcessingPhotoRequiredError(out.product_name)
          }
        }
      }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      let totalInputQty = 0
      let totalOutputQty = 0
      let totalWasteQty = 0

      for (const inp of detail.inputs) {
        totalInputQty += Number(inp.qty_input)
        for (const out of inp.outputs) {
          if (out.is_waste) {
            totalWasteQty += Number(out.qty_output)
            continue
          }
          totalOutputQty += Number(out.qty_output)

          // Stock movement via repository
          const currentBalance = await stockRepository.getBalanceForUpdate(client, detail.warehouse_id, out.product_id)
          const currentQty = currentBalance ? Number(currentBalance.qty) : 0
          const currentAvgCost = currentBalance ? Number(currentBalance.avg_cost) : 0
          const newQty = currentQty + Number(out.qty_output)

          const movement = await stockRepository.createMovement(client, {
            warehouse_id: detail.warehouse_id,
            product_id: out.product_id,
            movement_type: 'IN_PURCHASE',
            qty: Number(out.qty_output),
            cost_per_unit: 0,
            reference_type: 'goods_processing',
            reference_id: detail.id,
            notes: `GP ${detail.processing_number}`,
            created_by: userId,
          }, newQty)

          await stockRepository.upsertBalance(client, detail.warehouse_id, out.product_id, newQty, currentAvgCost)

          // Link movement to output + set warehouse_id
          await goodsProcessingRepository.linkMovementToOutput(client, out.id, movement.id, detail.warehouse_id)
        }
      }

      // Update yield summary + status
      const yieldPct = totalInputQty > 0 ? (totalOutputQty / totalInputQty) * 100 : 0
      await goodsProcessingRepository.updateStatus(client, id, 'CONFIRMED', {
        qc_confirmed_by: userId,
        qc_confirmed_at: new Date().toISOString(),
        total_input_qty: totalInputQty,
        total_output_qty: totalOutputQty,
        total_waste_qty: totalWasteQty,
        yield_percentage: Math.round(yieldPct * 100) / 100,
        updated_by: userId,
      })

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await AuditService.log('UPDATE', 'goods_processing', id, userId, { status: 'QC_REVIEW' }, { status: 'CONFIRMED' })
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async bulkConfirm(ids: string[], companyId: string, userId: string) {
    const results: { success: string[]; failed: { id: string; reason: string }[] } = { success: [], failed: [] }

    // Process sequentially — each confirm uses its own transaction internally
    // Max 50 items enforced by schema validation
    for (const id of ids) {
      try {
        await this.confirm(id, companyId, userId)
        results.success.push(id)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        results.failed.push({ id, reason: msg })
      }
    }
    return results
  }

  async reject(id: string, companyId: string, dto: RejectDto, userId: string) {
    const gp = await goodsProcessingRepository.findById(id, companyId)
    if (!gp) throw new GoodsProcessingNotFoundError(id)
    if (gp.status !== 'QC_REVIEW') throw new GoodsProcessingInvalidStatusError(gp.status, 'QC_REVIEW')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await goodsProcessingRepository.updateStatus(client, id, 'REJECTED', {
        rejection_reason: dto.rejection_reason,
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
        updated_by: userId,
      })
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await AuditService.log('UPDATE', 'goods_processing', id, userId, { status: 'QC_REVIEW' }, { status: 'REJECTED' })
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  // ── Per-Line Actions ──────────────────────────────────────────────────────

  async startLine(lineId: string, companyId: string, userId: string) {
    const line = await goodsProcessingRepository.findLineById(lineId)
    if (!line) throw new GoodsProcessingNotFoundError(lineId)
    if (line.status !== 'PENDING') throw new GoodsProcessingInvalidStatusError(line.status, 'PENDING')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await goodsProcessingRepository.updateLineStatus(client, lineId, 'PROCESSING', {
        processed_by: userId,
        processed_at: new Date().toISOString(),
      })
      await goodsProcessingRepository.recalculateHeaderStatus(client, line.goods_processing_id)
      await client.query('COMMIT')
    } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }

    await AuditService.log('UPDATE', 'goods_processing_input', lineId, userId, { status: 'PENDING' }, { status: 'PROCESSING' })
  }

  async submitLineQc(lineId: string, companyId: string, userId: string) {
    const line = await goodsProcessingRepository.findLineById(lineId)
    if (!line) throw new GoodsProcessingNotFoundError(lineId)
    if (!['PROCESSING', 'REJECTED'].includes(line.status)) throw new GoodsProcessingInvalidStatusError(line.status, 'PROCESSING/REJECTED')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await goodsProcessingRepository.updateLineStatus(client, lineId, 'QC_REVIEW')
      await goodsProcessingRepository.recalculateHeaderStatus(client, line.goods_processing_id)
      await client.query('COMMIT')
    } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }

    await AuditService.log('UPDATE', 'goods_processing_input', lineId, userId, { status: line.status }, { status: 'QC_REVIEW' })
  }

  async confirmLine(lineId: string, companyId: string, userId: string) {
    const line = await goodsProcessingRepository.findLineById(lineId)
    if (!line) throw new GoodsProcessingNotFoundError(lineId)
    if (line.status !== 'QC_REVIEW') throw new GoodsProcessingInvalidStatusError(line.status, 'QC_REVIEW')

    // Get GP detail for warehouse_id and outputs
    const detail = await goodsProcessingRepository.findDetail(line.goods_processing_id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(line.goods_processing_id)

    const inp = detail.inputs.find(i => i.id === lineId)
    if (!inp) throw new GoodsProcessingNotFoundError(lineId)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Stock movement for this line's outputs
      for (const out of inp.outputs) {
        if (out.is_waste) continue

        const currentBalance = await stockRepository.getBalanceForUpdate(client, detail.warehouse_id, out.product_id)
        const currentQty = currentBalance ? Number(currentBalance.qty) : 0
        const currentAvgCost = currentBalance ? Number(currentBalance.avg_cost) : 0
        const newQty = currentQty + Number(out.qty_output)

        const movement = await stockRepository.createMovement(client, {
          warehouse_id: detail.warehouse_id,
          product_id: out.product_id,
          movement_type: 'IN_PURCHASE',
          qty: Number(out.qty_output),
          cost_per_unit: 0,
          reference_type: 'goods_processing',
          reference_id: detail.id,
          notes: `GP ${detail.processing_number} - ${inp.product_name}`,
          created_by: userId,
        }, newQty)

        await stockRepository.upsertBalance(client, detail.warehouse_id, out.product_id, newQty, currentAvgCost)
        await goodsProcessingRepository.linkMovementToOutput(client, out.id, movement.id, detail.warehouse_id)
      }

      // Update line status
      await goodsProcessingRepository.updateLineStatus(client, lineId, 'CONFIRMED', {
        qc_confirmed_by: userId,
        qc_confirmed_at: new Date().toISOString(),
      })

      // Recalculate header
      await goodsProcessingRepository.recalculateHeaderStatus(client, line.goods_processing_id)

      await client.query('COMMIT')
    } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }

    await AuditService.log('UPDATE', 'goods_processing_input', lineId, userId, { status: 'QC_REVIEW' }, { status: 'CONFIRMED' })
  }

  async rejectLine(lineId: string, companyId: string, dto: RejectDto, userId: string) {
    const line = await goodsProcessingRepository.findLineById(lineId)
    if (!line) throw new GoodsProcessingNotFoundError(lineId)
    if (line.status !== 'QC_REVIEW') throw new GoodsProcessingInvalidStatusError(line.status, 'QC_REVIEW')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await goodsProcessingRepository.updateLineStatus(client, lineId, 'REJECTED', {
        rejection_reason: dto.rejection_reason,
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
      })
      await goodsProcessingRepository.recalculateHeaderStatus(client, line.goods_processing_id)
      await client.query('COMMIT')
    } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }

    await AuditService.log('UPDATE', 'goods_processing_input', lineId, userId, { status: 'QC_REVIEW' }, { status: 'REJECTED' })
  }

  async bulkConfirmLines(lineIds: string[], companyId: string, userId: string) {
    const results: { success: string[]; failed: { id: string; reason: string }[] } = { success: [], failed: [] }

    for (const lineId of lineIds) {
      try {
        await this.confirmLine(lineId, companyId, userId)
        results.success.push(lineId)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        results.failed.push({ id: lineId, reason: msg })
      }
    }
    return results
  }
}

export const goodsProcessingService = new GoodsProcessingService()
