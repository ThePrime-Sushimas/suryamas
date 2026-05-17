import { pool } from '../../config/db'
import { goodsProcessingRepository } from './goods-processing.repository'
import { stockRepository } from '../stock/stock.repository'
import { productUomsRepository } from '../product-uoms/product-uoms.repository'
import {
  GoodsProcessingNotFoundError,
  GoodsProcessingInvalidStatusError,
  GoodsProcessingOutputExceedsInputError,
} from './goods-processing.errors'
import { AuditService } from '../monitoring/monitoring.service'
import type { UpdateGoodsProcessingDto, RejectDto, GoodsProcessingDetail } from './goods-processing.types'

// ── Helper ────────────────────────────────────────────────────────────────────
/**
 * Resolve qty in base unit for a given product + UOM name using pre-fetched UOMs map.
 * Finds the matching UOM from the cache and multiplies.
 * Falls back to the raw qty if the UOM isn't found (e.g. already base unit).
 */
function toBaseQty(
  productId: string,
  uomName: string,
  qty: number,
  uomsMap: Map<string, Array<{ unit_name: string; conversion_factor: number; is_base_unit: boolean }>>
): number {
  const productUoms = uomsMap.get(productId)
  if (!productUoms) {
    console.warn(`[toBaseQty] No UOMs found for product ${productId}, using raw qty ${qty}`)
    return qty
  }
  
  const match = productUoms.find((u) => u.unit_name === uomName)
  if (!match) {
    console.warn(`[toBaseQty] UOM "${uomName}" not found for product ${productId}, using raw qty ${qty}`)
    return qty  // fallback: treat as base unit
  }
  return qty * match.conversion_factor
}

/**
 * Helper to prefetch all UOMs for a list of product IDs and create a lookup map
 */
async function buildUomsMap(productIds: string[]): Promise<Map<string, Array<{ unit_name: string; conversion_factor: number; is_base_unit: boolean }>>> {
  if (productIds.length === 0) return new Map()
  
  const allUoms = await productUomsRepository.findAllUomsBatch(productIds)
  const uomsMap = new Map<string, Array<{ unit_name: string; conversion_factor: number; is_base_unit: boolean }>>()
  
  for (const uom of allUoms) {
    if (!uomsMap.has(uom.product_id)) {
      uomsMap.set(uom.product_id, [])
    }
    uomsMap.get(uom.product_id)!.push({
      unit_name: uom.unit_name,
      conversion_factor: uom.conversion_factor,
      is_base_unit: uom.is_base_unit,
    })
  }
  
  return uomsMap
}

const CONFIRMABLE_STATUSES = ['PROCESSING', 'REJECTED'] as const

export class GoodsProcessingService {
  async list(
    companyId: string,
    pagination: { page: number; limit: number },
    filter?: { status?: string; branch_id?: string; branch_ids?: string[]; date_from?: string; date_to?: string }
  ) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await goodsProcessingRepository.findAll(companyId, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    }
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
          product_id:   o.product_id,
          qty_output:   o.qty_output,
          uom:          o.uom,
          is_waste:     o.is_waste,
          waste_reason: o.waste_reason ?? null,
          photo_urls:   o.photo_urls ?? null,
          sort_order:   o.sort_order ?? i,
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

  // confirm() now accepts PROCESSING or REJECTED directly — no QC_REVIEW step required.
  // If QC_REVIEW is re-introduced in the future, add it back to CONFIRMABLE_STATUSES
  // and restore the submitQc() call in the frontend.
  async confirm(id: string, companyId: string, userId: string) {
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)
    if (!(CONFIRMABLE_STATUSES as readonly string[]).includes(detail.status)) {
      throw new GoodsProcessingInvalidStatusError(detail.status, CONFIRMABLE_STATUSES.join('/'))
    }

    // Validate: total output qty must not exceed input qty per line
    for (const inp of detail.inputs) {
      const totalOutput = inp.outputs.reduce((s, o) => s + Number(o.qty_output), 0)
      if (totalOutput > Number(inp.qty_input)) {
        throw new GoodsProcessingOutputExceedsInputError(inp.product_name, Number(inp.qty_input), totalOutput)
      }
    }

    // Prefetch UOMs untuk input DAN output products
    const allProductIds = [
      ...detail.inputs.map(inp => inp.product_id),
      ...detail.inputs.flatMap(inp => inp.outputs.map(o => o.product_id)),
    ]
    const uomsMap = await buildUomsMap([...new Set(allProductIds)])

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      let totalInputQty  = 0
      let totalOutputQty = 0
      let totalWasteQty  = 0

      for (const inp of detail.inputs) {
        const baseInputQty = toBaseQty(inp.product_id, inp.uom, Number(inp.qty_input), uomsMap)
        totalInputQty += baseInputQty

        for (const out of inp.outputs) {
          // Gunakan actual_qty dan actual_uom jika tersedia, fallback ke qty_output dan uom
          const qtyToUse      = out.actual_qty !== null ? Number(out.actual_qty) : Number(out.qty_output)
          const uomToUse      = out.actual_uom !== null ? out.actual_uom : out.uom
          
          if (out.is_waste) {
            totalWasteQty += qtyToUse
            continue
          }

          const currentBalance = await stockRepository.getBalanceForUpdate(client, detail.warehouse_id, out.product_id)
          const currentQty     = currentBalance ? Number(currentBalance.qty) : 0
          const currentAvgCost = currentBalance ? Number(currentBalance.avg_cost) : 0
          const baseQty        = toBaseQty(out.product_id, uomToUse, qtyToUse, uomsMap)
          totalOutputQty      += baseQty   // ← ini yang hilang dari diff
          const newQty         = currentQty + baseQty

          const movement = await stockRepository.createMovement(client, {
            warehouse_id:   detail.warehouse_id,
            product_id:     out.product_id,
            movement_type:  'IN_PURCHASE',
            qty:            baseQty,
            cost_per_unit:  0,
            reference_type: 'goods_processing',
            reference_id:   detail.id,
            notes:          `GP ${detail.processing_number}`,
            created_by:     userId,
          }, newQty)

          await stockRepository.upsertBalance(client, detail.warehouse_id, out.product_id, newQty, currentAvgCost)
          await goodsProcessingRepository.linkMovementToOutput(client, out.id, movement.id, detail.warehouse_id)
        }
      }

      const yieldPct = totalInputQty > 0 ? (totalOutputQty / totalInputQty) * 100 : 0

      await goodsProcessingRepository.updateStatus(client, id, 'CONFIRMED', {
        qc_confirmed_by:  userId,
        qc_confirmed_at:  new Date().toISOString(),
        total_input_qty:  totalInputQty,
        total_output_qty: totalOutputQty,
        total_waste_qty:  totalWasteQty,
        yield_percentage: Math.min(Math.round(yieldPct * 100) / 100, 999.99),
        updated_by:       userId,
      })

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await AuditService.log('UPDATE', 'goods_processing', id, userId, { status: detail.status }, { status: 'CONFIRMED' })
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async bulkConfirm(ids: string[], companyId: string, userId: string) {
    const results: { success: string[]; failed: { id: string; reason: string }[] } = {
      success: [],
      failed:  [],
    }
    for (const id of ids) {
      try {
        await this.confirm(id, companyId, userId)
        results.success.push(id)
      } catch (e: unknown) {
        results.failed.push({ id, reason: e instanceof Error ? e.message : 'Unknown error' })
      }
    }
    return results
  }

  async resolveReturn(id: string, outputId: string, companyId: string, resolution: 'STOCK' | 'DISCARD', userId: string) {
    // Guard: GP must exist and belong to this company
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)

    const output = detail.inputs.flatMap(i => i.outputs).find(o => o.id === outputId)
    if (!output) throw new Error(`Output ${outputId} not found in GP ${id}`)
    if (!output.flagged_for_return) throw new Error(`Output ${outputId} is not flagged for return`)

    // Prefetch UOM for this single output (still more efficient than calling toBaseQty's internal query)
    const uomsMap = await buildUomsMap([output.product_id])
    const qty = output.actual_qty != null ? Number(output.actual_qty) : Number(output.qty_output)
    const uom = output.actual_uom != null ? output.actual_uom : output.uom
    const baseQty = toBaseQty(output.product_id, uom, qty, uomsMap)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      if (resolution === 'STOCK') {
        // Move the item into stock (same logic as confirm, but only for this output)
        const currentBalance = await stockRepository.getBalanceForUpdate(client, detail.warehouse_id, output.product_id)
        const currentQty     = currentBalance ? Number(currentBalance.qty) : 0
        const currentAvgCost = currentBalance ? Number(currentBalance.avg_cost) : 0
        const newQty         = currentQty + baseQty

        const movement = await stockRepository.createMovement(client, {
          warehouse_id:   detail.warehouse_id,
          product_id:     output.product_id,
          movement_type:  'IN_PURCHASE',
          qty: baseQty,
          cost_per_unit:  0,
          reference_type: 'goods_processing',
          reference_id:   detail.id,
          notes:          `GP ${detail.processing_number} — return resolved (STOCK)`,
          created_by:     userId,
        }, newQty)

        await stockRepository.upsertBalance(client, detail.warehouse_id, output.product_id, newQty, currentAvgCost)
        await goodsProcessingRepository.linkMovementToOutput(client, outputId, movement.id, detail.warehouse_id)
      }
      // DISCARD: just mark as resolved without touching stock

      await goodsProcessingRepository.resolveReturnOutput(client, outputId, userId)
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await AuditService.log('UPDATE', 'goods_processing_outputs', outputId, userId, { flagged_for_return: true }, { flagged_for_return: false, resolution })
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async reject(id: string, companyId: string, dto: RejectDto, userId: string) {
    const gp = await goodsProcessingRepository.findById(id, companyId)
    if (!gp) throw new GoodsProcessingNotFoundError(id)
    // Reject is only meaningful from QC_REVIEW — keep this guard as-is
    // in case QC_REVIEW is re-introduced later via a separate approver role.
    if (gp.status !== 'QC_REVIEW') throw new GoodsProcessingInvalidStatusError(gp.status, 'QC_REVIEW')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await goodsProcessingRepository.updateStatus(client, id, 'REJECTED', {
        rejection_reason: dto.rejection_reason,
        rejected_by:      userId,
        rejected_at:      new Date().toISOString(),
        updated_by:       userId,
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
}

export const goodsProcessingService = new GoodsProcessingService()