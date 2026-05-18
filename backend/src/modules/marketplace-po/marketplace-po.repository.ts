import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  OwnerCreditCardCreateRepoData,
  OwnerCreditCardUpdateRepoData,
  OwnerCreditCardWithSettlement,
} from './marketplace-po.types'

const OWNER_CC_SELECT = `
  occ.*,
  ba.account_name AS settlement_bank_account_name,
  ba.account_number AS settlement_bank_account_number,
  bk.bank_name AS settlement_bank_name
`

const OWNER_CC_FROM = `
  FROM owner_credit_cards occ
  LEFT JOIN bank_accounts ba ON ba.id = occ.settlement_bank_account_id AND ba.deleted_at IS NULL
  LEFT JOIN banks bk ON bk.id = ba.bank_id
`

export class MarketplacePoRepository {
  async findOwnerCreditCards(companyId: string): Promise<OwnerCreditCardWithSettlement[]> {
    const { rows } = await pool.query(
      `SELECT ${OWNER_CC_SELECT}
       ${OWNER_CC_FROM}
       WHERE occ.company_id = $1 AND occ.is_active = true
       ORDER BY occ.sort_order ASC, occ.card_label ASC`,
      [companyId],
    )
    return rows as OwnerCreditCardWithSettlement[]
  }

  async listOwnerCreditCards(companyId: string, filter?: { is_active?: boolean }): Promise<OwnerCreditCardWithSettlement[]> {
    const params: unknown[] = [companyId]
    let sql = `SELECT ${OWNER_CC_SELECT} ${OWNER_CC_FROM} WHERE occ.company_id = $1`
    if (filter?.is_active !== undefined) {
      params.push(filter.is_active)
      sql += ` AND occ.is_active = $2`
    }
    sql += ` ORDER BY occ.sort_order ASC, occ.card_label ASC`
    const { rows } = await pool.query(sql, params)
    return rows as OwnerCreditCardWithSettlement[]
  }

  async findActiveOwnerCreditCards(companyId: string): Promise<OwnerCreditCardWithSettlement[]> {
    const { rows } = await pool.query(
      `SELECT ${OWNER_CC_SELECT}
       ${OWNER_CC_FROM}
       WHERE occ.company_id = $1 AND occ.is_active = true
       ORDER BY occ.sort_order ASC, occ.card_label ASC`,
      [companyId],
    )
    return rows as OwnerCreditCardWithSettlement[]
  }

  async findOwnerCreditCardById(
    companyId: string,
    id: string,
    client?: PoolClient,
  ): Promise<OwnerCreditCardWithSettlement | null> {
    const executor = client ?? pool
    const { rows } = await executor.query(
      `SELECT ${OWNER_CC_SELECT}
       ${OWNER_CC_FROM}
       WHERE occ.id = $1 AND occ.company_id = $2`,
      [id, companyId],
    )
    return (rows[0] as OwnerCreditCardWithSettlement) ?? null
  }

  async createOwnerCreditCard(
    client: PoolClient,
    companyId: string,
    userId: string,
    data: OwnerCreditCardCreateRepoData,
  ): Promise<OwnerCreditCardWithSettlement | null> {
    const { rows } = await client.query(
      `INSERT INTO owner_credit_cards (
         company_id, card_label, bank_name, last4, coa_code, is_active, sort_order,
         settlement_bank_account_id, created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        companyId,
        data.card_label,
        data.bank_name,
        data.last4,
        data.coa_code,
        data.is_active,
        data.sort_order,
        data.settlement_bank_account_id,
        userId,
      ],
    )
    const id = rows[0]?.id as string | undefined
    if (!id) return null
    return this.findOwnerCreditCardById(companyId, id, client)
  }

  async updateOwnerCreditCard(
    client: PoolClient,
    id: string,
    companyId: string,
    userId: string,
    data: OwnerCreditCardUpdateRepoData,
  ): Promise<OwnerCreditCardWithSettlement | null> {
    const sets: string[] = ['updated_at = now()']
    const params: unknown[] = []
    let idx = 1

    if (data.card_label !== undefined) {
      sets.push(`card_label = $${idx}`)
      params.push(data.card_label)
      idx++
    }
    if (data.bank_name !== undefined) {
      sets.push(`bank_name = $${idx}`)
      params.push(data.bank_name)
      idx++
    }
    if (data.last4 !== undefined) {
      sets.push(`last4 = $${idx}`)
      params.push(data.last4)
      idx++
    }
    if (data.coa_code !== undefined) {
      sets.push(`coa_code = $${idx}`)
      params.push(data.coa_code)
      idx++
    }
    if (data.is_active !== undefined) {
      sets.push(`is_active = $${idx}`)
      params.push(data.is_active)
      idx++
    }
    if (data.sort_order !== undefined) {
      sets.push(`sort_order = $${idx}`)
      params.push(data.sort_order)
      idx++
    }
    if (data.settlement_bank_account_id !== undefined) {
      sets.push(`settlement_bank_account_id = $${idx}`)
      params.push(data.settlement_bank_account_id)
      idx++
    }

    sets.push(`updated_by = $${idx}`)
    params.push(userId)
    idx++

    params.push(id, companyId)
    const { rowCount } = await client.query(
      `UPDATE owner_credit_cards SET ${sets.join(', ')}
       WHERE id = $${idx} AND company_id = $${idx + 1}`,
      params,
    )
    if (!rowCount) return null
    return this.findOwnerCreditCardById(companyId, id, client)
  }

  async softDeleteOwnerCreditCard(client: PoolClient, id: string, companyId: string, userId: string) {
    const { rows } = await client.query(
      `UPDATE owner_credit_cards SET is_active = false, updated_at = now(), updated_by = $3 WHERE id = $1 AND company_id = $2 RETURNING *`,
      [id, companyId, userId],
    )
    return rows[0] ?? null
  }

  async listSessions(companyId: string, filter: { platform?: string; status?: string; branch_id?: string; cc_id?: string; date_from?: string; date_to?: string; search?: string }, pagination: { limit: number; offset: number }) {
    const params: unknown[] = [companyId]
    let idx = 2
    const conditions: string[] = ['mcs.company_id = $1', 'mcs.deleted_at IS NULL']

    if (filter.platform) { params.push(filter.platform); conditions.push(`mcs.platform = $${idx}`); idx++ }
    if (filter.status) { params.push(filter.status); conditions.push(`mcs.status = $${idx}`); idx++ }
    if (filter.branch_id) { params.push(filter.branch_id); conditions.push(`EXISTS (SELECT 1 FROM marketplace_checkout_lines l WHERE l.session_id = mcs.id AND l.branch_id = $${idx})`); idx++ }
    if (filter.cc_id) { params.push(filter.cc_id); conditions.push(`mcs.cc_id = $${idx}`); idx++ }
    if (filter.date_from) { params.push(filter.date_from); conditions.push(`mcs.checkout_date >= $${idx}::date`); idx++ }
    if (filter.date_to) { params.push(filter.date_to); conditions.push(`mcs.checkout_date <= $${idx}::date`); idx++ }
    if (filter.search) { params.push(`%${filter.search}%`); conditions.push(`(mcs.session_number ILIKE $${idx} OR mcs.platform_receipt_url ILIKE $${idx})`); idx++ }

    const where = `WHERE ${conditions.join(' AND ')}`

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT mcs.*,
                o.card_label AS cc_label,
                o.settlement_bank_account_id AS cc_settlement_bank_account_id
         FROM marketplace_checkout_sessions mcs
         JOIN owner_credit_cards o ON o.id = mcs.cc_id
         ${where}
         ORDER BY mcs.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM marketplace_checkout_sessions mcs ${where}`,
        params,
      ),
    ])

    return { data: dataRes.rows, total: countRes.rows[0]?.total ?? 0 }
  }
  async reverseSettledSession(
    sessionId: string,
    journalId: string,
    userId: string,
  ): Promise<void> {
    // Cek session memang SETTLED karena journal ini
    const { rows } = await pool.query(
      `SELECT id FROM marketplace_checkout_sessions
       WHERE id = $1 AND journal_settled_id = $2 AND status = 'SETTLED' AND deleted_at IS NULL`,
      [sessionId, journalId],
    )
    if (!rows[0]) return
  
    await pool.query(
      `UPDATE marketplace_checkout_sessions
       SET status = 'RECEIVED',
           journal_settled_id = NULL,
           updated_by = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [userId, sessionId],
    )
  
    await pool.query(
      `DELETE FROM marketplace_settlements WHERE session_id = $1 AND journal_id = $2`,
      [sessionId, journalId],
    )
  }
  
  async reverseBulkSettledSessions(
    bulkId: string,
    companyId: string,
    userId: string,
  ): Promise<string[]> {
    // Cari semua journal dalam grup bulk yang sama
    const { rows: journalRows } = await pool.query(
      `SELECT id FROM journal_headers
       WHERE reference_id = $1
         AND reference_type = 'marketplace_bulk_settlement'
         AND company_id = $2
         AND deleted_at IS NULL`,
      [bulkId, companyId],
    )
    const allJournalIds = journalRows.map((r: any) => r.id as string)
    if (allJournalIds.length === 0) return []
  
    // Cari semua session via marketplace_settlements
    const { rows: settlementRows } = await pool.query(
      `SELECT session_id FROM marketplace_settlements
       WHERE journal_id = ANY($1::uuid[])`,
      [allJournalIds],
    )
    const sessionIds = settlementRows.map((r: any) => r.session_id as string)
    if (sessionIds.length === 0) return allJournalIds
  
    // Balik semua session ke RECEIVED
    await pool.query(
      `UPDATE marketplace_checkout_sessions
       SET status = 'RECEIVED',
           journal_settled_id = NULL,
           updated_by = $1,
           updated_at = NOW()
       WHERE id = ANY($2::uuid[])
         AND status = 'SETTLED'
         AND deleted_at IS NULL`,
      [userId, sessionIds],
    )
  
    // Hapus semua marketplace_settlements
    await pool.query(
      `DELETE FROM marketplace_settlements
       WHERE journal_id = ANY($1::uuid[])`,
      [allJournalIds],
    )
  
    // Return sibling journal ids (untuk di-delete oleh caller)
    return allJournalIds
  }
  async findSessionDetail(id: string, companyId: string) {
    const headerRes = await pool.query(
      `SELECT mcs.*, o.card_label, o.coa_code, o.bank_name, o.last4,
              o.settlement_bank_account_id AS cc_settlement_bank_account_id
       FROM marketplace_checkout_sessions mcs
       JOIN owner_credit_cards o ON o.id = mcs.cc_id
       WHERE mcs.id = $1 AND mcs.company_id = $2 AND mcs.deleted_at IS NULL`,
      [id, companyId],
    )
    if (!headerRes.rows[0]) return null

    const linesRes = await pool.query(
      `SELECT l.*,
              p.product_name, p.product_code,
              b.branch_name
       FROM marketplace_checkout_lines l
       JOIN products p ON p.id = l.product_id
       JOIN branches b ON b.id = l.branch_id
       WHERE l.session_id = $1
       ORDER BY l.created_at ASC`,
      [id],
    )

    const shipmentsRes = await pool.query(
      `SELECT ms.* , b.branch_name
       FROM marketplace_shipments ms
       JOIN branches b ON b.id = ms.branch_id
       WHERE ms.session_id = $1
       ORDER BY ms.created_at ASC`,
      [id],
    )

    const attachmentsRes = await pool.query(
      `SELECT * FROM marketplace_checkout_attachments WHERE session_id = $1 ORDER BY uploaded_at DESC`,
      [id],
    )
    const gpRes = await pool.query(
      `SELECT gp.id, gp.processing_number, gp.status, gp.processing_type
       FROM goods_processing gp
       JOIN goods_receipts gr ON gr.id = gp.goods_receipt_id
       WHERE gr.id = $1
       LIMIT 1`,
      [headerRes.rows[0].goods_receipt_id ?? '00000000-0000-0000-0000-000000000000'],
    )
    
    return {
      header: {
        ...headerRes.rows[0],
        gp_status: gpRes.rows[0]?.status ?? null,
        gp_id: gpRes.rows[0]?.id ?? null,
        gp_number: gpRes.rows[0]?.processing_number ?? null,
      },
      lines: linesRes.rows,
      shipments: shipmentsRes.rows,
      attachments: attachmentsRes.rows,
    }    
  }

  async getSessionForTransition(client: PoolClient, id: string, companyId: string) {
    const { rows } = await client.query(
      `SELECT * FROM marketplace_checkout_sessions WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [id, companyId],
    )
    return rows[0] ?? null
  }
  async cancelOrderedOrShippedSession(
    client: PoolClient,
    id: string,
    companyId: string,
    userId: string,
    allowedStatuses: ('ORDERED' | 'SHIPPED')[],
    data: {
      cancel_reason: string
      platform_cancel_ref?: string | null
    },
  ) {
    const { rows } = await client.query(
      `UPDATE marketplace_checkout_sessions
       SET status = 'CANCELLED',
           cancel_reason = $4,
           platform_cancel_ref = $5,
           journal_ordered_id = NULL,
           updated_by = $3,
           updated_at = now()
       WHERE id = $1
         AND company_id = $2
         AND status = ANY($6::text[])
         AND deleted_at IS NULL
       RETURNING *`,
      [id, companyId, userId, data.cancel_reason, data.platform_cancel_ref ?? null, allowedStatuses],
    )
    return rows[0] ?? null
  }
  
  async createSessionAndLines(client: PoolClient, companyId: string, userId: string, data: { session_number: string; platform: string; cc_id: string; checkout_date: string; notes?: string | null; lines: any[]; total_amount: number }) {
    const { rows } = await client.query(
      `INSERT INTO marketplace_checkout_sessions (company_id, session_number, platform, cc_id, checkout_date, total_amount, notes, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
      [companyId, data.session_number, data.platform, data.cc_id, data.checkout_date, data.total_amount, data.notes ?? null, userId],
    )
    const session = rows[0]

    for (const l of data.lines) {
      await client.query(
        `INSERT INTO marketplace_checkout_lines (session_id, po_id, po_line_id, branch_id, product_id, qty, unit_price_netto, total_netto, platform_order_id, platform_item_id, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [session.id, l.po_id, l.po_line_id, l.branch_id, l.product_id, l.qty, l.unit_price_netto, l.total_netto, l.platform_order_id ?? null, l.platform_item_id ?? null, l.notes ?? null],
      )
    }

    return session
  }

  async updateSessionHeader(client: PoolClient, id: string, companyId: string, userId: string, data: { platform?: string; cc_id?: string; checkout_date?: string; notes?: string | null }) {
    const { rows } = await client.query(
      `UPDATE marketplace_checkout_sessions
       SET platform = COALESCE($2, platform),
           cc_id = COALESCE($3, cc_id),
           checkout_date = COALESCE($4::date, checkout_date),
           notes = COALESCE($5, notes),
           updated_by = $6,
           updated_at = now()
       WHERE id = $1 AND company_id = $7 AND status = 'DRAFT' AND deleted_at IS NULL
       RETURNING *`,
      [id, data.platform ?? null, data.cc_id ?? null, data.checkout_date ?? null, data.notes ?? null, userId, companyId],
    )
    return rows[0] ?? null
  }

  async cancelSession(client: PoolClient, id: string, companyId: string, userId: string) {
    const { rows } = await client.query(
      `UPDATE marketplace_checkout_sessions
       SET status = 'CANCELLED', updated_by = $3, updated_at = now()
       WHERE id = $1 AND company_id = $2 AND status = 'DRAFT' AND deleted_at IS NULL
       RETURNING *`,
      [id, companyId, userId],
    )
    return rows[0] ?? null
  }

  async listSessionAttachments(client: PoolClient | typeof pool, sessionId: string) {
    const { rows } = await (client as any).query(
      `SELECT * FROM marketplace_checkout_attachments WHERE session_id = $1 ORDER BY uploaded_at DESC`,
      [sessionId],
    )
    return rows
  }

  async hasBuktipBayarAttachment(client: PoolClient, sessionId: string) {
    const { rows } = await client.query(
      `SELECT 1
       FROM marketplace_checkout_attachments
       WHERE session_id = $1 AND file_type = 'BUKTI_BAYAR'
       LIMIT 1`,
      [sessionId],
    )
    return rows.length > 0
  }

  async updateOrderData(client: PoolClient, id: string, companyId: string, userId: string, data: { platform_order_ids?: string[] | null; platform_receipt_url?: string | null; journal_ordered_id: string; status: string }) {
    const { rows } = await client.query(
      `UPDATE marketplace_checkout_sessions
       SET status = $2,
           platform_order_ids = COALESCE($3, platform_order_ids),
           platform_receipt_url = COALESCE($4, platform_receipt_url),
           journal_ordered_id = $5,
           updated_by = $6,
           updated_at = now()
       WHERE id = $1 AND company_id = $7 AND deleted_at IS NULL AND status = 'DRAFT'
       RETURNING *`,
      [id, data.status, data.platform_order_ids ?? null, data.platform_receipt_url ?? null, data.journal_ordered_id, userId, companyId],
    )
    return rows[0] ?? null
  }

  async insertAttachment(client: PoolClient, sessionId: string, data: { file_type: string; file_path: string; file_name?: string | null; file_size?: number | null; uploaded_by: string }) {
    const { rows } = await client.query(
      `INSERT INTO marketplace_checkout_attachments (session_id, file_type, file_path, file_name, file_size, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [sessionId, data.file_type, data.file_path, data.file_name ?? null, data.file_size ?? null, data.uploaded_by],
    )
    return rows[0]
  }

  async updateOrInsertShipments(client: PoolClient, sessionId: string, userId: string, shipments: any[]) {
    for (const s of shipments) {
      await client.query(
        `INSERT INTO marketplace_shipments (session_id, branch_id, tracking_number, courier, shipped_at, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6, now(), now())`,
        [sessionId, s.branch_id, s.tracking_number, s.courier ?? null, s.shipped_at ?? null, s.notes ?? null],
      )
    }
  }

  async findSessionLinesForReceive(client: PoolClient, sessionId: string) {
    const { rows } = await client.query(
      `SELECT l.*, p.requires_processing,
              pol.uom, pol.unit_price::numeric AS unit_price_po
       FROM marketplace_checkout_lines l
       JOIN products p ON p.id = l.product_id
       JOIN purchase_order_lines pol ON pol.id = l.po_line_id
       WHERE l.session_id = $1`,
      [sessionId],
    )
    return rows
  }

  async findPendingPoLines(companyId: string, filter: { platform?: string; branch_id?: string }) {
    const params: unknown[] = [companyId]
    let idx = 2
    const conditions = [
      'po.company_id = $1',
      `po.status IN ('ORDERED', 'PARTIAL_RECEIVED')`,
      `(s.supplier_name ILIKE '%shopee%' OR s.supplier_name ILIKE '%tokped%' OR s.supplier_name ILIKE '%tokopedia%')`,
      'pol.qty_received < pol.qty',
      `NOT EXISTS (
        SELECT 1 FROM marketplace_checkout_lines mcl
        JOIN marketplace_checkout_sessions mcs ON mcs.id = mcl.session_id
        WHERE mcl.po_line_id = pol.id
          AND mcs.status NOT IN ('CANCELLED')
      )`,
    ]

    if (filter.platform === 'SHOPEE') {
      conditions.push(`s.supplier_name ILIKE '%shopee%'`)
    } else if (filter.platform === 'TOKOPEDIA') {
      conditions.push(`(s.supplier_name ILIKE '%tokped%' OR s.supplier_name ILIKE '%tokopedia%')`)
    }
    if (filter.branch_id) {
      conditions.push(`po.branch_id = $${idx}`)
      params.push(filter.branch_id)
      idx++
    }

    const { rows } = await pool.query(
      `SELECT pol.id AS po_line_id, pol.po_id, pol.product_id, pol.qty::numeric AS qty,
              pol.qty_received::numeric AS qty_received, pol.uom, pol.unit_price::numeric AS unit_price,
              po.po_number, po.branch_id, b.branch_name,
              s.supplier_name, p.product_name, p.product_code
       FROM purchase_order_lines pol
       JOIN purchase_orders po ON po.id = pol.po_id
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN branches b ON b.id = po.branch_id
       JOIN products p ON p.id = pol.product_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY po.po_number, b.branch_name`,
      params,
    )
    return rows
  }

  async findAttachment(sessionId: string, attachmentId: string) {
    const { rows } = await pool.query(
      `SELECT a.*, mcs.company_id, mcs.status AS session_status
       FROM marketplace_checkout_attachments a
       JOIN marketplace_checkout_sessions mcs ON mcs.id = a.session_id
       WHERE a.id = $1 AND a.session_id = $2`,
      [attachmentId, sessionId],
    )
    return rows[0] ?? null
  }

  async deleteAttachment(attachmentId: string, sessionId: string) {
    const { rowCount } = await pool.query(
      `DELETE FROM marketplace_checkout_attachments WHERE id = $1 AND session_id = $2`,
      [attachmentId, sessionId],
    )
    return (rowCount ?? 0) > 0
  }

  async getSessionStatus(db: PoolClient | typeof pool, sessionId: string, companyId: string) {
    const { rows } = await (db as any).query(
      `SELECT id, status FROM marketplace_checkout_sessions WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [sessionId, companyId],
    )
    return rows[0] ?? null
  }
  async findFullyReceivedPoLines(client: PoolClient, poLineIds: string[]): Promise<string[]> {
    if (poLineIds.length === 0) return []
    const { rows } = await client.query(
      `SELECT id FROM purchase_order_lines
      WHERE id = ANY($1::uuid[])
        AND qty_received >= qty`,
      [poLineIds],
    )
    return rows.map((r: any) => r.id)
  }

  async findExistingMarketplaceGr(
    client: PoolClient,
    poId: string,
    companyId: string,
  ): Promise<{ id: string; gr_number: string } | null> {
    const { rows } = await client.query(
      `SELECT id, gr_number FROM goods_receipts
      WHERE po_id = $1
        AND company_id = $2
        AND source = 'MARKETPLACE'
        AND status = 'CONFIRMED'
        AND deleted_at IS NULL
      LIMIT 1`,
      [poId, companyId],
    )
    return rows[0] ?? null
  }
}
export const marketplacePoRepository = new MarketplacePoRepository()

