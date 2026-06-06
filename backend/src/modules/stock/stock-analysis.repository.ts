import { pool } from '../../config/db'
import type { StockAnalysisFilter, StockAnalysisRow, StockAnalysisSummary } from './stock-analysis.types'

/**
 * Stock Analysis Repository
 *
 * Single CTE-based query that assembles:
 * - stok_awal: balance_after dari movement terakhir hari sebelumnya, fallback opname terdekat
 * - masuk_transfer: SUM IN_TRANSFER per product × date × warehouse
 * - masuk_produksi: SUM IN_PRODUCTION (exclude VOID orders) per product × date × warehouse
 * - penjualan_teoritis: theoretical consumption dari POS sales
 * - waste: SUM OUT_WASTE per product × date × warehouse
 * - actual_sisa: actual_qty dari opname hari itu (NULL jika tidak ada)
 */
export class StockAnalysisRepository {

  async getAnalysisData(
    filter: StockAnalysisFilter,
    warehouseId: string,
    branchPosId: number | null,
  ): Promise<{ rows: StockAnalysisRow[]; total: number; summary: StockAnalysisSummary }> {
    const params: unknown[] = [
      filter.date_from,     // $1
      filter.date_to,       // $2
      warehouseId,          // $3
      filter.branch_id,     // $4
    ]
    let idx = 5

    // Optional filters
    let productFilter = ''
    if (filter.product_id) {
      params.push(filter.product_id)
      productFilter = `AND p.id = $${idx++}`
    }

    let categoryFilter = ''
    if (filter.category_id) {
      params.push(filter.category_id)
      categoryFilter = `AND p.sub_category_id = $${idx++}`
    }

    // Branch POS ID for theoretical consumption
    let branchPosFilter = ''
    if (branchPosId != null) {
      params.push(branchPosId)
      branchPosFilter = `AND sh.branch_id = $${idx++}`
    }

    const varianceFilter = filter.only_with_variance
      ? `AND actual_sisa IS NOT NULL AND COALESCE(stok_awal, 0) + masuk_transfer + masuk_produksi - penjualan_teoritis - waste != actual_sisa`
      : ''

    const query = `
    WITH
    -- Generate date series for the period
    date_series AS (
      SELECT d::date AS tanggal
      FROM generate_series($1::date, $2::date, '1 day'::interval) d
    ),

    -- All products with stock or opname in this warehouse
    relevant_products AS (
      SELECT DISTINCT ON (p.id) p.id AS product_id, p.product_code, p.product_name,
             sc.sub_category_name AS category_name, mu.unit_name AS uom
      FROM products p
      LEFT JOIN sub_categories sc ON sc.id = p.sub_category_id
      LEFT JOIN product_uoms pu ON pu.product_id = p.id AND pu.is_base_unit = true AND pu.is_deleted = false
      LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
      WHERE p.is_deleted = false
        AND p.status = 'ACTIVE'
        ${productFilter}
        ${categoryFilter}
        AND (
          EXISTS (SELECT 1 FROM stock_balances sb WHERE sb.product_id = p.id AND sb.warehouse_id = $3)
          OR EXISTS (
            SELECT 1 FROM daily_closing_count_lines cl
            JOIN daily_closing_counts cc ON cc.id = cl.closing_id
            WHERE cl.product_id = p.id AND cc.warehouse_id = $3
              AND cc.closing_date BETWEEN $1 AND $2 AND cc.is_deleted = false
          )
        )
      ORDER BY p.id
    ),

    -- Cross join: every product × every date in range
    product_dates AS (
      SELECT ds.tanggal, rp.*
      FROM date_series ds
      CROSS JOIN relevant_products rp
    ),

    -- Stok Awal: balance_after dari movement terakhir SEBELUM tanggal ini
    -- Bounded to 90 days before date_from for performance
    stok_awal_cte AS (
      SELECT DISTINCT ON (pd.product_id, pd.tanggal)
        pd.product_id,
        pd.tanggal,
        sm.balance_after AS stok_awal
      FROM product_dates pd
      JOIN stock_movements sm
        ON sm.product_id = pd.product_id
        AND sm.warehouse_id = $3
        AND sm.movement_date < pd.tanggal
        AND sm.movement_date >= ($1::date - INTERVAL '90 days')
      ORDER BY pd.product_id, pd.tanggal, sm.movement_date DESC, sm.created_at DESC
    ),

    -- Fallback stok_awal: opname (actual_qty) terdekat sebelum tanggal
    -- Bounded to 90 days before date_from for performance
    stok_awal_opname_fallback AS (
      SELECT DISTINCT ON (pd.product_id, pd.tanggal)
        pd.product_id,
        pd.tanggal,
        cl.actual_qty AS stok_awal
      FROM product_dates pd
      JOIN daily_closing_count_lines cl ON cl.product_id = pd.product_id
      JOIN daily_closing_counts cc ON cc.id = cl.closing_id
        AND cc.warehouse_id = $3
        AND cc.closing_date >= ($1::date - INTERVAL '90 days')
        AND cc.closing_date < pd.tanggal
        AND cc.is_deleted = false
        AND cc.status IN ('CONFIRMED', 'FLAGGED')
      WHERE cl.actual_qty IS NOT NULL
      ORDER BY pd.product_id, pd.tanggal, cc.closing_date DESC
    ),

    -- Movements per product × date (aggregated)
    daily_movements AS (
      SELECT
        sm.product_id,
        sm.movement_date AS tanggal,
        SUM(CASE WHEN sm.movement_type = 'IN_TRANSFER' THEN sm.qty ELSE 0 END) AS masuk_transfer,
        SUM(CASE WHEN sm.movement_type = 'IN_PRODUCTION'
                  AND sm.reference_type = 'production_order'
                  AND NOT EXISTS (
                    SELECT 1 FROM production_orders po
                    WHERE po.id::text = sm.reference_id::text
                      AND po.status = 'VOID'
                  )
             THEN sm.qty ELSE 0 END) AS masuk_produksi,
        SUM(CASE WHEN sm.movement_type = 'OUT_WASTE' THEN ABS(sm.qty) ELSE 0 END) AS waste
      FROM stock_movements sm
      WHERE sm.warehouse_id = $3
        AND sm.movement_date BETWEEN $1 AND $2
      GROUP BY sm.product_id, sm.movement_date
    ),

    -- Theoretical consumption: POS sales × recipe
    theoretical_cte AS (
      SELECT
        agg.product_id,
        agg.tanggal,
        SUM(agg.theoretical_qty) AS penjualan_teoritis
      FROM (
        -- Direct consumption (recipe_lines.product_id)
        SELECT
          rl.product_id,
          sh.sales_date AS tanggal,
          SUM(rl.qty * sm2.qty) AS theoretical_qty
        FROM tr_salesmenu sm2
        JOIN tr_saleshead sh ON sh.sales_num = sm2.sales_num
        JOIN menus m ON m.pos_menu_id = sm2.menu_id::int AND m.deleted_at IS NULL
        JOIN recipe_lines rl ON rl.menu_id = m.id AND rl.product_id IS NOT NULL
        WHERE sm2.status_id = '13'
          AND sh.sales_date BETWEEN $1 AND $2
          ${branchPosFilter}
        GROUP BY rl.product_id, sh.sales_date

        UNION ALL

        -- WIP ingredient consumption (wip_ingredients.product_id)
        SELECT
          wi.product_id,
          sh.sales_date AS tanggal,
          SUM((rl.qty * sm2.qty / NULLIF(wip.yield_qty, 0)) * wi.qty) AS theoretical_qty
        FROM tr_salesmenu sm2
        JOIN tr_saleshead sh ON sh.sales_num = sm2.sales_num
        JOIN menus m ON m.pos_menu_id = sm2.menu_id::int AND m.deleted_at IS NULL
        JOIN recipe_lines rl ON rl.menu_id = m.id AND rl.wip_id IS NOT NULL
        JOIN wip_items wip ON wip.id = rl.wip_id
        JOIN wip_ingredients wi ON wi.wip_id = wip.id
        WHERE sm2.status_id = '13'
          AND sh.sales_date BETWEEN $1 AND $2
          ${branchPosFilter}
        GROUP BY wi.product_id, sh.sales_date

        UNION ALL

        -- WIP output consumption (wip_items.output_product_id)
        SELECT
          wip.output_product_id AS product_id,
          sh.sales_date AS tanggal,
          SUM(rl.qty * sm2.qty) AS theoretical_qty
        FROM tr_salesmenu sm2
        JOIN tr_saleshead sh ON sh.sales_num = sm2.sales_num
        JOIN menus m ON m.pos_menu_id = sm2.menu_id::int AND m.deleted_at IS NULL
        JOIN recipe_lines rl ON rl.menu_id = m.id AND rl.wip_id IS NOT NULL
        JOIN wip_items wip ON wip.id = rl.wip_id
        WHERE sm2.status_id = '13'
          AND sh.sales_date BETWEEN $1 AND $2
          ${branchPosFilter}
          AND wip.output_product_id IS NOT NULL
        GROUP BY wip.output_product_id, sh.sales_date
      ) agg
      GROUP BY agg.product_id, agg.tanggal
    ),

    -- Opname actual_qty for each product × date (aggregate if multiple positions)
    opname_actual AS (
      SELECT DISTINCT ON (cl.product_id, cc.closing_date)
        cl.product_id,
        cc.closing_date AS tanggal,
        cl.actual_qty,
        cl.cost_per_unit
      FROM daily_closing_count_lines cl
      JOIN daily_closing_counts cc ON cc.id = cl.closing_id
      WHERE cc.warehouse_id = $3
        AND cc.branch_id = $4
        AND cc.closing_date BETWEEN $1 AND $2
        AND cc.is_deleted = false
        AND cc.status IN ('CONFIRMED', 'FLAGGED')
      ORDER BY cl.product_id, cc.closing_date, cc.confirmed_at DESC NULLS LAST
    ),

    -- Avg cost from stock_balances (current)
    current_costs AS (
      SELECT product_id, avg_cost
      FROM stock_balances
      WHERE warehouse_id = $3
    ),

    -- Final assembly
    assembled AS (
      SELECT
        pd.tanggal,
        pd.product_id,
        pd.product_code,
        pd.product_name,
        pd.category_name,
        pd.uom,

        COALESCE(sa.stok_awal, saf.stok_awal) AS stok_awal,
        COALESCE(dm.masuk_transfer, 0)::numeric AS masuk_transfer,
        COALESCE(dm.masuk_produksi, 0)::numeric AS masuk_produksi,
        COALESCE(tc.penjualan_teoritis, 0)::numeric AS penjualan_teoritis,
        COALESCE(dm.waste, 0)::numeric AS waste,
        oa.actual_qty AS actual_sisa,
        COALESCE(oa.cost_per_unit, cc.avg_cost, 0)::numeric AS cost_per_unit,
        (oa.actual_qty IS NOT NULL) AS has_opname,

        -- Computed fields for summary
        CASE WHEN oa.actual_qty IS NOT NULL AND COALESCE(sa.stok_awal, saf.stok_awal) IS NOT NULL
          THEN (oa.actual_qty - (COALESCE(sa.stok_awal, saf.stok_awal) + COALESCE(dm.masuk_transfer, 0) + COALESCE(dm.masuk_produksi, 0) - COALESCE(tc.penjualan_teoritis, 0) - COALESCE(dm.waste, 0)))
               * COALESCE(oa.cost_per_unit, cc.avg_cost, 0)
          ELSE NULL
        END AS selisih_rp,
        CASE WHEN oa.actual_qty IS NOT NULL AND COALESCE(sa.stok_awal, saf.stok_awal) IS NOT NULL
              AND (COALESCE(sa.stok_awal, saf.stok_awal) + COALESCE(dm.masuk_transfer, 0) + COALESCE(dm.masuk_produksi, 0) - COALESCE(tc.penjualan_teoritis, 0) - COALESCE(dm.waste, 0)) > 0
          THEN (oa.actual_qty::numeric /
                (COALESCE(sa.stok_awal, saf.stok_awal) + COALESCE(dm.masuk_transfer, 0) + COALESCE(dm.masuk_produksi, 0) - COALESCE(tc.penjualan_teoritis, 0) - COALESCE(dm.waste, 0))) * 100
          ELSE NULL
        END AS akurasi_pct
      FROM product_dates pd
      LEFT JOIN stok_awal_cte sa ON sa.product_id = pd.product_id AND sa.tanggal = pd.tanggal
      LEFT JOIN stok_awal_opname_fallback saf ON saf.product_id = pd.product_id AND saf.tanggal = pd.tanggal
        AND sa.stok_awal IS NULL
      LEFT JOIN daily_movements dm ON dm.product_id = pd.product_id AND dm.tanggal = pd.tanggal
      LEFT JOIN theoretical_cte tc ON tc.product_id = pd.product_id AND tc.tanggal = pd.tanggal
      LEFT JOIN opname_actual oa ON oa.product_id = pd.product_id AND oa.tanggal = pd.tanggal
      LEFT JOIN current_costs cc ON cc.product_id = pd.product_id
    ),

    -- Summary aggregation from ALL data (before pagination)
    summary_agg AS (
      SELECT
        COALESCE(SUM(CASE WHEN selisih_rp < 0 THEN selisih_rp ELSE 0 END), 0) AS total_negative,
        COALESCE(SUM(CASE WHEN selisih_rp > 0 THEN selisih_rp ELSE 0 END), 0) AS total_positive,
        COUNT(DISTINCT product_id) AS total_products,
        COUNT(CASE WHEN selisih_rp < 0 THEN 1 END) AS count_negative,
        COUNT(CASE WHEN selisih_rp > 0 THEN 1 END) AS count_positive,
        ROUND(AVG(CASE WHEN akurasi_pct IS NOT NULL THEN akurasi_pct END)::numeric, 2) AS avg_accuracy,
        (SELECT product_name FROM assembled WHERE selisih_rp IS NOT NULL ORDER BY selisih_rp ASC LIMIT 1) AS worst_cost_product,
        (SELECT selisih_rp FROM assembled WHERE selisih_rp IS NOT NULL ORDER BY selisih_rp ASC LIMIT 1) AS worst_cost_rp,
        (SELECT product_name FROM assembled WHERE akurasi_pct IS NOT NULL ORDER BY akurasi_pct ASC LIMIT 1) AS worst_acc_product,
        (SELECT akurasi_pct FROM assembled WHERE akurasi_pct IS NOT NULL ORDER BY akurasi_pct ASC LIMIT 1) AS worst_acc_pct,
        COUNT(*) AS filtered_total
      FROM assembled
      WHERE 1=1 ${varianceFilter}
    )

    SELECT a.*, s.*
    FROM assembled a
    CROSS JOIN summary_agg s
    WHERE 1=1
      ${varianceFilter}
    ORDER BY a.tanggal DESC, a.product_name ASC
    LIMIT $${idx} OFFSET $${idx + 1}
    `

    const page = filter.page ?? 1
    const limit = Math.min(filter.limit ?? 50, 100)
    const offset = (page - 1) * limit
    params.push(limit, offset)

    const { rows } = await pool.query(query, params)

    // Extract summary from first row (all rows carry same summary via CROSS JOIN)
    let summary: StockAnalysisSummary = {
      total_variance_cost_negative: 0,
      total_variance_cost_positive: 0,
      total_products: 0,
      products_with_negative_variance: 0,
      products_with_positive_variance: 0,
      avg_accuracy_pct: null,
      worst_by_cost: null,
      worst_by_accuracy: null,
    }
    const total = rows.length > 0 ? Number(rows[0].filtered_total) : 0

    if (rows.length > 0) {
      const r = rows[0]
      summary = {
        total_variance_cost_negative: Math.round(Number(r.total_negative)),
        total_variance_cost_positive: Math.round(Number(r.total_positive)),
        total_products: Number(r.total_products),
        products_with_negative_variance: Number(r.count_negative),
        products_with_positive_variance: Number(r.count_positive),
        avg_accuracy_pct: r.avg_accuracy != null ? Number(r.avg_accuracy) : null,
        worst_by_cost: r.worst_cost_product
          ? { branch_name: '', product_name: r.worst_cost_product, total_rp: Math.round(Number(r.worst_cost_rp)) }
          : null,
        worst_by_accuracy: r.worst_acc_product
          ? { branch_name: '', product_name: r.worst_acc_product, avg_pct: Number(r.worst_acc_pct) }
          : null,
      }
    }

    const data: StockAnalysisRow[] = rows.map(r => {
      const stokAwal = r.stok_awal != null ? Number(r.stok_awal) : null
      const masukTransfer = Math.abs(Number(r.masuk_transfer))
      const masukProduksi = Math.abs(Number(r.masuk_produksi))
      const penjualanTeoritis = Number(r.penjualan_teoritis)
      const waste = Number(r.waste)
      const costPerUnit = Number(r.cost_per_unit)
      const actualSisa = r.actual_sisa != null ? Number(r.actual_sisa) : null

      const expectedSisa = stokAwal != null
        ? stokAwal + masukTransfer + masukProduksi - penjualanTeoritis - waste
        : null

      const selisihQty = (actualSisa != null && expectedSisa != null)
        ? actualSisa - expectedSisa
        : null

      const selisihRp = selisihQty != null ? selisihQty * costPerUnit : null

      const akurasiPct = r.akurasi_pct != null ? Math.round(Number(r.akurasi_pct) * 100) / 100 : null

      return {
        tanggal: r.tanggal,
        branch_id: filter.branch_id,
        branch_name: '', // filled by service
        product_id: r.product_id,
        product_code: r.product_code,
        product_name: r.product_name,
        category_name: r.category_name,
        uom: r.uom ?? 'unit',
        uom_warning: null,

        stok_awal: stokAwal,
        masuk_transfer: masukTransfer,
        masuk_produksi: masukProduksi,
        penjualan_teoritis: penjualanTeoritis,
        waste,
        expected_sisa: expectedSisa,
        actual_sisa: actualSisa,
        selisih_qty: selisihQty,
        selisih_rp: selisihRp,
        cost_per_unit: costPerUnit,
        akurasi_pct: akurasiPct,

        has_opname: r.has_opname,
      }
    })

    return { rows: data, total, summary }
  }
}

export const stockAnalysisRepository = new StockAnalysisRepository()
