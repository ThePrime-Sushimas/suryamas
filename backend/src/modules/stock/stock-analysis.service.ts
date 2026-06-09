import { stockAnalysisRepository } from './stock-analysis.repository'
import { pool } from '../../config/db'
import { BusinessRuleError } from '../../utils/errors.base'
import type { StockAnalysisFilter, StockAnalysisResponse } from './stock-analysis.types'

export class StockAnalysisService {

  async getAnalysis(branchIds: string[], filter: StockAnalysisFilter): Promise<StockAnalysisResponse & { warehouse_name: string }> {
    // ─── Validation ─────────────────────────────────────────────────────────────
    if (!branchIds.includes(filter.branch_id)) {
      throw new BusinessRuleError('Tidak memiliki akses ke cabang ini')
    }

    const dateFrom = new Date(filter.date_from)
    const dateTo = new Date(filter.date_to)
    const diffDays = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (diffDays > 31) {
      throw new BusinessRuleError('Maksimal range tanggal 31 hari')
    }
    if (diffDays < 1) {
      throw new BusinessRuleError('date_from harus sebelum atau sama dengan date_to')
    }

    // ─── Resolve warehouse ──────────────────────────────────────────────────────
    const warehouseType = filter.warehouse_type ?? 'READY'
    const { rows: whRows } = await pool.query(
      `SELECT id, warehouse_name FROM warehouses WHERE branch_id = $1 AND warehouse_type = $2 AND deleted_at IS NULL LIMIT 1`,
      [filter.branch_id, warehouseType]
    )
    if (!whRows.length) {
      throw new BusinessRuleError(`Warehouse ${warehouseType} tidak ditemukan untuk cabang ini`)
    }
    const warehouseId = whRows[0].id as string
    const warehouseName = whRows[0].warehouse_name as string

    // ─── Resolve POS branch ID ──────────────────────────────────────────────────
    let branchPosId: number | null = null
    const { rows: posRows } = await pool.query(
      `SELECT DISTINCT branch_pos_id FROM pos_sync_aggregates WHERE branch_id = $1 LIMIT 1`,
      [filter.branch_id]
    )
    if (posRows.length > 0) {
      branchPosId = posRows[0].branch_pos_id
    } else {
      const { rows: fallback } = await pool.query(
        `SELECT psb.pos_id
         FROM pos_staging_branches psb
         JOIN branches b ON LOWER(b.branch_name) LIKE '%' || LOWER(SPLIT_PART(psb.branch_name, ' ', 2)) || '%'
         WHERE b.id = $1
         LIMIT 1`,
        [filter.branch_id]
      )
      if (fallback.length > 0) branchPosId = fallback[0].pos_id
    }

    // ─── Resolve branch name ────────────────────────────────────────────────────
    const { rows: branchRows } = await pool.query(
      `SELECT branch_name FROM branches WHERE id = $1`,
      [filter.branch_id]
    )
    const branchName = branchRows[0]?.branch_name ?? ''

    // ─── Get analysis data + summary ────────────────────────────────────────────
    const { rows: data, total, summary } = await stockAnalysisRepository.getAnalysisData(filter, warehouseId, branchPosId)

    // Fill branch_name in rows and summary
    for (const row of data) {
      row.branch_name = branchName
    }
    if (summary.worst_by_cost) summary.worst_by_cost.branch_name = branchName
    if (summary.worst_by_accuracy) summary.worst_by_accuracy.branch_name = branchName

    const page = filter.page ?? 1
    const limit = Math.min(filter.limit ?? 20, 100)
    const totalPages = Math.ceil(total / limit)

    return {
      data,
      summary,
      warehouse_name: warehouseName,
      pagination: { page, limit, total, totalPages },
    }
  }
}

export const stockAnalysisService = new StockAnalysisService()
