import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  ApPaymentDB,
  ApPaymentWithRelations,
  ApPaymentDetail,
  ApPaymentInvoiceLine,
  ApOutstandingInvoice,
  ApPaymentListFilter,
  CreateApPaymentDto,
  UpdateApPaymentDto,
  ApDashboardInvoiceRow,
} from './ap-payments.types'

type PayableInvoiceRow = {
  id: string
  invoice_number: string
  status: string
  total_amount: number
  supplier_id: string
  branch_id: string
}

type ActivePaymentForInvoiceRow = {
  id: string
  payment_number: string
  status: string
}

export class ApPaymentsRepository {
  async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async findBranchCode(client: PoolClient, branchId: string): Promise<string> {
    const { rows } = await client.query<{ branch_code: string }>(
      'SELECT branch_code FROM branches WHERE id = $1',
      [branchId],
    )
    return rows[0]?.branch_code ?? 'XXX'
  }

  async findPayableInvoice(
    client: PoolClient,
    invoiceId: string,
    companyId: string,
  ): Promise<PayableInvoiceRow | null> {
    const { rows } = await client.query<PayableInvoiceRow>(
      `SELECT id, invoice_number, status, total_amount, supplier_id, branch_id
       FROM purchase_invoices
       WHERE id = $1
         AND company_id = $2
         AND deleted_at IS NULL
         AND status IN ('APPROVED', 'POSTED')`,
      [invoiceId, companyId],
    )
    return rows[0] ?? null
  }

  async findActivePaymentForInvoice(
    invoiceId: string,
    client?: PoolClient,
  ): Promise<ActivePaymentForInvoiceRow | null> {
    const db = client ?? pool
    const { rows } = await db.query<ActivePaymentForInvoiceRow>(
      `SELECT p.id, p.payment_number, p.status
       FROM ap_payment_invoice_lines l
       JOIN ap_payments p ON p.id = l.ap_payment_id
       WHERE l.purchase_invoice_id = $1
         AND p.deleted_at IS NULL
         AND p.status NOT IN ('REJECTED')
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [invoiceId],
    )
    return rows[0] ?? null
  }

  async findDefaultCompanyBankAccountId(
    companyId: string,
    client?: PoolClient,
  ): Promise<number | null> {
    const db = client ?? pool
    const { rows } = await db.query<{ id: number }>(
      `SELECT id
       FROM bank_accounts
       WHERE owner_type = 'company'
         AND owner_id = $1
         AND is_active = true
         AND deleted_at IS NULL
       ORDER BY is_primary DESC, id ASC
       LIMIT 1`,
      [companyId],
    )
    return rows[0]?.id ?? null
  }

  async softDeleteDraftPaymentsForInvoice(
    client: PoolClient,
    invoiceId: string,
    userId: string,
  ): Promise<number> {
    const { rowCount } = await client.query(
      `UPDATE ap_payments p
       SET is_deleted = true,
           deleted_at = now(),
           updated_by = $2
       FROM ap_payment_invoice_lines l
       WHERE l.ap_payment_id = p.id
         AND l.purchase_invoice_id = $1
         AND p.status = 'DRAFT'
         AND p.deleted_at IS NULL`,
      [invoiceId, userId],
    )
    return rowCount ?? 0
  }

  // ── Number generation (mirror GR pattern) ──────────────────
  async generateApPaymentNumber(
    client: PoolClient,
    companyId: string,
    branchCode: string,
  ): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `AP-${branchCode}-${dateStr}`

    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${companyId}-${prefix}`,
    ])

    const { rows } = await client.query(
      `SELECT payment_number
       FROM ap_payments
       WHERE company_id = $1
         AND payment_number LIKE $2
       ORDER BY payment_number DESC
       LIMIT 1
       FOR UPDATE`,
      [companyId, `${prefix}-%`],
    )

    const lastSeq =
      rows.length > 0
        ? parseInt(rows[0].payment_number.split('-').pop() || '0', 10)
        : 0

    return `${prefix}-${String(lastSeq + 1).padStart(3, '0')}`
  }

  // ── List ───────────────────────────────────────────────────
  async findAll(filter: ApPaymentListFilter): Promise<{
    data: ApPaymentWithRelations[]
    total: number
  }> {
    const conditions: string[] = [
      'ap.company_id = $1',
      'ap.deleted_at IS NULL',
    ]
    const params: unknown[] = [filter.company_id]
    let idx = 2

    if (filter.branch_id) {
      conditions.push(`ap.branch_id = $${idx++}`)
      params.push(filter.branch_id)
    }
    if (filter.supplier_id) {
      conditions.push(`ap.supplier_id = $${idx++}`)
      params.push(filter.supplier_id)
    }
    if (filter.status) {
      conditions.push(`ap.status = $${idx++}`)
      params.push(filter.status)
    }
    if (filter.payment_method) {
      conditions.push(`ap.payment_method = $${idx++}`)
      params.push(filter.payment_method)
    }
    if (filter.date_from) {
      conditions.push(`ap.created_at::date >= $${idx++}`)
      params.push(filter.date_from)
    }
    if (filter.date_to) {
      conditions.push(`ap.created_at::date <= $${idx++}`)
      params.push(filter.date_to)
    }
    if (filter.search) {
      conditions.push(`ap.payment_number ILIKE $${idx++}`)
      params.push(`%${filter.search}%`)
    }

    const where = conditions.join(' AND ')
    const page = filter.page ?? 1
    const limit = filter.limit ?? 20
    const offset = (page - 1) * limit

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ap_payments ap WHERE ${where}`,
      params,
    )
    const total = parseInt(countResult.rows[0].count, 10)

    const { rows } = await pool.query<ApPaymentWithRelations>(
      `SELECT
         ap.*,
         s.supplier_name,
         b.branch_name,
         b.branch_code,
         ba.account_name         AS bank_account_name,
         ba.account_number       AS bank_account_number,
         COUNT(l.id)::int        AS invoice_count
       FROM ap_payments ap
       JOIN suppliers s      ON s.id = ap.supplier_id
       JOIN branches b       ON b.id = ap.branch_id
       JOIN bank_accounts ba ON ba.id = ap.bank_account_id
       LEFT JOIN ap_payment_invoice_lines l ON l.ap_payment_id = ap.id
       WHERE ${where}
       GROUP BY ap.id, s.supplier_name, b.branch_name, b.branch_code, ba.account_name, ba.account_number
       ORDER BY ap.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    )

    return { data: rows, total }
  }

  // ── Find by ID ─────────────────────────────────────────────
  async findById(id: string, companyId: string): Promise<ApPaymentDetail | null> {
    const { rows } = await pool.query<ApPaymentWithRelations>(
      `SELECT
         ap.*,
         s.supplier_name,
         b.branch_name,
         b.branch_code,
         ba.account_name         AS bank_account_name,
         ba.account_number       AS bank_account_number,
         COUNT(l.id)::int        AS invoice_count
       FROM ap_payments ap
       JOIN suppliers s      ON s.id = ap.supplier_id
       JOIN branches b       ON b.id = ap.branch_id
       JOIN bank_accounts ba ON ba.id = ap.bank_account_id
       LEFT JOIN ap_payment_invoice_lines l ON l.ap_payment_id = ap.id
       WHERE ap.id = $1
         AND ap.company_id = $2
         AND ap.deleted_at IS NULL
       GROUP BY ap.id, s.supplier_name, b.branch_name, b.branch_code, ba.account_name, ba.account_number`,
      [id, companyId],
    )

    if (!rows[0]) return null

    const lines = await this.findLinesByPaymentId(id)
    return { ...rows[0], lines }
  }

  // ── Lines ──────────────────────────────────────────────────
  async findLinesByPaymentId(paymentId: string): Promise<ApPaymentInvoiceLine[]> {
    const { rows } = await pool.query<ApPaymentInvoiceLine>(
      `SELECT
         l.*,
         pi.invoice_number,
         pi.invoice_date,
         pi.status                AS invoice_status,
         pi.total_amount          AS invoice_total_amount,
         s.supplier_name,
         -- Outstanding: total_amount minus semua PAID/RECONCILED payments
         (
           pi.total_amount - COALESCE((
             SELECT SUM(l2.amount_paid)
             FROM ap_payment_invoice_lines l2
             JOIN ap_payments p2 ON p2.id = l2.ap_payment_id
             WHERE l2.purchase_invoice_id = pi.id
               AND p2.status IN ('PAID', 'RECONCILED')
               AND p2.deleted_at IS NULL
           ), 0)
         )                        AS invoice_outstanding
       FROM ap_payment_invoice_lines l
       JOIN purchase_invoices pi ON pi.id = l.purchase_invoice_id
       JOIN suppliers s          ON s.id  = pi.supplier_id
       WHERE l.ap_payment_id = $1
       ORDER BY l.created_at`,
      [paymentId],
    )
    return rows
  }

  // ── Outstanding invoices (untuk selector) ─────────────────
  async findOutstandingInvoices(
    companyId: string,
    supplierId?: string,
    branchId?: string,
    overdueOnly?: boolean,
  ): Promise<ApOutstandingInvoice[]> {
    const conditions: string[] = [
      `pi.company_id = $1`,
      `pi.status IN ('APPROVED', 'POSTED')`,
      `pi.deleted_at IS NULL`,
    ]
    const params: unknown[] = [companyId]
    let idx = 2

    if (supplierId) {
      conditions.push(`pi.supplier_id = $${idx++}`)
      params.push(supplierId)
    }
    if (branchId) {
      conditions.push(`pi.branch_id = $${idx++}`)
      params.push(branchId)
    }

    const where = conditions.join(' AND ')

    const { rows } = await pool.query<ApOutstandingInvoice>(
      `SELECT
         pi.id,
         pi.invoice_number,
         pi.invoice_date,
         pi.due_date,
         pi.supplier_id,
         s.supplier_name,
         pi.branch_id,
         b.branch_name,
         pi.total_amount,
         pi.status                                            AS invoice_status,
         (pi.status = 'POSTED')                               AS can_pay,
         COALESCE(paid.total_paid, 0)                         AS total_paid,
         (pi.total_amount - COALESCE(paid.total_paid, 0))     AS outstanding,
         (pi.due_date IS NOT NULL AND pi.due_date < CURRENT_DATE) AS is_overdue,
         active_ap.id                                         AS ap_payment_id,
         active_ap.payment_number                             AS ap_payment_number
       FROM purchase_invoices pi
       JOIN suppliers s ON s.id = pi.supplier_id
       JOIN branches  b ON b.id = pi.branch_id
       LEFT JOIN (
         SELECT l.purchase_invoice_id, SUM(l.amount_paid) AS total_paid
         FROM ap_payment_invoice_lines l
         JOIN ap_payments p ON p.id = l.ap_payment_id
         WHERE p.status IN ('PAID', 'RECONCILED')
           AND p.deleted_at IS NULL
         GROUP BY l.purchase_invoice_id
       ) paid ON paid.purchase_invoice_id = pi.id
       LEFT JOIN LATERAL (
         SELECT p.id, p.payment_number
         FROM ap_payment_invoice_lines l
         JOIN ap_payments p ON p.id = l.ap_payment_id
         WHERE l.purchase_invoice_id = pi.id
           AND p.deleted_at IS NULL
           AND p.status NOT IN ('REJECTED')
         ORDER BY p.created_at DESC
         LIMIT 1
       ) active_ap ON true
       WHERE ${where}
         AND (pi.total_amount - COALESCE(paid.total_paid, 0)) > 0
         ${overdueOnly ? 'AND pi.due_date IS NOT NULL AND pi.due_date < CURRENT_DATE' : ''}
       ORDER BY pi.status ASC, pi.due_date ASC NULLS LAST, pi.invoice_date ASC`,
      params,
    )
    return rows
  }

  async findDashboardInvoiceRows(
    companyId: string,
    branchId?: string,
  ): Promise<ApDashboardInvoiceRow[]> {
    const conditions: string[] = [
      'pi.company_id = $1',
      "pi.status IN ('APPROVED', 'POSTED')",
      'pi.deleted_at IS NULL',
    ]
    const params: unknown[] = [companyId]
    let idx = 2

    if (branchId) {
      conditions.push(`pi.branch_id = $${idx++}`)
      params.push(branchId)
    }

    const where = conditions.join(' AND ')

    const { rows } = await pool.query<ApDashboardInvoiceRow>(
      `SELECT
         pi.id,
         pi.invoice_number,
         pi.supplier_id,
         s.supplier_name,
         s.supplier_code,
         pi.branch_id,
         b.branch_name,
         pi.status AS invoice_status,
         pi.due_date,
         (pi.total_amount - COALESCE(paid.total_paid, 0))::float AS outstanding,
         (pi.due_date IS NOT NULL AND pi.due_date < CURRENT_DATE) AS is_overdue
       FROM purchase_invoices pi
       JOIN suppliers s ON s.id = pi.supplier_id
       JOIN branches b ON b.id = pi.branch_id
       LEFT JOIN (
         SELECT l.purchase_invoice_id, SUM(l.amount_paid) AS total_paid
         FROM ap_payment_invoice_lines l
         JOIN ap_payments p ON p.id = l.ap_payment_id
         WHERE p.status IN ('PAID', 'RECONCILED')
           AND p.deleted_at IS NULL
         GROUP BY l.purchase_invoice_id
       ) paid ON paid.purchase_invoice_id = pi.id
       WHERE ${where}
         AND (pi.total_amount - COALESCE(paid.total_paid, 0)) > 0.01
       ORDER BY s.supplier_name, pi.due_date ASC NULLS LAST`,
      params,
    )
    return rows
  }

  // ── Sum paid per invoice (untuk validasi outstanding) ─────
  async sumPaidByInvoice(
    invoiceId: string,
    excludePaymentId?: string,
    client?: PoolClient,
  ): Promise<number> {
    const db = client ?? pool
    const params: unknown[] = [invoiceId]
    let excludeClause = ''

    if (excludePaymentId) {
      excludeClause = `AND p.id != $2`
      params.push(excludePaymentId)
    }

    const { rows } = await db.query(
      `SELECT COALESCE(SUM(l.amount_paid), 0) AS total_paid
       FROM ap_payment_invoice_lines l
       JOIN ap_payments p ON p.id = l.ap_payment_id
       WHERE l.purchase_invoice_id = $1
         AND p.status IN ('PAID', 'RECONCILED')
         AND p.deleted_at IS NULL
         ${excludeClause}`,
      params,
    )
    return parseFloat(rows[0].total_paid)
  }

  // ── Create ─────────────────────────────────────────────────
  async create(
    client: PoolClient,
    dto: CreateApPaymentDto & { payment_number: string; company_id: string; created_by: string },
  ): Promise<ApPaymentDB> {
    const { rows } = await client.query<ApPaymentDB>(
      `INSERT INTO ap_payments (
         company_id, branch_id, payment_number, supplier_id,
         bank_account_id, payment_method, total_amount,
         payment_date, notes, status, created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT',$10,$10)
       RETURNING *`,
      [
        dto.company_id,
        dto.branch_id,
        dto.payment_number,
        dto.supplier_id,
        dto.bank_account_id,
        dto.payment_method,
        dto.total_amount,
        dto.payment_date ?? null,
        dto.notes ?? null,
        dto.created_by,
      ],
    )
    return rows[0]
  }

  async createLines(
    client: PoolClient,
    paymentId: string,
    lines: Array<{ purchase_invoice_id: string; amount_paid: number; notes?: string | null }>,
  ): Promise<void> {
    for (const line of lines) {
      await client.query(
        `INSERT INTO ap_payment_invoice_lines
           (ap_payment_id, purchase_invoice_id, amount_paid, notes)
         VALUES ($1, $2, $3, $4)`,
        [paymentId, line.purchase_invoice_id, line.amount_paid, line.notes ?? null],
      )
    }
  }

  // ── Update (DRAFT only) ────────────────────────────────────
  async update(
    client: PoolClient,
    id: string,
    dto: UpdateApPaymentDto & { updated_by: string },
  ): Promise<ApPaymentDB> {
    const sets: string[] = ['updated_by = $2', 'updated_at = now()']
    const params: unknown[] = [id, dto.updated_by]
    let idx = 3

    if (dto.bank_account_id !== undefined) { sets.push(`bank_account_id = $${idx++}`); params.push(dto.bank_account_id) }
    if (dto.payment_method  !== undefined) { sets.push(`payment_method = $${idx++}`);  params.push(dto.payment_method) }
    if (dto.total_amount    !== undefined) { sets.push(`total_amount = $${idx++}`);    params.push(dto.total_amount) }
    if (dto.payment_date    !== undefined) { sets.push(`payment_date = $${idx++}`);    params.push(dto.payment_date) }
    if (dto.notes           !== undefined) { sets.push(`notes = $${idx++}`);           params.push(dto.notes) }

    const { rows } = await client.query<ApPaymentDB>(
      `UPDATE ap_payments SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    )
    return rows[0]
  }

  async replaceLines(
    client: PoolClient,
    paymentId: string,
    lines: Array<{ purchase_invoice_id: string; amount_paid: number; notes?: string | null }>,
  ): Promise<void> {
    await client.query(
      'DELETE FROM ap_payment_invoice_lines WHERE ap_payment_id = $1',
      [paymentId],
    )
    await this.createLines(client, paymentId, lines)
  }

  // ── Status transitions ─────────────────────────────────────
  async updateStatus(
    client: PoolClient,
    id: string,
    status: string,
    extra: Record<string, unknown> = {},
  ): Promise<ApPaymentDB> {
    const sets = ['status = $2', 'updated_at = now()']
    const params: unknown[] = [id, status]
    let idx = 3

    for (const [key, val] of Object.entries(extra)) {
      sets.push(`${key} = $${idx++}`)
      params.push(val)
    }

    const { rows } = await client.query<ApPaymentDB>(
      `UPDATE ap_payments SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    )
    return rows[0]
  }

  // ── Soft delete ────────────────────────────────────────────
  async softDelete(client: PoolClient, id: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE ap_payments
       SET is_deleted = true, deleted_at = now(), updated_by = $2
       WHERE id = $1`,
      [id, userId],
    )
  }

}

export const apPaymentsRepository = new ApPaymentsRepository()
