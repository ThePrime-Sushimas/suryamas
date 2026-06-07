import { productionRequestsRepository } from './production-requests.repository'
import { stockRepository } from '../stock/stock.repository'
import { stockTransfersRepository } from '../stock-transfers/stock-transfers.repository'
import { warehousesRepository } from '../warehouses/warehouses.repository'
import { productionOrdersRepository } from '../food-production/production-orders/production-orders.repository'
import { WipRepository } from '../food-production/wip/wip.repository'
import {
  ProductionRequestNotFoundError,
  ProductionRequestInvalidStatusError,
} from './production-requests.errors'
import { BusinessRuleError } from '../../utils/errors.base'
import { AuditService } from '../monitoring/monitoring.service'
import { getCompanyIdForBranch, getAccessibleCompanyIds } from '../../utils/branch-access.util'
import { pool } from '../../config/db'
import type {
  CreateProductionRequestDto, UpdateProductionRequestDto,
  AcceptProductionRequestDto, ReceiveProductionRequestDto, CancelProductionRequestDto,
  ProductionRequestDetail,
} from './production-requests.types'

const wipRepository = new WipRepository()

export class ProductionRequestsService {

  // ─── LIST ─────────────────────────────────────────────────────────────────────

  async list(
    branchIds: string[],
    pagination: { page: number; limit: number },
    filter?: {
      status?: string
      requesting_branch_id?: string
      fulfilling_branch_id?: string
      date_from?: string; date_to?: string; search?: string
    }
  ) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await productionRequestsRepository.findAll(branchIds, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return {
      data,
      pagination: {
        page: pagination.page, limit: pagination.limit, total, totalPages,
        hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1,
      },
    }
  }

  // ─── GET BY ID ────────────────────────────────────────────────────────────────

  async getById(id: string, branchIds: string[]): Promise<ProductionRequestDetail> {
    const detail = await productionRequestsRepository.findById(id, branchIds)
    if (!detail) throw new ProductionRequestNotFoundError(id)
    return detail
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────────────────

  async summary(companyId: string, filter?: { status?: string; date_from?: string; date_to?: string }) {
    return productionRequestsRepository.getSummary(companyId, filter)
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────────

  async create(branchIds: string[], dto: CreateProductionRequestDto): Promise<ProductionRequestDetail> {
    if (!branchIds.includes(dto.requesting_branch_id)) {
      throw new BusinessRuleError('Anda tidak memiliki akses ke cabang peminta')
    }

    const companyId = await getCompanyIdForBranch(dto.requesting_branch_id)
    if (!companyId) throw new BusinessRuleError('Cabang peminta tidak ditemukan')

    const requestId = await stockRepository.withTransaction(async (client) => {
      const branchCode = await productionRequestsRepository.getBranchCode(client, dto.requesting_branch_id)
      if (!branchCode) throw new BusinessRuleError('Branch code tidak ditemukan')

      const requestNumber = await productionRequestsRepository.generateRequestNumber(client, companyId, branchCode, dto.request_date)
      const { id } = await productionRequestsRepository.create(client, companyId, dto, requestNumber)
      await productionRequestsRepository.createLines(client, id, dto.lines)

      await AuditService.log('CREATE', 'production_request', id, dto.created_by ?? '', undefined, {
        request_number: requestNumber, line_count: dto.lines.length,
      })
      return id
    })

    return this.getById(requestId, branchIds)
  }

  // ─── UPDATE (DRAFT only) ─────────────────────────────────────────────────────

  async update(id: string, branchIds: string[], dto: UpdateProductionRequestDto): Promise<ProductionRequestDetail> {
    await stockRepository.withTransaction(async (client) => {
      const detail = await productionRequestsRepository.lockAndFindById(client, id, branchIds)
      if (!detail) throw new ProductionRequestNotFoundError(id)
      if (detail.status !== 'DRAFT') throw new ProductionRequestInvalidStatusError(detail.status, 'DRAFT')

      await productionRequestsRepository.updateHeader(client, id, dto)
      if (dto.lines) await productionRequestsRepository.replaceLines(client, id, dto.lines)

      await AuditService.log('UPDATE', 'production_request', id, dto.updated_by ?? '', undefined, { request_number: detail.request_number })
    })
    return this.getById(id, branchIds)
  }

  // ─── ACCEPT ───────────────────────────────────────────────────────────────────

  async accept(id: string, branchIds: string[], dto: AcceptProductionRequestDto): Promise<ProductionRequestDetail> {
    // Pre-fetch outside transaction
    const companyIds = await getAccessibleCompanyIds(dto.accepted_by)

    await stockRepository.withTransaction(async (client) => {
      const detail = await productionRequestsRepository.lockAndFindById(client, id, branchIds)
      if (!detail) throw new ProductionRequestNotFoundError(id)
      if (detail.status !== 'DRAFT') throw new ProductionRequestInvalidStatusError(detail.status, 'DRAFT')

      if (!branchIds.includes(detail.fulfilling_branch_id)) {
        throw new BusinessRuleError('Anda tidak memiliki akses ke cabang pemenuh (central)')
      }

      await productionRequestsRepository.accept(client, id, dto.accepted_by, dto.accept_notes ?? null)

      // Update line approvals
      if (dto.lines && dto.lines.length > 0) {
        for (const line of dto.lines) {
          await productionRequestsRepository.updateLineApproval(client, line.id, line.qty_approved)
        }
      }

      // ─── Get approved lines with conversion info ─────────────────────────
      const { rows: approvedLines } = await client.query(
        `SELECT prl.product_id, COALESCE(prl.qty_approved, prl.qty) AS qty, prl.uom, prl.notes,
                tu.conversion_factor,
                w.id AS wip_id, w.wip_code, w.wip_name, w.yield_qty, w.uom AS wip_uom, w.estimated_cost
         FROM production_request_lines prl
         LEFT JOIN product_uoms tu ON tu.product_id = prl.product_id AND tu.is_default_transfer_unit = true AND tu.is_deleted = false
         LEFT JOIN wip_items w ON w.output_product_id = prl.product_id AND w.deleted_at IS NULL AND w.is_active = true
         WHERE prl.production_request_id = $1 ORDER BY prl.sort_order`,
        [id]
      )

      const companyId = detail.company_id
      const today = new Date().toISOString().slice(0, 10)

      // ─── Auto-create Production Order ────────────────────────────────────
      const wipLines = approvedLines.filter((l: any) => l.wip_id && Number(l.qty) > 0)

      if (wipLines.length > 0) {
        const branchCode = await productionOrdersRepository.findBranchCode(client, detail.fulfilling_branch_id) ?? 'XXX'
        const dateStr = today.replace(/-/g, '')
        const prefix = `PRD-${branchCode}-${dateStr}`
        const last = await productionOrdersRepository.getLastOrderNumber(companyId, prefix)
        const lastSeq = last ? parseInt(last.split('-').pop() || '0') : 0
        const orderNumber = `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`

        const poHeader = await productionOrdersRepository.insertHeader(client, {
          company_id: companyId,
          branch_id: detail.fulfilling_branch_id,
          order_number: orderNumber,
          production_date: today,
          notes: `Auto dari Request ${detail.request_number}`,
          created_by: dto.accepted_by,
        })

        for (let i = 0; i < wipLines.length; i++) {
          const pl = wipLines[i] as any
          // Calculate batch qty: (qty_ordered × conversion_factor) ÷ yield_qty
          const convFactor = Number(pl.conversion_factor) || 1
          const totalBase = Number(pl.qty) * convFactor
          const batchQty = Math.ceil(totalBase / Number(pl.yield_qty))

          const poLine = await productionOrdersRepository.insertLine(client, {
            production_order_id: poHeader.id,
            wip_id: pl.wip_id,
            wip_name: pl.wip_name,
            wip_code: pl.wip_code,
            yield_per_batch: Number(pl.yield_qty),
            uom: pl.wip_uom,
            cost_per_batch: Number(pl.estimated_cost),
            planned_batch_qty: batchQty,
            sort_order: i,
          })

          // Insert materials from WIP recipe
          const wip = await wipRepository.findByIdWithIngredientsAccessible(pl.wip_id, companyIds)
          if (wip?.ingredients) {
            for (let j = 0; j < wip.ingredients.length; j++) {
              const ing = wip.ingredients[j]
              await productionOrdersRepository.insertMaterial(client, {
                production_order_id: poHeader.id,
                production_line_id: poLine.id,
                product_id: ing.product_id,
                product_name: ing.product_name ?? '',
                product_code: ing.product_code ?? '',
                planned_qty: ing.qty * batchQty,
                uom: ing.uom,
                cost_per_unit: ing.cost_per_unit,
                cost_source: ing.cost_per_unit > 0 ? 'wip_ingredient' : 'average_cost',
                sort_order: j,
              })
            }
          }
        }

        await AuditService.log('CREATE', 'production_order', poHeader.id, dto.accepted_by, undefined, {
          order_number: orderNumber, source: 'production_request', production_request_id: id,
        })
      }

      // ─── Auto-create Stock Transfer ──────────────────────────────────────
      const transferLines = approvedLines
        .filter((l: any) => Number(l.qty) > 0)
        .map((l: any) => {
          const convFactor = Number(l.conversion_factor) || 1
          return { product_id: l.product_id, qty: Number(l.qty) * convFactor, notes: l.notes }
        })

      if (transferLines.length > 0) {
        const sourceWarehouseId = await warehousesRepository.findByBranchAndType(detail.fulfilling_branch_id, 'FINISHED_GOODS')
          ?? await warehousesRepository.findByBranchAndType(detail.fulfilling_branch_id, 'MAIN')
        const targetWarehouseId = await warehousesRepository.findByBranchAndType(detail.requesting_branch_id, 'MAIN')

        if (sourceWarehouseId && targetWarehouseId) {
          const stBranchCode = await stockTransfersRepository.getBranchCode(client, detail.fulfilling_branch_id)
          if (!stBranchCode) throw new BusinessRuleError('Branch code central tidak ditemukan')

          const transferNumber = await stockTransfersRepository.generateTransferNumber(client, companyId, stBranchCode, today, 'TRANSFER')

          const { id: transferId } = await stockTransfersRepository.create(client, companyId, {
            transfer_type: 'TRANSFER',
            source_warehouse_id: sourceWarehouseId,
            target_warehouse_id: targetWarehouseId,
            transfer_date: today,
            notes: `Auto dari Production Request ${detail.request_number}`,
            lines: transferLines,
            created_by: dto.accepted_by,
          }, transferNumber, detail.fulfilling_branch_id, detail.requesting_branch_id)

          await stockTransfersRepository.createLines(client, transferId, transferLines)
          await productionRequestsRepository.linkStockTransfer(client, id, transferId)

          await AuditService.log('CREATE', 'stock_transfer', transferId, dto.accepted_by, undefined, {
            transfer_number: transferNumber, source: 'production_request', production_request_id: id,
          })
        }
      }

      await AuditService.log('ACCEPT', 'production_request', id, dto.accepted_by, undefined, { request_number: detail.request_number })
    })

    return this.getById(id, branchIds)
  }

  // ─── RECEIVE ──────────────────────────────────────────────────────────────────

  async receive(id: string, branchIds: string[], dto: ReceiveProductionRequestDto): Promise<ProductionRequestDetail> {
    await stockRepository.withTransaction(async (client) => {
      const detail = await productionRequestsRepository.lockAndFindById(client, id, branchIds)
      if (!detail) throw new ProductionRequestNotFoundError(id)
      if (detail.status !== 'ACCEPTED') throw new ProductionRequestInvalidStatusError(detail.status, 'ACCEPTED')

      if (!branchIds.includes(detail.requesting_branch_id)) {
        throw new BusinessRuleError('Anda tidak memiliki akses ke cabang peminta')
      }

      await productionRequestsRepository.receive(client, id, dto.received_by, dto.receive_notes ?? null)
      await AuditService.log('RECEIVE', 'production_request', id, dto.received_by, undefined, { request_number: detail.request_number })
    })
    return this.getById(id, branchIds)
  }

  // ─── CANCEL ───────────────────────────────────────────────────────────────────

  async cancel(id: string, branchIds: string[], dto: CancelProductionRequestDto): Promise<ProductionRequestDetail> {
    await stockRepository.withTransaction(async (client) => {
      const detail = await productionRequestsRepository.lockAndFindById(client, id, branchIds)
      if (!detail) throw new ProductionRequestNotFoundError(id)
      if (detail.status === 'RECEIVED' || detail.status === 'CANCELLED') {
        throw new ProductionRequestInvalidStatusError(detail.status, 'DRAFT atau ACCEPTED')
      }

      await productionRequestsRepository.cancel(client, id, dto.cancelled_by, dto.cancel_reason ?? null)
      await AuditService.log('CANCEL', 'production_request', id, dto.cancelled_by, undefined, { request_number: detail.request_number })
    })
    return this.getById(id, branchIds)
  }

  // ─── SOFT DELETE ──────────────────────────────────────────────────────────────

  async softDelete(id: string, branchIds: string[], userId: string): Promise<void> {
    await stockRepository.withTransaction(async (client) => {
      const detail = await productionRequestsRepository.lockAndFindById(client, id, branchIds)
      if (!detail) throw new ProductionRequestNotFoundError(id)
      if (detail.status !== 'DRAFT') throw new ProductionRequestInvalidStatusError(detail.status, 'DRAFT')

      await productionRequestsRepository.softDelete(client, id, userId)
      await AuditService.log('DELETE', 'production_request', id, userId, undefined, { request_number: detail.request_number })
    })
  }
}

export const productionRequestsService = new ProductionRequestsService()
