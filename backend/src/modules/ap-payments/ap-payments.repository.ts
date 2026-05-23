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
  ApDueDatePivotRow,
  OutstandingInvoicesQuery,
  OutstandingInvoiceRow,
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

/** Single branch filter, or scope to user's accessible branches when viewing "all". */
function appendInvoiceBranchScope(
  conditions: string[],
  params: unknown[],
  nextIdx: () => number,
  branchId?: string,
  branchIds?: string[],
): void {
  if (branchId) {
    const i = nextIdx()
    conditions.push(`pi.branch_id = $${i}`)
    params.push(branchId)
    return
  }
  if (branchIds && branchIds.length > 0) {
    const i = nextIdx()
    conditions.push(`pi.branch_id = ANY($${i}::uuid[])`)
    params.push(branchIds)
  }
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

  // ── Reconcile candidates (unreconciled bank statements for matching) ──
  async findReconcileCandidates(
    bankAccountId: number,
    companyId: string,
    paymentAmount: number,
  ): Promise<Array<{ id: number; transaction_date: string; description: string; debit_amount: number; credit_amount: number; reference_number: string | null }>> {
    const { rows } = await pool.query(
      `SELECT
         bs.id,
         bs.transaction_date,
         bs.description,
         bs.debit_amount::float AS debit_amount,
         bs.credit_amount::float AS credit_amount,
         bs.reference_number
       FROM bank_statements bs
       WHERE bs.bank_account_id = $1
         AND bs.company_id = $2
         AND bs.is_reconciled = false
         AND bs.is_pending = false
         AND bs.deleted_at IS NULL
         AND bs.debit_amount > 0
       ORDER BY
         ABS(bs.debit_amount - $3) ASC,
         bs.transaction_date DESC
       LIMIT 20`,
      [bankAccountId, companyId, paymentAmount],
    )
    return rows
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
      conditions.push(`ap.payment_date >= $${idx++}`)
      params.push(filter.date_from)
    }
    if (filter.date_to) {
      conditions.push(`ap.payment_date <= $${idx++}`)
      params.push(filter.date_to)
    }
    if (filter.due_date_from) {
      conditions.push(`EXISTS (
        SELECT 1 FROM ap_payment_invoice_lines apl
        JOIN purchase_invoices pi2 ON pi2.id = apl.purchase_invoice_id
        WHERE apl.ap_payment_id = ap.id AND pi2.due_date >= $${idx++}
      )`)
      params.push(filter.due_date_from)
    }
    if (filter.due_date_to) {
      conditions.push(`EXISTS (
        SELECT 1 FROM ap_payment_invoice_lines apl
        JOIN purchase_invoices pi2 ON pi2.id = apl.purchase_invoice_id
        WHERE apl.ap_payment_id = ap.id AND pi2.due_date <= $${idx++}
      )`)
      params.push(filter.due_date_to)
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
         bk.bank_name            AS bank_name,
         COUNT(l.id)::int        AS invoice_count
       FROM ap_payments ap
       JOIN suppliers s      ON s.id = ap.supplier_id
       JOIN branches b       ON b.id = ap.branch_id
       JOIN bank_accounts ba ON ba.id = ap.bank_account_id
       LEFT JOIN banks bk    ON bk.id = ba.bank_id
       LEFT JOIN ap_payment_invoice_lines l ON l.ap_payment_id = ap.id
       WHERE ${where}
       GROUP BY ap.id, s.supplier_name, b.branch_name, b.branch_code, ba.account_name, ba.account_number, bk.bank_name
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
         COUNT(l.id)::int        AS invoice_count,
         emp_created.full_name   AS created_by_name,
         emp_requested.full_name AS requested_by_name,
         emp_approved.full_name  AS approved_by_name,
         emp_rejected.full_name  AS rejected_by_name,
         emp_paid.full_name      AS paid_by_name
       FROM ap_payments ap
       JOIN suppliers s      ON s.id = ap.supplier_id
       JOIN branches b       ON b.id = ap.branch_id
       JOIN bank_accounts ba ON ba.id = ap.bank_account_id
       LEFT JOIN ap_payment_invoice_lines l ON l.ap_payment_id = ap.id
       LEFT JOIN employees emp_created   ON emp_created.user_id = ap.created_by
       LEFT JOIN employees emp_requested ON emp_requested.user_id = ap.requested_by
       LEFT JOIN employees emp_approved  ON emp_approved.user_id = ap.approved_by
       LEFT JOIN employees emp_rejected  ON emp_rejected.user_id = ap.rejected_by
       LEFT JOIN employees emp_paid      ON emp_paid.user_id = ap.paid_by
       WHERE ap.id = $1
         AND ap.company_id = $2
         AND ap.deleted_at IS NULL
       GROUP BY ap.id, s.supplier_name, b.branch_name, b.branch_code, ba.account_name, ba.account_number,
                emp_created.full_name, emp_requested.full_name, emp_approved.full_name, emp_rejected.full_name, emp_paid.full_name`,
      [id, companyId],
    )

    if (!rows[0]) return null

    const lines = await this.findLinesByPaymentId(id)
    return { ...rows[0], lines } as unknown as ApPaymentDetail
  }

  // ── Lines ──────────────────────────────────────────────────
  async findLinesByPaymentId(paymentId: string): Promise<ApPaymentInvoiceLine[]> {
    const { rows } = await pool.query<ApPaymentInvoiceLine>(
      `SELECT
         l.*,
         pi.invoice_number,
         pi.invoice_date,
         pi.due_date              AS invoice_due_date,
         pi.status                AS invoice_status,
         pi.subtotal::float       AS invoice_subtotal,
         pi.total_tax::float      AS invoice_tax,
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
         )                        AS invoice_outstanding,
         -- GR info (linked GR numbers)
         gr_info.gr_numbers
       FROM ap_payment_invoice_lines l
       JOIN purchase_invoices pi ON pi.id = l.purchase_invoice_id
       JOIN suppliers s          ON s.id  = pi.supplier_id
       LEFT JOIN LATERAL (
         SELECT string_agg(gr.gr_number, ', ' ORDER BY gr.received_date) AS gr_numbers
         FROM purchase_invoice_gr_links pigl
         JOIN goods_receipts gr ON gr.id = pigl.goods_receipt_id
         WHERE pigl.purchase_invoice_id = pi.id
           AND pigl.is_deleted = false
       ) gr_info ON true
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
    branchIds?: string[],
  ): Promise<ApDashboardInvoiceRow[]> {
    const conditions: string[] = [
      'pi.company_id = $1',
      "pi.status IN ('APPROVED', 'POSTED')",
      'pi.deleted_at IS NULL',
    ]
    const params: unknown[] = [companyId]
    let idx = 2

    appendInvoiceBranchScope(conditions, params, () => idx++, branchId, branchIds)

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

  /**
   * Pivot outstanding per due_date + supplier + branch (+ company untuk grouping PT/CV).
   * Rekening supplier dari bank_accounts (owner_type = supplier), bukan kolom di suppliers.
   */
  async findDueDatePivotRows(
    companyId: string,
    branchId?: string,
    branchIds?: string[],
  ): Promise<ApDueDatePivotRow[]> {
    const conditions: string[] = [
      'pi.company_id = $1',
      "pi.status IN ('APPROVED', 'POSTED')",
      'pi.deleted_at IS NULL',
    ]
    const params: unknown[] = [companyId]
    let idx = 2

    appendInvoiceBranchScope(conditions, params, () => idx++, branchId, branchIds)

    const where = conditions.join(' AND ')

    const { rows } = await pool.query<ApDueDatePivotRow>(
      `SELECT
         pi.due_date,
         pi.supplier_id,
         s.supplier_name,
         s.supplier_code,
         pi.branch_id,
         b.branch_name,
         b.branch_code,
         b.company_id,
         c.company_name,
         c.company_type,
         pi.status                                        AS invoice_status,
         (pi.status = 'POSTED')                           AS can_pay,
         SUM(pi.total_amount - COALESCE(paid.total_paid, 0))::float AS outstanding,
         COUNT(pi.id)::int                                AS invoice_count,
         BOOL_OR(pi.due_date IS NOT NULL AND pi.due_date < CURRENT_DATE) AS is_overdue,
         MAX(sup_bank.bank_name)                          AS supplier_bank_name,
         MAX(sup_bank.account_number)                     AS supplier_account_number,
         MAX(sup_bank.account_name)                       AS supplier_account_holder,
         MAX(ap_link.ap_payment_id::text)::uuid          AS ap_payment_id,
         MAX(ap_link.ap_payment_number)                   AS ap_payment_number,
         MAX(ap_link.pay_from_bank_name)                  AS pay_from_bank_name,
         MAX(ap_link.pay_from_account_number)             AS pay_from_account_number,
         MAX(ap_link.pay_from_account_holder)             AS pay_from_account_holder
       FROM purchase_invoices pi
       JOIN suppliers s ON s.id = pi.supplier_id
       JOIN branches b ON b.id = pi.branch_id
       JOIN companies c ON c.id = b.company_id
       LEFT JOIN (
         SELECT l.purchase_invoice_id, SUM(l.amount_paid) AS total_paid
         FROM ap_payment_invoice_lines l
         JOIN ap_payments p ON p.id = l.ap_payment_id
         WHERE p.status IN ('PAID', 'RECONCILED')
           AND p.deleted_at IS NULL
         GROUP BY l.purchase_invoice_id
       ) paid ON paid.purchase_invoice_id = pi.id
       LEFT JOIN LATERAL (
         SELECT ba.account_name, ba.account_number, bk.bank_name
         FROM bank_accounts ba
         LEFT JOIN banks bk ON bk.id = ba.bank_id
         WHERE ba.owner_type = 'supplier'
           AND ba.owner_id = pi.supplier_id::text
           AND ba.is_active = true
           AND ba.deleted_at IS NULL
         ORDER BY ba.is_primary DESC, ba.id ASC
         LIMIT 1
       ) sup_bank ON true
       LEFT JOIN LATERAL (
         SELECT
           p.id AS ap_payment_id,
           p.payment_number AS ap_payment_number,
           bk2.bank_name AS pay_from_bank_name,
           ba2.account_number AS pay_from_account_number,
           ba2.account_name AS pay_from_account_holder
         FROM purchase_invoices pi_ap
         JOIN ap_payment_invoice_lines l ON l.purchase_invoice_id = pi_ap.id
         JOIN ap_payments p ON p.id = l.ap_payment_id
         JOIN bank_accounts ba2 ON ba2.id = p.bank_account_id
         LEFT JOIN banks bk2 ON bk2.id = ba2.bank_id
         WHERE pi_ap.company_id = pi.company_id
           AND pi_ap.supplier_id = pi.supplier_id
           AND pi_ap.branch_id = pi.branch_id
           AND pi_ap.status = pi.status
           AND pi_ap.due_date IS NOT DISTINCT FROM pi.due_date
           AND pi_ap.deleted_at IS NULL
           AND p.deleted_at IS NULL
           AND p.status NOT IN ('REJECTED')
         ORDER BY p.created_at DESC
         LIMIT 1
       ) ap_link ON true
       WHERE ${where}
         AND (pi.total_amount - COALESCE(paid.total_paid, 0)) > 0.01
       GROUP BY
         pi.due_date, pi.supplier_id, s.supplier_name, s.supplier_code,
         pi.branch_id, b.branch_name, b.branch_code, b.company_id,
         c.company_name, c.company_type, pi.status
       ORDER BY pi.due_date ASC NULLS LAST, s.supplier_name ASC, b.branch_name ASC`,
      params,
    )
    return rows
  }

  // ── Assign bank account to outstanding invoice ─────────────
  async assignBankAccount(
    invoiceId: string,
    bankAccountId: number | null,
    companyId: string,
    userId: string,
  ): Promise<void> {
    const now = new Date().toISOString()
    await pool.query(
      `UPDATE purchase_invoices
       SET assigned_bank_account_id = $1,
           assigned_bank_account_by = $2,
           assigned_bank_account_at = $3,
           updated_at = $3,
           updated_by = $2
       WHERE id = $4
         AND company_id = $5
         AND deleted_at IS NULL`,
      [bankAccountId, userId, now, invoiceId, companyId],
    )
  }

  // ── Fetch outstanding invoices by specific IDs (fast PK lookup) ──
  async findOutstandingByIds(
    companyId: string,
    invoiceIds: string[],
  ): Promise<OutstandingInvoiceRow[]> {
    const { rows } = await pool.query(
      `SELECT
         pi.id,
         pi.invoice_number,
         pi.invoice_date,
         pi.supplier_id,
         s.supplier_name,
         pi.branch_id,
         b.branch_name,
         pi.total_amount::float                                   AS total_amount,
         (pi.total_amount - COALESCE(paid.total_paid, 0))::float  AS remaining_amount,
         pi.due_date,
         CASE
           WHEN pi.due_date IS NULL THEN NULL
           ELSE (CURRENT_DATE - pi.due_date)
         END                                                      AS aging_days,
         pi.status                                                AS invoice_status,
         pi.assigned_bank_account_id,
         COALESCE(
           (SELECT json_agg(json_build_object(
             'bank_name', bk.bank_name,
             'account_number', ba.account_number,
             'account_name', ba.account_name
           ))
           FROM bank_accounts ba
           LEFT JOIN banks bk ON bk.id = ba.bank_id
           WHERE ba.owner_type = 'supplier'
             AND ba.owner_id = pi.supplier_id::text
             AND ba.is_active = true
             AND ba.deleted_at IS NULL
           ), '[]'::json
         )                                                        AS supplier_bank_accounts
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
       WHERE pi.company_id = $1
         AND pi.id = ANY($2::uuid[])
         AND pi.deleted_at IS NULL
         AND (pi.total_amount - COALESCE(paid.total_paid, 0)) > 0.01
       ORDER BY pi.due_date ASC NULLS LAST`,
      [companyId, invoiceIds],
    )
    return rows as OutstandingInvoiceRow[]
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

  // ── Outstanding invoices paginated (for bulk payment tab) ──
  async findOutstandingPaginated(
    companyId: string,
    query: OutstandingInvoicesQuery,
    branchIds?: string[],
  ): Promise<{ data: OutstandingInvoiceRow[]; total: number }> {
    const conditions: string[] = [
      'pi.company_id = $1',
      "pi.status IN ('APPROVED', 'POSTED')",
      'pi.deleted_at IS NULL',
    ]
    const params: unknown[] = [companyId]
    let idx = 2

    if (query.supplier_id) {
      conditions.push(`pi.supplier_id = $${idx++}`)
      params.push(query.supplier_id)
    }
    if (query.branch_id) {
      conditions.push(`pi.branch_id = $${idx++}`)
      params.push(query.branch_id)
    } else if (branchIds && branchIds.length > 0) {
      conditions.push(`pi.branch_id = ANY($${idx++}::uuid[])`)
      params.push(branchIds)
    }
    if (query.date_from) {
      conditions.push(`pi.invoice_date >= $${idx++}`)
      params.push(query.date_from)
    }
    if (query.date_to) {
      conditions.push(`pi.invoice_date <= $${idx++}`)
      params.push(query.date_to)
    }
    if (query.search) {
      conditions.push(`(pi.invoice_number ILIKE $${idx} OR s.supplier_name ILIKE $${idx})`)
      params.push(`%${query.search}%`)
      idx++
    }

    const where = conditions.join(' AND ')
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const offset = (page - 1) * limit

    // Count query
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM purchase_invoices pi
       JOIN suppliers s ON s.id = pi.supplier_id
       LEFT JOIN (
         SELECT l.purchase_invoice_id, SUM(l.amount_paid) AS total_paid
         FROM ap_payment_invoice_lines l
         JOIN ap_payments p ON p.id = l.ap_payment_id
         WHERE p.status IN ('PAID', 'RECONCILED')
           AND p.deleted_at IS NULL
         GROUP BY l.purchase_invoice_id
       ) paid ON paid.purchase_invoice_id = pi.id
       WHERE ${where}
         AND (pi.total_amount - COALESCE(paid.total_paid, 0)) > 0
         AND NOT EXISTS (
           SELECT 1 FROM ap_payment_invoice_lines pl
           JOIN ap_payments ap ON ap.id = pl.ap_payment_id
           WHERE pl.purchase_invoice_id = pi.id
             AND ap.status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED')
             AND ap.deleted_at IS NULL
         )`,
      params,
    )
    const total = parseInt(countResult.rows[0].count, 10)

    // Data query
    const { rows } = await pool.query(
      `SELECT
         pi.id,
         pi.invoice_number,
         pi.invoice_date,
         pi.supplier_id,
         s.supplier_name,
         pi.branch_id,
         b.branch_name,
         pi.total_amount::float                                   AS total_amount,
         (pi.total_amount - COALESCE(paid.total_paid, 0))::float  AS remaining_amount,
         pi.due_date,
         CASE
           WHEN pi.due_date IS NULL THEN NULL
           ELSE (CURRENT_DATE - pi.due_date)
         END                                                      AS aging_days,
         pi.status                                                AS invoice_status,
         pi.assigned_bank_account_id,
         gr_dates.earliest_received_date,
         COALESCE(
           (SELECT json_agg(json_build_object(
             'bank_name', bk.bank_name,
             'account_number', ba.account_number,
             'account_name', ba.account_name
           ))
           FROM bank_accounts ba
           LEFT JOIN banks bk ON bk.id = ba.bank_id
           WHERE ba.owner_type = 'supplier'
             AND ba.owner_id = pi.supplier_id::text
             AND ba.is_active = true
             AND ba.deleted_at IS NULL
           ), '[]'::json
         )                                                        AS supplier_bank_accounts
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
       LEFT JOIN LATERAL (
         SELECT MIN(gr.received_date) AS earliest_received_date
         FROM purchase_invoice_gr_links pigl
         JOIN goods_receipts gr ON gr.id = pigl.goods_receipt_id
         WHERE pigl.purchase_invoice_id = pi.id
           AND pigl.is_deleted = false
       ) gr_dates ON true
       WHERE ${where}
         AND (pi.total_amount - COALESCE(paid.total_paid, 0)) > 0
         AND NOT EXISTS (
           SELECT 1 FROM ap_payment_invoice_lines pl
           JOIN ap_payments ap ON ap.id = pl.ap_payment_id
           WHERE pl.purchase_invoice_id = pi.id
             AND ap.status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED')
             AND ap.deleted_at IS NULL
         )
       ORDER BY pi.due_date ASC NULLS LAST
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    )

    return { data: rows as OutstandingInvoiceRow[], total }
  }

  // ── Bulk Payment Methods ─────────────────────────────────────

  /**
   * Insert a new batch record into ap_payment_batches.
   * Returns the created batch row.
   */
  async createBatch(
    client: PoolClient,
    data: {
      created_by: string
      total_payments: number
      total_amount: number
      notes?: string | null
    },
  ): Promise<{ id: string; created_by: string; created_at: string; total_payments: number; total_amount: number; notes: string | null }> {
    const { rows } = await client.query<{
      id: string
      created_by: string
      created_at: string
      total_payments: number
      total_amount: number
      notes: string | null
    }>(
      `INSERT INTO ap_payment_batches (created_by, total_payments, total_amount, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.created_by, data.total_payments, data.total_amount, data.notes ?? null],
    )
    return rows[0]
  }

  /**
   * Insert N ap_payments records linked to a bulk_payment_batch_id,
   * along with their corresponding ap_payment_invoice_lines.
   * Returns the array of created payment records.
   */
  async createBulkPayments(
    client: PoolClient,
    payments: Array<{
      company_id: string
      branch_id: string
      supplier_id: string
      bank_account_id: number
      payment_method: string
      total_amount: number
      payment_number: string
      bulk_payment_batch_id: string
      created_by: string
      notes?: string | null
      status?: string
      paid_at?: string | null
      paid_by?: string | null
      payment_date?: string | null
      proof_url?: string | null
      proof_uploaded_at?: string | null
      proof_uploaded_by?: string | null
      invoice_lines: Array<{
        purchase_invoice_id: string
        amount_paid: number
      }>
    }>,
  ): Promise<ApPaymentDB[]> {
    const results: ApPaymentDB[] = []

    for (const payment of payments) {
      const status = payment.status ?? 'DRAFT'
      const { rows } = await client.query<ApPaymentDB>(
        `INSERT INTO ap_payments (
           company_id, branch_id, payment_number, supplier_id,
           bank_account_id, payment_method, total_amount,
           status, bulk_payment_batch_id, notes, created_by, updated_by,
           paid_at, paid_by, payment_date,
           proof_url, proof_uploaded_at, proof_uploaded_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          payment.company_id,
          payment.branch_id,
          payment.payment_number,
          payment.supplier_id,
          payment.bank_account_id,
          payment.payment_method,
          payment.total_amount,
          status,
          payment.bulk_payment_batch_id,
          payment.notes ?? null,
          payment.created_by,
          payment.paid_at ?? null,
          payment.paid_by ?? null,
          payment.payment_date ?? null,
          payment.proof_url ?? null,
          payment.proof_uploaded_at ?? null,
          payment.proof_uploaded_by ?? null,
        ],
      )

      const createdPayment = rows[0]
      results.push(createdPayment)

      // Insert invoice lines for this payment
      for (const line of payment.invoice_lines) {
        await client.query(
          `INSERT INTO ap_payment_invoice_lines
             (ap_payment_id, purchase_invoice_id, amount_paid)
           VALUES ($1, $2, $3)`,
          [createdPayment.id, line.purchase_invoice_id, line.amount_paid],
        )
      }
    }

    return results
  }

  /**
   * Validate that all invoice IDs exist, are eligible for payment
   * (status IN APPROVED, POSTED), and return their remaining amounts.
   */
  async validateInvoicesForBulk(
    client: PoolClient,
    invoiceIds: string[],
    companyId: string,
  ): Promise<Array<{
    id: string
    invoice_number: string
    status: string
    total_amount: number
    remaining_amount: number
    supplier_id: string
    branch_id: string
  }>> {
    if (invoiceIds.length === 0) return []

    const { rows } = await client.query<{
      id: string
      invoice_number: string
      status: string
      total_amount: number
      remaining_amount: number
      supplier_id: string
      branch_id: string
    }>(
      `SELECT
         pi.id,
         pi.invoice_number,
         pi.status,
         pi.total_amount::float AS total_amount,
         (pi.total_amount - COALESCE(paid.total_paid, 0))::float AS remaining_amount,
         pi.supplier_id,
         pi.branch_id
       FROM purchase_invoices pi
       LEFT JOIN (
         SELECT l.purchase_invoice_id, SUM(l.amount_paid) AS total_paid
         FROM ap_payment_invoice_lines l
         JOIN ap_payments p ON p.id = l.ap_payment_id
         WHERE p.status IN ('PAID', 'RECONCILED')
           AND p.deleted_at IS NULL
         GROUP BY l.purchase_invoice_id
       ) paid ON paid.purchase_invoice_id = pi.id
       WHERE pi.id = ANY($1::uuid[])
         AND pi.company_id = $2
         AND pi.deleted_at IS NULL`,
      [invoiceIds, companyId],
    )

    return rows
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
