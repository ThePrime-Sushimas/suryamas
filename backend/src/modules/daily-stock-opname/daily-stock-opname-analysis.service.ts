import { dailyStockOpnameRepository, DailyStockOpnameRepository } from './daily-stock-opname.repository'
import { AppError, ErrorCategory } from '../../utils/errors.base'
import type {
  DailyClosingCountLine,
  AnalysisLineItem,
  AnalysisResponse,
} from './daily-stock-opname.types'

// ─── ANALYSIS SERVICE ─────────────────────────────────────────────────────────

/**
 * Computes per-line real consumption analysis for a confirmed opname session.
 *
 * Formula:
 *   pemakaian_riil = stok_kemarin − (stok_hari_ini + waste) + total_konversi
 *
 * Note: barang_masuk (dpo_in_qty) is included in the response for display/transparency
 * but is NOT used in the pemakaian_riil formula — system_qty already includes
 * DPO transfers via stock_balances, so adding barang_masuk would double-count.
 */
export function computeAnalysisLine(
  line: DailyClosingCountLine,
  conversionMovements: Map<string, number>,
): AnalysisLineItem {
  const stok_kemarin = line.system_qty
  const barang_masuk = line.dpo_in_qty
  const stok_hari_ini = line.actual_qty!

  // waste = abs(negative variance) only when variance is negative
  const variance = line.actual_qty! - line.expected_qty
  const waste = variance < 0 ? Math.abs(variance) : 0

  // total_konversi: net conversion (IN_CONVERSION - OUT_CONVERSION) for this product
  const total_konversi = conversionMovements.get(line.product_id) ?? 0

  // Pemakaian Riil formula (barang_masuk excluded to avoid double-counting)
  const pemakaian_riil = stok_kemarin - (stok_hari_ini + waste) + total_konversi

  // Pemakaian POS: theoretical_out (0 if no recipe)
  const pemakaian_pos = line.has_recipe ? line.theoretical_out : 0

  // Gap
  const gap = pemakaian_riil - pemakaian_pos

  return {
    product_id: line.product_id,
    product_code: line.product_code,
    product_name: line.product_name,
    uom: line.uom,
    stok_kemarin,
    barang_masuk,
    stok_hari_ini,
    waste,
    total_konversi,
    pemakaian_riil,
    pemakaian_pos,
    gap,
    has_recipe: line.has_recipe,
  }
}

export class DailyStockOpnameAnalysisService {
  constructor(private readonly repository: DailyStockOpnameRepository) {}

  /**
   * Computes real consumption analysis for a confirmed/flagged opname session.
   *
   * Steps:
   * 1. Fetch session by ID + branchIds
   * 2. Validate status is CONFIRMED or FLAGGED
   * 3. Fetch session lines
   * 4. Get product IDs from lines
   * 5. Query conversion movements for the date
   * 6. Map each line through computeAnalysisLine
   * 7. Compute summary totals
   * 8. Return AnalysisResponse
   *
   * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.14
   */
  async getAnalysis(sessionId: string, branchIds: string[]): Promise<AnalysisResponse> {
    // 1. Fetch session by ID + branchIds (validates branch access)
    const session = await this.repository.findByIdAccessible(sessionId, branchIds)
    if (!session) {
      throw new AppError(
        'Sesi opname tidak ditemukan',
        404,
        'OPNAME_NOT_FOUND',
        undefined,
        undefined,
        ErrorCategory.NOT_FOUND,
      )
    }

    // 2. Validate status is CONFIRMED or FLAGGED
    if (session.status !== 'CONFIRMED' && session.status !== 'FLAGGED') {
      throw new AppError(
        'Analisis hanya tersedia setelah opname dikonfirmasi',
        400,
        'OPNAME_NOT_CONFIRMED',
        undefined,
        undefined,
        ErrorCategory.BUSINESS_RULE,
      )
    }

    // 3. Session lines are already loaded in findByIdAccessible
    const lines = session.lines

    // 4. Get product IDs from lines
    const productIds = lines.map((l) => l.product_id)

    // 5. Query conversion movements for date + warehouse + product IDs
    const conversionMovements = await this.repository.getConversionMovementsForDate(
      session.warehouse_id,
      session.closing_date,
      productIds,
    )

    // 6. Map each line through computeAnalysisLine
    const analysisLines: AnalysisLineItem[] = lines.map((line) =>
      computeAnalysisLine(line, conversionMovements),
    )

    // 7. Compute summary totals
    const summary = {
      total_pemakaian_riil: analysisLines.reduce((sum, l) => sum + l.pemakaian_riil, 0),
      total_pemakaian_pos: analysisLines.reduce((sum, l) => sum + l.pemakaian_pos, 0),
      total_gap: analysisLines.reduce((sum, l) => sum + l.gap, 0),
    }

    // 8. Return AnalysisResponse
    return {
      session_id: session.id,
      closing_date: session.closing_date,
      branch_name: session.branch_name,
      lines: analysisLines,
      summary,
    }
  }
}

export const dailyStockOpnameAnalysisService = new DailyStockOpnameAnalysisService(dailyStockOpnameRepository)
