import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  DailyPrepOrder, DailyPrepOrderWithRelations, DailyPrepOrderDetail,
  DailyPrepOrderLineWithRelations, DpoForecastConfig, PublicHoliday,
  UpsertForecastConfigDto, UpsertHolidayDto, UpdateDpoLinesDto,
  DpoForecastLine, GenerateDpoDto
} from './daily-prep-orders.types'

const HEADER_SELECT = `
  dpo.*,
  b.branch_name, b.branch_code,
  sw.warehouse_name AS source_warehouse_name,
  tw.warehouse_name AS target_warehouse_name,
  emp.full_name AS confirmed_by_name,
  COALESCE(lines_agg.line_count, 0)::int AS line_count
`
const HEADER_FROM = `
  FROM daily_prep_orders dpo
  JOIN branches b ON b.id = dpo.branch_id
  JOIN warehouses sw ON sw.id = dpo.source_warehouse_id
  JOIN warehouses tw ON tw.id = dpo.target_warehouse_id
  LEFT JOIN employees emp ON emp.user_id = dpo.confirmed_by
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS line_count
    FROM daily_prep_order_lines
    WHERE dpo_id = dpo.id
  ) lines_agg ON true
`

export class DailyPrepOrdersRepository {

  // ─── BRANCH POS ID RESOLUTION ───────────────────────────────────────────────

  async resolveBranchPosId(branchUuid: string): Promise<number | null> {
    // Primary: lookup dari aggregated data (paling reliable)
    const { rows } = await pool.query(
      `SELECT DISTINCT branch_pos_id FROM pos_sync_aggregates WHERE branch_id = $1 LIMIT 1`,
      [branchUuid]
    )
    if (rows.length > 0) return rows[0].branch_pos_id

    // Fallback: exact match by branch name (lebih aman dari fuzzy LIKE)
    const { rows: fallback } = await pool.query(
      `SELECT psb.pos_id
       FROM pos_staging_branches psb
       JOIN branches b ON LOWER(b.branch_name) = LOWER(psb.branch_name)
       WHERE b.id = $1 LIMIT 1`,
      [branchUuid]
    )
    if (fallback.length > 0) return fallback[0].pos_id

    return null
  }

  async getBranchCode(client: PoolClient, branchId: string): Promise<string | null> {
    const { rows } = await client.query(
      'SELECT branch_code FROM branches WHERE id = $1',
      [branchId]
    )
    return rows[0]?.branch_code ?? null
  }

  async cancelDraftByBranchDate(client: PoolClient, draftId: string): Promise<void> {
    await client.query(
      `UPDATE daily_prep_orders SET status = 'CANCELLED', cancelled_at = now(),
       cancel_reason = 'Re-generated', is_deleted = true, updated_at = now()
       WHERE id = $1`,
      [draftId]
    )
  }

  // ─── FORECAST CONFIG ────────────────────────────────────────────────────────

  async findForecastConfig(companyId: string, branchId: string): Promise<DpoForecastConfig | null> {
    const { rows } = await pool.query(
      `SELECT * FROM dpo_forecast_configs
       WHERE company_id = $1 AND branch_id = $2 AND is_active = true`,
      [companyId, branchId]
    )
    return rows[0] ?? null
  }

  async upsertForecastConfig(
    companyId: string,
    dto: UpsertForecastConfigDto,
    userId: string
  ): Promise<DpoForecastConfig> {
    const { rows } = await pool.query(
      `INSERT INTO dpo_forecast_configs
         (company_id, branch_id, weight_7d, weight_30d, weight_dow,
          coverage_days, holiday_factor, lookback_days_short, lookback_days_long,
          created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
       ON CONFLICT (company_id, branch_id) DO UPDATE SET
         weight_7d = EXCLUDED.weight_7d,
         weight_30d = EXCLUDED.weight_30d,
         weight_dow = EXCLUDED.weight_dow,
         coverage_days = EXCLUDED.coverage_days,
         holiday_factor = EXCLUDED.holiday_factor,
         lookback_days_short = EXCLUDED.lookback_days_short,
         lookback_days_long = EXCLUDED.lookback_days_long,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING *`,
      [
        companyId, dto.branch_id, dto.weight_7d, dto.weight_30d, dto.weight_dow,
        dto.coverage_days, dto.holiday_factor,
        dto.lookback_days_short ?? 7, dto.lookback_days_long ?? 30,
        userId
      ]
    )
    return rows[0]
  }

  // ─── PUBLIC HOLIDAYS ────────────────────────────────────────────────────────

  async findHolidays(companyId: string, from: string, to: string): Promise<PublicHoliday[]> {
    const { rows } = await pool.query(
      `SELECT * FROM public_holidays
       WHERE company_id = $1 AND holiday_date BETWEEN $2 AND $3
       ORDER BY holiday_date`,
      [companyId, from, to]
    )
    return rows
  }

  async hasUpcomingHoliday(companyId: string, prepDate: string, windowDays = 2): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT EXISTS(
         SELECT 1 FROM public_holidays
         WHERE company_id = $1
           AND holiday_date BETWEEN $2::date AND ($2::date + $3 * INTERVAL '1 day')
       ) AS has_holiday`,
      [companyId, prepDate, windowDays]
    )
    return Boolean(rows[0]?.has_holiday)
  }

  async upsertHoliday(companyId: string, dto: UpsertHolidayDto, userId: string): Promise<PublicHoliday> {
    const { rows } = await pool.query(
      `INSERT INTO public_holidays (company_id, holiday_date, holiday_name, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (company_id, holiday_date) DO UPDATE SET
         holiday_name = EXCLUDED.holiday_name
       RETURNING *`,
      [companyId, dto.holiday_date, dto.holiday_name, userId]
    )
    return rows[0]
  }

  async deleteHoliday(companyId: string, holidayId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM public_holidays WHERE id = $1 AND company_id = $2`,
      [holidayId, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  // ─── FORECAST CALCULATION ───────────────────────────────────────────────────
  // LIMITASI: Hanya produk yang pernah terjual di branch ini yang akan muncul di forecast.
  // Produk baru tanpa sales history tidak akan ter-include di DPO.
  // Jika diperlukan, tambahkan opsi "include all active products" di masa depan.

  async calcForecastLines(
    branchPosId: number,
    branchUuid: string,
    prepDate: string,
    config: DpoForecastConfig,
    sourceWarehouseId: string,
    targetWarehouseId: string,
  ): Promise<DpoForecastLine[]> {
    const shortDays = config.lookback_days_short
    const longDays = config.lookback_days_long

    const { rows } = await pool.query(
      `WITH
      -- Konsumsi per hari per produk (direct dari recipe)
      daily_direct AS (
        SELECT
          sh.sales_date,
          rl.product_id,
          p.product_name,
          p.product_code,
          rl.uom,
          SUM(rl.qty * sm.qty) AS qty
        FROM tr_salesmenu sm
        JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
        JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.deleted_at IS NULL
        JOIN recipe_lines rl ON rl.menu_id = m.id AND rl.product_id IS NOT NULL
        JOIN products p ON p.id = rl.product_id
        WHERE sm.status_id = 13
          AND sh.branch_id = $1
          AND sh.sales_date BETWEEN CURRENT_DATE - ($2 * INTERVAL '1 day') AND CURRENT_DATE - 1
        GROUP BY sh.sales_date, rl.product_id, p.product_name, p.product_code, rl.uom
      ),
      -- Konsumsi per hari per produk (via WIP)
      daily_wip AS (
        SELECT
          sh.sales_date,
          wi.product_id,
          p.product_name,
          p.product_code,
          wi.uom,
          SUM((rl.qty * sm.qty / NULLIF(wip.yield_qty, 0)) * wi.qty) AS qty
        FROM tr_salesmenu sm
        JOIN tr_saleshead sh ON sh.sales_num = sm.sales_num
        JOIN menus m ON m.pos_menu_id = sm.menu_id AND m.deleted_at IS NULL
        JOIN recipe_lines rl ON rl.menu_id = m.id AND rl.wip_id IS NOT NULL
        JOIN wip_items wip ON wip.id = rl.wip_id
        JOIN wip_ingredients wi ON wi.wip_id = wip.id
        JOIN products p ON p.id = wi.product_id
        WHERE sm.status_id = 13
          AND sh.branch_id = $1
          AND sh.sales_date BETWEEN CURRENT_DATE - ($2 * INTERVAL '1 day') AND CURRENT_DATE - 1
        GROUP BY sh.sales_date, wi.product_id, p.product_name, p.product_code, wi.uom
      ),
      -- Gabungkan
      daily_all AS (
        SELECT sales_date, product_id, product_name, product_code, uom, qty FROM daily_direct
        UNION ALL
        SELECT sales_date, product_id, product_name, product_code, uom, qty FROM daily_wip
      ),
      daily_total AS (
        SELECT
          sales_date,
          product_id, product_name, product_code, uom,
          SUM(qty) AS qty
        FROM daily_all
        GROUP BY sales_date, product_id, product_name, product_code, uom
      ),
      -- Avg 7 hari
      avg_7d AS (
        SELECT product_id, AVG(qty) AS avg_qty
        FROM daily_total
        WHERE sales_date >= CURRENT_DATE - ($3 * INTERVAL '1 day')
        GROUP BY product_id
      ),
      -- avg_30d: sama
      avg_30d AS (
        SELECT product_id, AVG(qty) AS avg_qty
        FROM daily_total
        WHERE sales_date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
        GROUP BY product_id
      ),
      -- avg_dow: sama
      avg_dow AS (
        SELECT product_id, AVG(qty) AS avg_qty
        FROM daily_total
        WHERE EXTRACT(DOW FROM sales_date) = EXTRACT(DOW FROM $4::date)
        GROUP BY product_id
      ),

      -- Stok READY saat ini
      ready_stock AS (
        SELECT product_id, COALESCE(qty, 0) AS qty
        FROM stock_balances
        WHERE warehouse_id = $5
      ),
      -- Stok MAIN saat ini
      main_stock AS (
        SELECT product_id, COALESCE(qty, 0) AS qty
        FROM stock_balances
        WHERE warehouse_id = $6
      ),
      -- Produk yang pernah muncul di data historis
      all_products AS (
        SELECT DISTINCT product_id, product_name, product_code, uom
        FROM daily_total
        ORDER BY product_id
      )
      SELECT
        ap.product_id,
        ap.product_name,
        ap.product_code,
        ap.uom,
        COALESCE(a7.avg_qty, 0)::numeric AS avg_sales_7d,
        COALESCE(a30.avg_qty, 0)::numeric AS avg_sales_30d,
        COALESCE(adow.avg_qty, 0)::numeric AS avg_sales_dow,
        COALESCE(rs.qty, 0)::numeric AS current_ready_stock,
        COALESCE(ms.qty, 0)::numeric AS current_main_stock,
        COALESCE(tu.conversion_factor, 1)::numeric AS transfer_conversion_factor,
        COALESCE(tu.unit_name, ap.uom) AS transfer_unit_name
      FROM all_products ap
      LEFT JOIN avg_7d a7 ON a7.product_id = ap.product_id
      LEFT JOIN avg_30d a30 ON a30.product_id = ap.product_id
      LEFT JOIN avg_dow adow ON adow.product_id = ap.product_id
      LEFT JOIN ready_stock rs ON rs.product_id = ap.product_id
      LEFT JOIN main_stock ms ON ms.product_id = ap.product_id
      LEFT JOIN LATERAL (
        SELECT
          pu.conversion_factor,
          mu.unit_name
        FROM product_uoms pu
        JOIN metric_units mu ON mu.id = pu.metric_unit_id
        WHERE pu.product_id = ap.product_id
          AND pu.is_deleted = false
          AND pu.status_uom = 'ACTIVE'
        ORDER BY
          CASE WHEN pu.is_default_transfer_unit = true THEN 0 ELSE 1 END,
          CASE WHEN pu.is_base_unit = true THEN 0 ELSE 1 END,
          pu.conversion_factor ASC
        LIMIT 1
      ) tu ON true
      ORDER BY ap.product_name`,
      [branchPosId, longDays, shortDays, prepDate, targetWarehouseId, sourceWarehouseId]
    )

    return rows.map(r => {
      const avg7 = Number(r.avg_sales_7d)
      const avg30 = Number(r.avg_sales_30d)
      const avgDow = Number(r.avg_sales_dow)
      const readyStock = Number(r.current_ready_stock)
      const mainStock = Number(r.current_main_stock)

      // Formula: weighted avg × coverage_days (semua dalam base unit)
      const weightedAvg =
        avg7 * config.weight_7d +
        avg30 * config.weight_30d +
        avgDow * config.weight_dow

      const predictedNeed = weightedAvg * config.coverage_days
      const suggestedQty = Math.max(0, predictedNeed - readyStock)

      return {
        product_id: r.product_id,
        product_name: r.product_name,
        product_code: r.product_code,
        uom: r.uom,
        avg_sales_7d: avg7,
        avg_sales_30d: avg30,
        avg_sales_dow: avgDow,
        predicted_need: Math.round(predictedNeed * 10000) / 10000,
        current_ready_stock: readyStock,
        current_main_stock: mainStock,
        suggested_qty: Math.round(suggestedQty * 10000) / 10000,
        transfer_conversion_factor: Number(r.transfer_conversion_factor || 1),
        transfer_unit_name: r.transfer_unit_name || r.uom,
      }
    })
  }

  // ─── DPO CRUD ────────────────────────────────────────────────────────────────

  async findAll(
    branchIds: string[],
    pagination: { limit: number; offset: number },
    filter?: { branch_id?: string; status?: string; date_from?: string; date_to?: string }
  ): Promise<{ data: DailyPrepOrderWithRelations[]; total: number }> {
    const scopedBranches = filter?.branch_id
      ? branchIds.filter((id) => id === filter.branch_id)
      : branchIds
    const conditions = ['dpo.branch_id = ANY($1::uuid[])', 'dpo.is_deleted = false']
    const params: unknown[] = [scopedBranches]
    let idx = 2

    if (filter?.status) { params.push(filter.status); conditions.push(`dpo.status = $${idx++}`) }
    if (filter?.date_from) { params.push(filter.date_from); conditions.push(`dpo.prep_date >= $${idx++}::date`) }
    if (filter?.date_to) { params.push(filter.date_to); conditions.push(`dpo.prep_date <= $${idx++}::date`) }

    const where = `WHERE ${conditions.join(' AND ')}`
    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_SELECT} ${HEADER_FROM} ${where} ORDER BY dpo.prep_date DESC, dpo.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total ${HEADER_FROM} ${where}`, params),
    ])
    return { data: dataRes.rows, total: countRes.rows[0].total }
  }

  async findById(id: string, companyId: string): Promise<DailyPrepOrderWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM}
       WHERE dpo.id = $1 AND dpo.company_id = $2 AND dpo.is_deleted = false`,
      [id, companyId]
    )
    return rows[0] ?? null
  }

  async findByIdAccessible(id: string, branchIds: string[]): Promise<DailyPrepOrderWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT ${HEADER_SELECT} ${HEADER_FROM}
       WHERE dpo.id = $1 AND dpo.branch_id = ANY($2::uuid[]) AND dpo.is_deleted = false`,
      [id, branchIds],
    )
    return rows[0] ?? null
  }

  async findDetail(id: string, companyId: string): Promise<DailyPrepOrderDetail | null> {
    const header = await this.findById(id, companyId)
    if (!header) return null

    const { rows: lines } = await pool.query(
      `SELECT
         l.*,
         p.product_code, p.product_name,
         COALESCE(mu.unit_name, '') AS base_unit_name,
         COALESCE(rs.qty, 0)::numeric AS live_ready_stock,
         COALESCE(ms.qty, 0)::numeric AS live_main_stock,
         COALESCE(tu.conversion_factor, 1)::numeric AS transfer_conversion_factor,
         COALESCE(tu.unit_name, mu.unit_name) AS transfer_unit_name
       FROM daily_prep_order_lines l
       JOIN products p ON p.id = l.product_id
       LEFT JOIN product_uoms pu ON pu.product_id = p.id AND pu.is_base_unit = true AND pu.is_deleted = false
       LEFT JOIN metric_units mu ON mu.id = pu.metric_unit_id
       LEFT JOIN LATERAL (
         SELECT
           pu.conversion_factor,
           mu.unit_name
         FROM product_uoms pu
         JOIN metric_units mu ON mu.id = pu.metric_unit_id
         WHERE pu.product_id = p.id
           AND pu.is_deleted = false
           AND pu.status_uom = 'ACTIVE'
         ORDER BY
           CASE WHEN pu.is_default_transfer_unit = true THEN 0 ELSE 1 END,
           CASE WHEN pu.is_base_unit = true THEN 0 ELSE 1 END,
           pu.conversion_factor ASC
         LIMIT 1
       ) tu ON true
       LEFT JOIN stock_balances rs ON rs.product_id = l.product_id AND rs.warehouse_id = $2
       LEFT JOIN stock_balances ms ON ms.product_id = l.product_id AND ms.warehouse_id = $3
       WHERE l.dpo_id = $1
       ORDER BY l.sort_order, p.product_name`,
      [id, header.target_warehouse_id, header.source_warehouse_id]
    )

    return { ...header, lines: lines as DailyPrepOrderLineWithRelations[] }
  }

  async findDetailAccessible(id: string, branchIds: string[]): Promise<DailyPrepOrderDetail | null> {
    const header = await this.findByIdAccessible(id, branchIds)
    if (!header) return null
    return this.findDetail(id, header.company_id)
  }

  async findExistingDraft(branchId: string, prepDate: string): Promise<DailyPrepOrder | null> {
    const { rows } = await pool.query(
      `SELECT * FROM daily_prep_orders
       WHERE branch_id = $1 AND prep_date = $2::date
         AND is_deleted = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [branchId, prepDate]
    )
    return rows[0] ?? null
  }

  async cancelAllForBranchDate(client: PoolClient, branchId: string, prepDate: string): Promise<void> {
    await client.query(
      `UPDATE daily_prep_orders 
       SET status = 'CANCELLED', 
           cancelled_at = now(),
           cancel_reason = 'Re-generated', 
           is_deleted = true, 
           updated_at = now()
       WHERE branch_id = $1 AND prep_date = $2::date AND is_deleted = false`,
      [branchId, prepDate]
    )
  }

  async createWithLines(
    client: PoolClient,
    companyId: string,
    dto: GenerateDpoDto,
    dpoNumber: string,
    config: { weight_7d: number; weight_30d: number; weight_dow: number; coverage_days: number; holiday_factor_applied: number; has_upcoming_holiday: boolean },
    forecastLines: DpoForecastLine[],
    holidayFactor: number
  ): Promise<DailyPrepOrder> {
    const { rows: [dpo] } = await client.query(
      `INSERT INTO daily_prep_orders
         (company_id, branch_id, dpo_number, prep_date, status,
          source_warehouse_id, target_warehouse_id,
          weight_7d, weight_30d, weight_dow, coverage_days,
          holiday_factor_applied, has_upcoming_holiday,
          notes, created_by, updated_by)
       VALUES ($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
       RETURNING *`,
      [
        companyId, dto.branch_id, dpoNumber, dto.prep_date,
        dto.source_warehouse_id, dto.target_warehouse_id,
        config.weight_7d, config.weight_30d, config.weight_dow, config.coverage_days,
        config.holiday_factor_applied, config.has_upcoming_holiday,
        dto.notes ?? null, dto.created_by ?? null
      ]
    )

    if (forecastLines.length > 0) {
      const valueRows: string[] = []
      const params: unknown[] = []
      let idx = 1

      forecastLines.forEach((line, i) => {
        valueRows.push(`($${idx},$${idx+1},$${idx+2},$${idx+3},$${idx+4},$${idx+5},$${idx+6},$${idx+7},$${idx+8},$${idx+9},$${idx+10},$${idx+11},$${idx+12},$${idx+13})`)
        params.push(
          dpo.id, line.product_id,
          line.avg_sales_7d, line.avg_sales_30d, line.avg_sales_dow,
          holidayFactor, config.coverage_days,
          line.predicted_need, line.current_ready_stock, line.current_main_stock,
          line.suggested_qty, line.suggested_qty,  // confirmed_qty = suggested_qty as default
          line.uom, i
        )
        idx += 14
      })

      await client.query(
        `INSERT INTO daily_prep_order_lines
           (dpo_id, product_id,
            avg_sales_7d, avg_sales_30d, avg_sales_dow,
            holiday_factor, coverage_days,
            predicted_need, current_ready_stock, current_main_stock,
            suggested_qty, confirmed_qty,
            uom, sort_order)
         VALUES ${valueRows.join(',')}`,
        params
      )
    }

    return dpo
  }

  async updateLines(
    id: string,
    dto: UpdateDpoLinesDto,
    client?: PoolClient
  ): Promise<void> {
    const db = client ?? pool

    const lineIds: string[] = []
    const confirmedQtys: (number | null)[] = []
    const notesList: (string | null)[] = []

    for (const line of dto.lines) {
      lineIds.push(line.id)
      confirmedQtys.push(line.confirmed_qty)
      notesList.push(line.notes ?? null)
    }

    await db.query(
      `UPDATE daily_prep_order_lines AS l
       SET confirmed_qty = v.confirmed_qty,
           notes = COALESCE(v.notes, l.notes),
           updated_at = now()
       FROM (
         SELECT
           UNNEST($1::uuid[]) AS id,
           UNNEST($2::numeric[]) AS confirmed_qty,
           UNNEST($3::text[]) AS notes
       ) v
       WHERE l.id = v.id AND l.dpo_id = $4`,
      [lineIds, confirmedQtys, notesList, id]
    )
  }

  async deleteLine(dpoId: string, lineId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM daily_prep_order_lines WHERE id = $1 AND dpo_id = $2`,
      [lineId, dpoId]
    )
    return (rowCount ?? 0) > 0
  }

  // ─── LOCK / CONFIRM / CANCEL ────────────────────────────────────────────────

  async acquireLock(client: PoolClient, id: string, userId: string): Promise<{ lock_token: string } | null> {
    const { rows } = await client.query(
      `UPDATE daily_prep_orders
       SET lock_token = gen_random_uuid(),
           locked_at = now(),
           locked_by = $1,
           updated_at = now()
       WHERE id = $2
         AND status = 'DRAFT'
         AND is_deleted = false
         AND (
           lock_token IS NULL
           OR locked_at < now() - INTERVAL '5 minutes'
           OR locked_by = $1
         )
       RETURNING lock_token`,
      [userId, id]
    )
    return rows[0] ?? null
  }

  async confirmWithStock(
    client: PoolClient,
    id: string,
    lockToken: string,
    userId: string,
    stockMovements: { lineId: string; outMovementId: string; inMovementId: string }[]
  ): Promise<DailyPrepOrder | null> {
    // Verify lock token masih valid
    const { rows: [dpo] } = await client.query(
      `SELECT id, lock_token, locked_at, status FROM daily_prep_orders
       WHERE id = $1 AND is_deleted = false FOR UPDATE`,
      [id]
    )
    if (!dpo) return null
    if (dpo.lock_token !== lockToken) return null
    if (new Date(dpo.locked_at) < new Date(Date.now() - 5 * 60 * 1000)) return null

    // Update movement references di lines (bulk)
    const mvLineIds = stockMovements.map(mv => mv.lineId)
    const mvOutIds = stockMovements.map(mv => mv.outMovementId)
    const mvInIds = stockMovements.map(mv => mv.inMovementId)

    await client.query(
      `UPDATE daily_prep_order_lines AS l
       SET out_movement_id = v.out_id,
           in_movement_id = v.in_id,
           updated_at = now()
       FROM (
         SELECT
           UNNEST($1::uuid[]) AS id,
           UNNEST($2::uuid[]) AS out_id,
           UNNEST($3::uuid[]) AS in_id
       ) v
       WHERE l.id = v.id`,
      [mvLineIds, mvOutIds, mvInIds]
    )

    // Confirm DPO header
    const { rows } = await client.query(
      `UPDATE daily_prep_orders
       SET status = 'CONFIRMED',
           confirmed_at = now(),
           confirmed_by = $1,
           lock_token = NULL,
           locked_at = NULL,
           locked_by = NULL,
           updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [userId, id]
    )
    return rows[0] ?? null
  }

  async hardDelete(id: string, companyId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM daily_prep_orders
       WHERE id = $1 AND company_id = $2
         AND status = 'DRAFT' AND is_deleted = false`,
      [id, companyId]
    )
    return (rowCount ?? 0) > 0
  }

  async generateDpoNumber(client: PoolClient, companyId: string, branchCode: string, prepDate: string): Promise<string> {
    const dateStr = prepDate.replace(/-/g, '')
    const prefix = `DPO-${branchCode}-${dateStr}`

    // Advisory lock berdasarkan hashtext(prefix) — distributed hash dari PostgreSQL
    // untuk mencegah race condition antar transaksi yang generate DPO untuk branch+date yang sama
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [prefix])

    const { rows } = await client.query(
      `SELECT dpo_number FROM daily_prep_orders
       WHERE company_id = $1 AND dpo_number LIKE $2
       ORDER BY dpo_number DESC LIMIT 1 FOR UPDATE`,
      [companyId, `${prefix}-%`]
    )
    const lastSeq = rows.length > 0 ? parseInt(rows[0].dpo_number.split('-').pop() || '0') : 0
    return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`
  }

  async softDelete(id: string, companyId: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE daily_prep_orders
       SET is_deleted = true, deleted_at = now(), updated_by = $1
       WHERE id = $2 AND company_id = $3 AND status = 'DRAFT' AND is_deleted = false`,
      [userId, id, companyId]
    )
    return (rowCount ?? 0) > 0
  }
}

export const dailyPrepOrdersRepository = new DailyPrepOrdersRepository()