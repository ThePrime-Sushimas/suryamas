/**
 * ⚠️ MENAMBAH MODULE BARU? Baca dulu:
 * backend/src/modules/pending-journal-posting/ADDING_NEW_MODULE.md
 */
import { pool } from '../../config/db'

export const PENDING_POSTING_MODULES = [
  'purchase_invoices',
  'general_invoices',
  'ap_payments',
  'asset_disposals',
  'stock_adjustments',
  'stock_transfers',
  'production_orders',
  'marketplace_po',
] as const

export type PendingModule = typeof PENDING_POSTING_MODULES[number]

export interface PendingPostingRow {
  id: string
  module: PendingModule
  ref_number: string
  transaction_date: string
  amount: number
  status: string
  company_id: string
  company_name: string | null
  branch_id: string | null
  branch_name: string | null
}

export interface PendingPostingSummaryRow {
  module: PendingModule
  count: number
  total_amount: number
}

export interface PendingPostingFilter {
  companyIds: string[]
  dateFrom?: string
  dateTo?: string
  module?: PendingModule
  branchId?: string
  page: number
  limit: number
}

export type PendingClosingSeverity = 'HARD_BLOCK' | 'WARNING'

export interface PendingClosingGuardRow {
  module: PendingModule
  severity: PendingClosingSeverity
  count: number
  total_amount: number
}

/**
 * Module severity classification for fiscal closing guard.
 * HARD_BLOCK = closing refused entirely (data integrity risk)
 * WARNING = closing allowed with acknowledge (operational choice)
 */
export const MODULE_CLOSING_SEVERITY: Record<PendingModule, PendingClosingSeverity> = {
  ap_payments: 'HARD_BLOCK',
  production_orders: 'HARD_BLOCK',
  purchase_invoices: 'WARNING',
  general_invoices: 'WARNING',
  asset_disposals: 'WARNING',
  stock_adjustments: 'WARNING',
  stock_transfers: 'WARNING',
  marketplace_po: 'WARNING',
}

class PendingJournalPostingRepository {
  /**
   * Get summary counts per module for given companies within a date range.
   * Uses company_id = ANY($1::uuid[]) to support multi-company in a single query.
   */
  async getSummary(
    companyIds: string[],
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ): Promise<PendingPostingSummaryRow[]> {
    if (companyIds.length === 0) return []

    const params: (string | string[] | number)[] = [companyIds]
    let dateFromIdx = 0
    let dateToIdx = 0
    let branchIdx = 0

    if (dateFrom) {
      params.push(dateFrom)
      dateFromIdx = params.length
    }
    if (dateTo) {
      params.push(dateTo)
      dateToIdx = params.length
    }
    if (branchId) {
      params.push(branchId)
      branchIdx = params.length
    }

    const df = (col: string) => dateFromIdx ? `AND ${col} >= $${dateFromIdx}::date` : ''
    const dt = (col: string) => dateToIdx ? `AND ${col} <= $${dateToIdx}::date` : ''
    const bf = (col: string) => branchIdx ? `AND ${col} = $${branchIdx}` : ''

    const query = `
      WITH pending AS (
        SELECT 'purchase_invoices'::text AS module, total_amount::numeric AS amount
        FROM purchase_invoices
        WHERE company_id = ANY($1::uuid[]) AND status = 'APPROVED' AND journal_id IS NULL AND deleted_at IS NULL
          ${df('invoice_date')} ${dt('invoice_date')} ${bf('branch_id')}

        UNION ALL

        SELECT 'general_invoices', total_amount
        FROM general_invoices
        WHERE company_id = ANY($1::uuid[]) AND status = 'DRAFT' AND journal_id IS NULL AND deleted_at IS NULL
          ${df('invoice_date')} ${dt('invoice_date')} ${bf('branch_id')}

        UNION ALL

        SELECT 'ap_payments', ap.total_amount
        FROM ap_payments ap
        LEFT JOIN journal_headers jh ON jh.id = ap.journal_id AND jh.deleted_at IS NULL
        WHERE ap.company_id = ANY($1::uuid[]) AND ap.status = 'PAID' AND ap.deleted_at IS NULL
          AND (ap.journal_id IS NULL OR jh.status != 'POSTED')
          ${df('ap.payment_date')} ${dt('ap.payment_date')} ${bf('ap.branch_id')}

        UNION ALL

        SELECT 'asset_disposals', ad.book_value_at_disposal
        FROM asset_disposals ad
        WHERE ad.company_id = ANY($1::uuid[]) AND ad.status = 'DRAFT' AND ad.journal_id IS NULL
          ${df('ad.disposal_date')} ${dt('ad.disposal_date')}

        UNION ALL

        SELECT 'stock_adjustments', sa.waste_value
        FROM stock_adjustments sa
        WHERE sa.company_id = ANY($1::uuid[]) AND sa.status = 'CONFIRMED' AND sa.journal_id IS NULL AND sa.deleted_at IS NULL
          ${df('sa.adjustment_date')} ${dt('sa.adjustment_date')} ${bf('sa.branch_id')}

        UNION ALL

        SELECT 'stock_transfers', 0
        FROM stock_transfers st
        WHERE st.company_id = ANY($1::uuid[]) AND st.status = 'CONFIRMED'
          AND st.source_branch_id != st.target_branch_id
          AND st.source_journal_id IS NULL
          AND st.deleted_at IS NULL
          ${df('st.transfer_date')} ${dt('st.transfer_date')}
          ${branchIdx ? `AND (st.source_branch_id = $${branchIdx} OR st.target_branch_id = $${branchIdx})` : ''}

        UNION ALL

        SELECT 'production_orders', po.total_material_cost
        FROM production_orders po
        WHERE po.company_id = ANY($1::uuid[]) AND po.status = 'COMPLETED' AND po.journal_id IS NULL
          AND (po.is_deleted = false OR po.is_deleted IS NULL) AND po.deleted_at IS NULL
          ${df('po.production_date')} ${dt('po.production_date')} ${bf('po.branch_id')}

        UNION ALL

        SELECT 'marketplace_po', mcs.total_amount
        FROM marketplace_checkout_sessions mcs
        WHERE mcs.company_id = ANY($1::uuid[]) AND mcs.status = 'RECEIVED' AND mcs.journal_received_id IS NULL
          AND mcs.deleted_at IS NULL
          ${df('mcs.checkout_date')} ${dt('mcs.checkout_date')}
      )
      SELECT module, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric AS total_amount
      FROM pending
      GROUP BY module
      ORDER BY module
    `

    const { rows } = await pool.query(query, params)
    return rows.map(r => ({
      module: r.module as PendingModule,
      count: r.count,
      total_amount: Number(r.total_amount),
    }))
  }

  /**
   * Get detailed list of pending records with pagination, optionally filtered by module.
   * Supports multi-company via company_id = ANY($1::uuid[]).
   * Includes company_id and company_name in results for multi-company visibility.
   */
  async findPendingRecords(filter: PendingPostingFilter): Promise<{ data: PendingPostingRow[]; total: number }> {
    const { companyIds, dateFrom, dateTo, module, branchId, page, limit } = filter
    if (companyIds.length === 0) return { data: [], total: 0 }

    const offset = (page - 1) * limit

    const params: (string | string[] | number)[] = [companyIds]
    let dateFromIdx = 0
    let dateToIdx = 0
    let branchFilterIdx = 0

    if (dateFrom) {
      params.push(dateFrom)
      dateFromIdx = params.length
    }
    if (dateTo) {
      params.push(dateTo)
      dateToIdx = params.length
    }
    if (branchId) {
      params.push(branchId)
      branchFilterIdx = params.length
    }

    const df = (col: string) => dateFromIdx ? `AND ${col} >= $${dateFromIdx}::date` : ''
    const dt = (col: string) => dateToIdx ? `AND ${col} <= $${dateToIdx}::date` : ''
    const bf = (col: string) => branchFilterIdx ? `AND ${col} = $${branchFilterIdx}` : ''

    const segments: string[] = []

    if (!module || module === 'purchase_invoices') {
      segments.push(`
        SELECT pi.id, 'purchase_invoices'::text AS module, pi.invoice_number AS ref_number,
               pi.invoice_date::text AS transaction_date, pi.total_amount::numeric AS amount,
               pi.status, pi.company_id, c.company_name, pi.branch_id, b.branch_name
        FROM purchase_invoices pi
        LEFT JOIN branches b ON b.id = pi.branch_id
        LEFT JOIN companies c ON c.id = pi.company_id
        WHERE pi.company_id = ANY($1::uuid[]) AND pi.status = 'APPROVED' AND pi.journal_id IS NULL AND pi.deleted_at IS NULL
          ${df('pi.invoice_date')} ${dt('pi.invoice_date')} ${bf('pi.branch_id')}
      `)
    }

    if (!module || module === 'general_invoices') {
      segments.push(`
        SELECT gi.id, 'general_invoices', gi.invoice_number,
               gi.invoice_date::text, gi.total_amount, gi.status,
               gi.company_id, c.company_name, gi.branch_id, b.branch_name
        FROM general_invoices gi
        LEFT JOIN branches b ON b.id = gi.branch_id
        LEFT JOIN companies c ON c.id = gi.company_id
        WHERE gi.company_id = ANY($1::uuid[]) AND gi.status = 'DRAFT' AND gi.journal_id IS NULL AND gi.deleted_at IS NULL
          ${df('gi.invoice_date')} ${dt('gi.invoice_date')} ${bf('gi.branch_id')}
      `)
    }

    if (!module || module === 'ap_payments') {
      segments.push(`
        SELECT ap.id, 'ap_payments', ap.payment_number,
               ap.payment_date::text, ap.total_amount, ap.status,
               ap.company_id, c.company_name, ap.branch_id, b.branch_name
        FROM ap_payments ap
        LEFT JOIN branches b ON b.id = ap.branch_id
        LEFT JOIN companies c ON c.id = ap.company_id
        LEFT JOIN journal_headers jh ON jh.id = ap.journal_id AND jh.deleted_at IS NULL
        WHERE ap.company_id = ANY($1::uuid[]) AND ap.status = 'PAID' AND ap.deleted_at IS NULL
          AND (ap.journal_id IS NULL OR jh.status != 'POSTED')
          ${df('ap.payment_date')} ${dt('ap.payment_date')} ${bf('ap.branch_id')}
      `)
    }

    if (!module || module === 'asset_disposals') {
      segments.push(`
        SELECT ad.id, 'asset_disposals', fa.asset_code,
               ad.disposal_date::text, ad.book_value_at_disposal, ad.status,
               ad.company_id, c.company_name, fa.branch_id, b.branch_name
        FROM asset_disposals ad
        JOIN fixed_assets fa ON fa.id = ad.fixed_asset_id
        LEFT JOIN branches b ON b.id = fa.branch_id
        LEFT JOIN companies c ON c.id = ad.company_id
        WHERE ad.company_id = ANY($1::uuid[]) AND ad.status = 'DRAFT' AND ad.journal_id IS NULL
          ${df('ad.disposal_date')} ${dt('ad.disposal_date')}
          ${branchFilterIdx ? `AND fa.branch_id = $${branchFilterIdx}` : ''}
      `)
    }

    if (!module || module === 'stock_adjustments') {
      segments.push(`
        SELECT sa.id, 'stock_adjustments', sa.adjustment_number,
               sa.adjustment_date::text, sa.waste_value, sa.status,
               sa.company_id, c.company_name, sa.branch_id, b.branch_name
        FROM stock_adjustments sa
        LEFT JOIN branches b ON b.id = sa.branch_id
        LEFT JOIN companies c ON c.id = sa.company_id
        WHERE sa.company_id = ANY($1::uuid[]) AND sa.status = 'CONFIRMED' AND sa.journal_id IS NULL AND sa.deleted_at IS NULL
          ${df('sa.adjustment_date')} ${dt('sa.adjustment_date')} ${bf('sa.branch_id')}
      `)
    }

    if (!module || module === 'stock_transfers') {
      segments.push(`
        SELECT st.id, 'stock_transfers', st.transfer_number,
               st.transfer_date::text, 0::numeric, st.status,
               st.company_id, c.company_name, st.source_branch_id AS branch_id, b.branch_name
        FROM stock_transfers st
        LEFT JOIN branches b ON b.id = st.source_branch_id
        LEFT JOIN companies c ON c.id = st.company_id
        WHERE st.company_id = ANY($1::uuid[]) AND st.status = 'CONFIRMED'
          AND st.source_branch_id != st.target_branch_id
          AND st.source_journal_id IS NULL AND st.deleted_at IS NULL
          ${df('st.transfer_date')} ${dt('st.transfer_date')}
          ${branchFilterIdx ? `AND (st.source_branch_id = $${branchFilterIdx} OR st.target_branch_id = $${branchFilterIdx})` : ''}
      `)
    }

    if (!module || module === 'production_orders') {
      segments.push(`
        SELECT po.id, 'production_orders', po.order_number,
               po.production_date::text, po.total_material_cost, po.status,
               po.company_id, c.company_name, po.branch_id, b.branch_name
        FROM production_orders po
        LEFT JOIN branches b ON b.id = po.branch_id
        LEFT JOIN companies c ON c.id = po.company_id
        WHERE po.company_id = ANY($1::uuid[]) AND po.status = 'COMPLETED' AND po.journal_id IS NULL
          AND (po.is_deleted = false OR po.is_deleted IS NULL) AND po.deleted_at IS NULL
          ${df('po.production_date')} ${dt('po.production_date')} ${bf('po.branch_id')}
      `)
    }

    if (!module || module === 'marketplace_po') {
      segments.push(`
        SELECT mcs.id, 'marketplace_po', mcs.session_number,
               mcs.checkout_date::text, mcs.total_amount, mcs.status,
               mcs.company_id, c.company_name, NULL::uuid AS branch_id, NULL::text AS branch_name
        FROM marketplace_checkout_sessions mcs
        LEFT JOIN companies c ON c.id = mcs.company_id
        WHERE mcs.company_id = ANY($1::uuid[]) AND mcs.status = 'RECEIVED' AND mcs.journal_received_id IS NULL
          AND mcs.deleted_at IS NULL
          ${df('mcs.checkout_date')} ${dt('mcs.checkout_date')}
      `)
    }

    if (segments.length === 0) {
      return { data: [], total: 0 }
    }

    const unionQuery = segments.join('\nUNION ALL\n')

    // Count query (reuses same params minus pagination)
    const countQuery = `SELECT COUNT(*)::int AS total FROM (${unionQuery}) sub`
    const { rows: countRows } = await pool.query(countQuery, params)
    const total = countRows[0]?.total ?? 0

    // Data query with pagination
    const paginatedParams = [...params]
    paginatedParams.push(limit)
    const limitIdx = paginatedParams.length
    paginatedParams.push(offset)
    const offsetIdx = paginatedParams.length

    const dataQuery = `
      SELECT * FROM (${unionQuery}) sub
      ORDER BY transaction_date DESC, module, ref_number
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `
    const { rows } = await pool.query(dataQuery, paginatedParams)

    return {
      data: rows.map(r => ({
        id: r.id,
        module: r.module as PendingModule,
        ref_number: r.ref_number,
        transaction_date: r.transaction_date,
        amount: Number(r.amount),
        status: r.status,
        company_id: r.company_id,
        company_name: r.company_name,
        branch_id: r.branch_id,
        branch_name: r.branch_name,
      })),
      total,
    }
  }
  /**
   * Get severity-classified summary for fiscal closing guard.
   * Uses the same UNION logic as getSummary but scoped to a single company + date range,
   * and returns severity classification per module.
   */
  async getClosingGuardSummary(
    companyId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<PendingClosingGuardRow[]> {
    const summaryRows = await this.getSummary([companyId], periodStart, periodEnd)

    return summaryRows.map(row => ({
      module: row.module,
      severity: MODULE_CLOSING_SEVERITY[row.module],
      count: row.count,
      total_amount: row.total_amount,
    }))
  }
}

export const pendingJournalPostingRepository = new PendingJournalPostingRepository()
