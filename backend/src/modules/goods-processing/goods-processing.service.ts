import { goodsProcessingRepository } from './goods-processing.repository'
import { productUomsRepository } from '../product-uoms/product-uoms.repository'
import {
  GoodsProcessingNotFoundError,
  GoodsProcessingInvalidStatusError,
  GoodsProcessingOutputExceedsInputError,
  GoodsProcessingReturnNotPendingError,
  GoodsProcessingReturnDiscardForbiddenError,
  GoodsProcessingReturnStockForbiddenError,
  GoodsProcessingInputsNotCompleteError,
  GoodsProcessingPendingReturnError,
  GoodsProcessingNotReopenableError,
  GoodsProcessingReopenNotNeededError,
  GoodsProcessingPostedInvoiceBlocksUnconfirmError,
  GoodsProcessingInputNotConfirmableError,
  GoodsProcessingMustUnconfirmForEditError,
} from './goods-processing.errors'
import { AuditService } from '../monitoring/monitoring.service'
import type { PermissionMatrix } from '../permissions/permissions.types'
import {
  buildProductUomsMap,
  resolveBaseUom,
  toBaseQty,
  type ProductUomsMap,
} from '../../utils/product-uom.util'
import type { UpdateGoodsProcessingDto, RejectDto, GoodsProcessingDetail } from './goods-processing.types'
import { notificationDispatcher } from '../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../notifications/notification-events'

async function buildUomsMap(productIds: string[]): Promise<ProductUomsMap> {
  if (productIds.length === 0) return new Map()
  return buildProductUomsMap(await productUomsRepository.findAllUomsBatch(productIds))
}

/** GP confirm/stock paths — missing UOM must fail, not silently use raw qty. */
function strictToBaseQty(
  productId: string,
  uom: string,
  qty: number,
  uomsMap: ProductUomsMap,
  productLabel?: string,
): number {
  return toBaseQty(productId, uom, qty, uomsMap, {
    onMissing: 'throw',
    productLabel: productLabel ?? productId,
  })
}

type GpInputLine = GoodsProcessingDetail['inputs'][number]

function formatOutputLineForAudit(output: GpInputLine['outputs'][number]) {
  return {
    product_name: output.product_name,
    product_code: output.product_code,
    qty_output: Number(output.qty_output),
    uom: output.uom,
    is_waste: output.is_waste,
    waste_reason: output.waste_reason,
    condition_status: output.condition_status,
    actual_qty: output.actual_qty != null ? Number(output.actual_qty) : null,
    actual_uom: output.actual_uom,
    flagged_for_return: output.flagged_for_return,
    return_reason: output.return_reason,
    stock_movement_id: output.stock_movement_id ?? null,
    warehouse_id: output.warehouse_id ?? null,
  }
}

function formatInputLineForAudit(
  gp: Pick<GoodsProcessingDetail, 'id' | 'processing_number' | 'warehouse_id'>,
  input: GpInputLine,
) {
  return {
    goods_processing_id: gp.id,
    processing_number: gp.processing_number,
    warehouse_id: gp.warehouse_id,
    input_id: input.id,
    gr_line_id: input.gr_line_id,
    product_name: input.product_name,
    product_code: input.product_code,
    qty_input: Number(input.qty_input),
    uom: input.uom,
    status: input.status,
    outputs: input.outputs.map(formatOutputLineForAudit),
  }
}

function formatConfirmedInputLineForAudit(
  gp: Pick<GoodsProcessingDetail, 'id' | 'processing_number' | 'warehouse_id'>,
  input: GpInputLine,
) {
  const stockMovements = input.outputs
    .filter(o => o.stock_movement_id)
    .map(o => ({
      product_name: o.product_name,
      product_code: o.product_code,
      qty_output: Number(o.qty_output),
      uom: o.uom,
      stock_movement_id: o.stock_movement_id,
      warehouse_id: o.warehouse_id,
    }))

  return {
    ...formatInputLineForAudit(gp, input),
    status: 'DONE',
    processed_by: input.processed_by,
    processed_at: input.processed_at,
    stock_movements: stockMovements,
  }
}

const CONFIRMABLE_STATUSES = ['PROCESSING', 'PARTIAL', 'REJECTED', 'CORRECTING'] as const
/** QC_REVIEW kept for legacy rows only — no active transition sets this status */
const REJECTABLE_STATUSES = ['PROCESSING', 'PARTIAL', 'QC_REVIEW'] as const

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
    let detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)
    if (detail.status === 'CONFIRMED') {
      const healed = await goodsProcessingRepository.syncInputLinesAfterFinalizedGp(id)
      if (healed > 0) {
        detail = (await goodsProcessingRepository.findDetail(id, companyId))!
      }
    }
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
    const gp = await goodsProcessingRepository.findDetail(id, companyId)
    if (!gp) throw new GoodsProcessingNotFoundError(id)
    if (!['DRAFT', 'PROCESSING', 'PARTIAL', 'REJECTED', 'CORRECTING'].includes(gp.status)) {
      throw new GoodsProcessingInvalidStatusError(gp.status, 'DRAFT/PROCESSING/PARTIAL/REJECTED/CORRECTING')
    }

    // Capture previous outputs before database modifications
    const previousOutputs = gp.inputs.map(inp => ({
      input_product_name: inp.product_name,
      outputs: inp.outputs.map(o => ({
        product_name: o.product_name,
        qty_output: Number(o.qty_output),
        uom: o.uom,
        is_waste: o.is_waste,
        waste_reason: o.waste_reason,
      }))
    }))

    await goodsProcessingRepository.updateWithOutputs(
      id,
      { processing_type: dto.processing_type, notes: dto.notes, updated_by: userId },
      dto.inputs
    )

    // Fetch fresh details after database modifications to construct new state
    const updatedGp = await goodsProcessingRepository.findDetail(id, companyId)

    const newOutputs = updatedGp!.inputs.map(inp => ({
      input_product_name: inp.product_name,
      outputs: inp.outputs.map(o => ({
        product_name: o.product_name,
        qty_output: Number(o.qty_output),
        uom: o.uom,
        is_waste: o.is_waste,
        waste_reason: o.waste_reason,
      }))
    }))

    await AuditService.log(
      'UPDATE',
      'goods_processing',
      id,
      userId,
      {
        notes: gp.notes,
        processing_type: gp.processing_type,
        outputs: previousOutputs,
      },
      {
        notes: dto.notes !== undefined ? dto.notes : gp.notes,
        processing_type: dto.processing_type !== undefined ? dto.processing_type : gp.processing_type,
        outputs: newOutputs,
      }
    )
    return updatedGp!
  }

  async confirm(id: string, companyId: string, userId: string) {
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)
    if (!(CONFIRMABLE_STATUSES as readonly string[]).includes(detail.status)) {
      throw new GoodsProcessingInvalidStatusError(detail.status, CONFIRMABLE_STATUSES.join('/'))
    }

    const totalInputs = detail.inputs.length
    const doneInputs = detail.inputs.filter((inp) =>
      inp.status === 'DONE' || inp.status === 'CONFIRMED',
    ).length
    if (totalInputs > 0 && doneInputs < totalInputs) {
      throw new GoodsProcessingInputsNotCompleteError(doneInputs, totalInputs)
    }

    const pendingReturns = detail.inputs
      .flatMap((inp) => inp.outputs)
      .filter((o) => o.flagged_for_return && !o.return_resolved_at)
    if (pendingReturns.length > 0) {
      throw new GoodsProcessingPendingReturnError(pendingReturns.length)
    }

    const allProductIds = [
      ...detail.inputs.map(inp => inp.product_id),
      ...detail.inputs.flatMap(inp => inp.outputs.map(o => o.product_id)),
    ]
    const uomsMap = await buildUomsMap([...new Set(allProductIds)])

    for (const inp of detail.inputs) {
      const baseInputQty = strictToBaseQty(
        inp.product_id,
        inp.uom,
        Number(inp.qty_input),
        uomsMap,
        inp.product_name,
      )
      const totalOutputBase = inp.outputs.reduce(
        (s, o) =>
          s +
          strictToBaseQty(o.product_id, o.uom, Number(o.qty_output), uomsMap, o.product_name ?? inp.product_name),
        0,
      )
      if (totalOutputBase > baseInputQty + 0.0001) {
        const baseUom = resolveBaseUom(uomsMap.get(inp.product_id) ?? [], inp.uom)
        throw new GoodsProcessingOutputExceedsInputError(inp.product_name, baseInputQty, baseUom, totalOutputBase)
      }
    }

    await goodsProcessingRepository.confirmGpWithStock(
      id,
      detail.inputs,
      detail.warehouse_id,
      detail.processing_number,
      userId,
      detail.status,
      uomsMap,
      strictToBaseQty
    )

    await AuditService.log('UPDATE', 'goods_processing', id, userId, { status: detail.status }, { status: 'CONFIRMED' })

    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.GOODS_PROCESSING_CONFIRMED,
      companyId,
      {
        entityId: id,
        variables: { processing_number: detail.processing_number },
        excludeUserIds: [userId],
      }
    )

    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async unconfirm(id: string, companyId: string, userId: string) {
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)
    if (detail.status !== 'CONFIRMED') {
      throw new GoodsProcessingInvalidStatusError(detail.status, 'CONFIRMED')
    }

    const hasPostedInvoice = await goodsProcessingRepository.hasPostedPurchaseInvoice(id)
    if (hasPostedInvoice) {
      throw new GoodsProcessingPostedInvoiceBlocksUnconfirmError()
    }

    await goodsProcessingRepository.unconfirmGp(id, userId)

    await AuditService.log(
      'UPDATE',
      'goods_processing',
      id,
      userId,
      { status: 'CONFIRMED' },
      { status: 'CORRECTING', reason: 'unconfirm_for_correction' },
    )
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async reopen(id: string, companyId: string, userId: string) {
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)
    if (detail.status !== 'CONFIRMED') {
      throw new GoodsProcessingNotReopenableError(detail.status)
    }

    const totalInputs = detail.inputs.length
    const doneInputs = detail.inputs.filter((inp) => inp.status === 'DONE').length
    if (totalInputs === 0 || doneInputs >= totalInputs) {
      throw new GoodsProcessingReopenNotNeededError()
    }

    const newStatus = await goodsProcessingRepository.reopenProcessing(id, userId)

    await AuditService.log(
      'UPDATE',
      'goods_processing',
      id,
      userId,
      { status: 'CONFIRMED' },
      { status: newStatus, reason: 'reopen_incomplete_lines' },
    )
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
    let detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)

    let input = detail.inputs.find(i => i.id === inputId)
    if (!input) throw new Error(`Input ${inputId} not found in GP ${id}`)

    if (detail.status === 'CONFIRMED' && ['CONFIRMED', 'DONE'].includes(input.status)) {
      throw new GoodsProcessingMustUnconfirmForEditError()
    }

    // Auto-heal lines left CONFIRMED after partial/broken unconfirm (header already CORRECTING or in progress).
    if (['CORRECTING', 'PROCESSING', 'PARTIAL'].includes(detail.status)) {
      if (['CONFIRMED', 'DONE'].includes(input.status)) {
        await goodsProcessingRepository.resetStuckInputLinesForCorrection(id, userId, inputId)
        detail = (await goodsProcessingRepository.findDetail(id, companyId))!
        input = detail.inputs.find(i => i.id === inputId)!
      }
    }

    if (!['PENDING', 'PROCESSING'].includes(input.status)) {
      throw new GoodsProcessingInputNotConfirmableError(input.status)
    }

    const auditBefore = formatInputLineForAudit(detail, input)

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
      strictToBaseQty
    )

    const updated = await goodsProcessingRepository.findDetail(id, companyId)
    const confirmedInput = updated!.inputs.find(i => i.id === inputId)
    if (!confirmedInput) throw new Error(`Input ${inputId} not found after confirm`)

    await AuditService.log(
      'UPDATE',
      'goods_processing_inputs',
      inputId,
      userId,
      auditBefore,
      formatConfirmedInputLineForAudit(updated!, confirmedInput),
    )
    return updated!
  }

  async resolveReturn(
    id: string,
    outputId: string,
    companyId: string,
    resolution: 'STOCK' | 'DISCARD',
    userId: string,
    permissions: PermissionMatrix,
  ) {
    const detail = await goodsProcessingRepository.findDetail(id, companyId)
    if (!detail) throw new GoodsProcessingNotFoundError(id)

    const output = detail.inputs.flatMap(i => i.outputs).find(o => o.id === outputId)
    if (!output) throw new GoodsProcessingNotFoundError(id)
    if (output.return_resolved_at) {
      return goodsProcessingRepository.findDetail(id, companyId)
    }
    if (!output.flagged_for_return) {
      throw new GoodsProcessingReturnNotPendingError()
    }

    // Same matrix as route middleware + frontend (role from employee_branches for active branch).
    const gpPerms = permissions.goods_processing ?? {}
    if (resolution === 'DISCARD') {
      if (!gpPerms.release) {
        throw new GoodsProcessingReturnDiscardForbiddenError()
      }
    } else if (!gpPerms.approve) {
      throw new GoodsProcessingReturnStockForbiddenError()
    }

    const uomsMap = await buildUomsMap([output.product_id])
    const qty = output.actual_qty != null ? Number(output.actual_qty) : Number(output.qty_output)
    const uom = output.actual_uom != null ? output.actual_uom : output.uom
    const baseQty = strictToBaseQty(output.product_id, uom, qty, uomsMap, output.product_name)

    const result = await goodsProcessingRepository.resolveReturnWithStock(
      outputId,
      output,
      detail.warehouse_id,
      detail.id,
      detail.processing_number,
      resolution,
      userId,
      baseQty
    )

    if (result === 'already_resolved') {
      return goodsProcessingRepository.findDetail(id, companyId)
    }

    await AuditService.log('UPDATE', 'goods_processing_outputs', outputId, userId, { flagged_for_return: true }, { flagged_for_return: false, resolution })
    return goodsProcessingRepository.findDetail(id, companyId)
  }

  async reject(id: string, companyId: string, dto: RejectDto, userId: string) {
    const gp = await goodsProcessingRepository.findById(id, companyId)
    if (!gp) throw new GoodsProcessingNotFoundError(id)
    if (!(REJECTABLE_STATUSES as readonly string[]).includes(gp.status)) {
      throw new GoodsProcessingInvalidStatusError(gp.status, REJECTABLE_STATUSES.join('/'))
    }

    await goodsProcessingRepository.rejectGp(id, dto.rejection_reason, userId)

    await AuditService.log('UPDATE', 'goods_processing', id, userId, { status: gp.status }, { status: 'REJECTED' })

    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.GOODS_PROCESSING_REJECTED,
      companyId,
      {
        entityId: id,
        variables: {
          processing_number: gp.processing_number,
          rejection_reason: dto.rejection_reason,
        },
        additionalRecipientIds:
          gp.created_by && gp.created_by !== userId ? [gp.created_by] : [],
        excludeUserIds: [userId],
      }
    )

    return goodsProcessingRepository.findDetail(id, companyId)
  }
}

export const goodsProcessingService = new GoodsProcessingService()