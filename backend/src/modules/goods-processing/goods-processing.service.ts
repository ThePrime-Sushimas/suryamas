import { goodsProcessingRepository } from './goods-processing.repository'
import { productUomsRepository } from '../product-uoms/product-uoms.repository'
import {
  GoodsProcessingNotFoundError,
  GoodsProcessingInvalidStatusError,
  GoodsProcessingOutputExceedsInputError,
} from './goods-processing.errors'
import { AuditService } from '../monitoring/monitoring.service'
import type { UpdateGoodsProcessingDto, RejectDto, GoodsProcessingDetail } from './goods-processing.types'

// ── Helpers (tetap di service karena pure logic, tidak butuh DB) ──────────────
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
    return qty
  }
  return qty * match.conversion_factor
}

async function buildUomsMap(productIds: string[]): Promise<Map<string, Array<{ unit_name: string; conversion_factor: number; is_base_unit: boolean }>>> {
  if (productIds.length === 0) return new Map()
  const allUoms = await productUomsRepository.findAllUomsBatch(productIds)
  const uomsMap = new Map<string, Array<{ unit_name: string; conversion_factor: number; is_base_unit: boolean }>>()
  for (const uom of allUoms) {
    if (!uomsMap.has(uom.product_id)) uomsMap.set(uom.product_id, [])
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
      pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 },
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

    await goodsProcessingRepository.startProcessing(id, userId)

    await AuditService.log('UPDATE', 'goods_processing', id, userId, { status: 'DRAFT' }, { status: 'PROCESSING' })
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async update(id: string, companyId: string, dto: UpdateGoodsProcessingDto, userId: string) {
    const gp = await goodsProcessingRepository.findById(id, companyId)
    if (!gp) throw new GoodsProcessingNotFoundError(id)
    if (!['DRAFT', 'PROCESSING', 'REJECTED'].includes(gp.status)) {
      throw new GoodsProcessingInvalidStatusError(gp.status, 'DRAFT/PROCESSING/REJECTED')
    }

    await goodsProcessingRepository.updateWithOutputs(
      id,
      { processing_type: dto.processing_type, notes: dto.notes, updated_by: userId },
      dto.inputs
    )

    await AuditService.log('UPDATE', 'goods_processing', id, userId)
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async confirm(id: string, companyId: string, userId: string) {
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)
    if (!(CONFIRMABLE_STATUSES as readonly string[]).includes(detail.status)) {
      throw new GoodsProcessingInvalidStatusError(detail.status, CONFIRMABLE_STATUSES.join('/'))
    }

    for (const inp of detail.inputs) {
      const totalOutput = inp.outputs.reduce((s, o) => s + Number(o.qty_output), 0)
      if (totalOutput > Number(inp.qty_input)) {
        throw new GoodsProcessingOutputExceedsInputError(inp.product_name, Number(inp.qty_input), totalOutput)
      }
    }

    const allProductIds = [
      ...detail.inputs.map(inp => inp.product_id),
      ...detail.inputs.flatMap(inp => inp.outputs.map(o => o.product_id)),
    ]
    const uomsMap = await buildUomsMap([...new Set(allProductIds)])

    await goodsProcessingRepository.confirmGpWithStock(
      id,
      detail.inputs,
      detail.warehouse_id,
      detail.processing_number,
      userId,
      detail.status,
      uomsMap,
      toBaseQty
    )

    await AuditService.log('UPDATE', 'goods_processing', id, userId, { status: detail.status }, { status: 'CONFIRMED' })
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async bulkConfirm(ids: string[], companyId: string, userId: string) {
    const results: { success: string[]; failed: { id: string; reason: string }[] } = { success: [], failed: [] }
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

  async confirmInput(id: string, inputId: string, companyId: string, outputs: any[], userId: string) {
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)

    const input = detail.inputs.find(i => i.id === inputId)
    if (!input) throw new Error(`Input ${inputId} not found in GP ${id}`)
    if (!['PENDING', 'PROCESSING'].includes(input.status)) {
      throw new Error(`Input ${inputId} cannot be confirmed (current status: ${input.status})`)
    }

    const outputProductIds = outputs.map((o: any) => o.product_id)
    const uomsMap = await buildUomsMap([...new Set(outputProductIds)])

    await goodsProcessingRepository.confirmInputWithStock(
      id,
      inputId,
      outputs,
      detail.warehouse_id,
      detail.processing_number,
      userId,
      uomsMap,
      toBaseQty
    )

    await AuditService.log('UPDATE', 'goods_processing_inputs', inputId, userId, { status: input.status }, { status: 'DONE' })
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async resolveReturn(id: string, outputId: string, companyId: string, resolution: 'STOCK' | 'DISCARD', userId: string) {
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)

    const output = detail.inputs.flatMap(i => i.outputs).find(o => o.id === outputId)
    if (!output) throw new Error(`Output ${outputId} not found in GP ${id}`)
    if (!output.flagged_for_return) throw new Error(`Output ${outputId} is not flagged for return`)

    const uomsMap = await buildUomsMap([output.product_id])
    const qty = output.actual_qty != null ? Number(output.actual_qty) : Number(output.qty_output)
    const uom = output.actual_uom != null ? output.actual_uom : output.uom
    const baseQty = toBaseQty(output.product_id, uom, qty, uomsMap)

    await goodsProcessingRepository.resolveReturnWithStock(
      outputId,
      output,
      detail.warehouse_id,
      detail.id,
      detail.processing_number,
      resolution,
      userId,
      baseQty
    )

    await AuditService.log('UPDATE', 'goods_processing_outputs', outputId, userId, { flagged_for_return: true }, { flagged_for_return: false, resolution })
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async reject(id: string, companyId: string, dto: RejectDto, userId: string) {
    const gp = await goodsProcessingRepository.findById(id, companyId)
    if (!gp) throw new GoodsProcessingNotFoundError(id)
    if (gp.status !== 'QC_REVIEW') throw new GoodsProcessingInvalidStatusError(gp.status, 'QC_REVIEW')

    await goodsProcessingRepository.rejectGp(id, dto.rejection_reason, userId)

    await AuditService.log('UPDATE', 'goods_processing', id, userId, { status: 'QC_REVIEW' }, { status: 'REJECTED' })
    return goodsProcessingRepository.findDetail(id, companyId)
  }
}

export const goodsProcessingService = new GoodsProcessingService()