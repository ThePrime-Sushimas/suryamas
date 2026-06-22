import { pool } from '../../config/db'
import type { PoolClient, QueryResultRow } from 'pg'
import type {
  Vendor,
  CreateVendorDto,
  UpdateVendorDto,
  VendorListFilter,
  GeneralInvoice,
  GeneralInvoiceDetail,
  GeneralInvoiceLine,
  CreateGeneralInvoiceDto,
  UpdateGeneralInvoiceDto,
  GeneralInvoiceListFilter,
  GeneralInvoicePayment,
  GeneralInvoicePaymentSummary,
  CreateGeneralInvoicePaymentDto,
  GeneralPaymentListFilter,
  GeneralInvoiceTemplate,
  GeneralInvoiceTemplateLine,
  CreateGeneralInvoiceTemplateDto,
  GeneralApDashboard,
  VendorBankAccount,
} from './general-invoices.types'

// ============================================================
// HELPERS
// ============================================================
async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function generateInvoiceNumber(
  client: PoolClient,
  companyId: string,
  branchCode: string,
): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `GINV/${branchCode}/${yy}${mm}/`
  const lockKey = `${companyId}-${prefix}`

  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey])

  // Include soft-deleted rows: UNIQUE(company_id, invoice_number) still reserves the number
  const { rows } = await client.query<{ invoice_number: string }>(
    `SELECT invoice_number
     FROM general_invoices
     WHERE company_id = $1
       AND invoice_number LIKE $2
     ORDER BY invoice_number DESC
     LIMIT 1
     FOR UPDATE`,
    [companyId, `${prefix}%`],
  )

  const lastSeq = rows.length > 0
    ? parseInt(rows[0].invoice_number.split('/').pop() ?? '0', 10)
    : 0
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}

async function generatePaymentNumber(
  client: PoolClient,
  companyId: string,
  branchCode: string,
): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `GPAY/${branchCode}/${yy}${mm}/`
  const lockKey = `${companyId}-${prefix}`

  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey])

  // Include soft-deleted rows: UNIQUE(company_id, payment_number) still reserves the number
  const { rows } = await client.query<{ payment_number: string }>(
    `SELECT payment_number
     FROM general_invoice_payments
     WHERE company_id = $1
       AND payment_number LIKE $2
     ORDER BY payment_number DESC
     LIMIT 1
     FOR UPDATE`,
    [companyId, `${prefix}%`],
  )

  const lastSeq = rows.length > 0
    ? parseInt(rows[0].payment_number.split('/').pop() ?? '0', 10)
    : 0
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}

async function findBranchCode(client: PoolClient, branchId: string): Promise<string> {
  const { rows } = await client.query<{ branch_code: string }>(
    `SELECT branch_code FROM branches WHERE id = $1`,
    [branchId],
  )
  return rows[0]?.branch_code ?? 'GEN'
}

// ============================================================
// VENDOR REPOSITORY
// ============================================================
export const vendorRepository = {
  withTransaction,

  async findAll(filter: VendorListFilter): Promise<{ data: Vendor[]; total: number }> {
    const conditions: string[] = ['v.company_id = ANY($1::uuid[])', 'v.is_deleted = false']
    const params: unknown[] = [filter.company_ids]
    let idx = 2

    if (filter.search) {
      conditions.push(`(v.vendor_name ILIKE $${idx} OR v.vendor_code ILIKE $${idx})`)
      params.push(`%${filter.search}%`)
      idx++
    }
    if (filter.vendor_type) {
      conditions.push(`v.vendor_type = $${idx}`)
      params.push(filter.vendor_type)
      idx++
    }
    if (filter.is_active !== undefined) {
      conditions.push(`v.is_active = $${idx}`)
      params.push(filter.is_active)
      idx++
    }

    const where = conditions.join(' AND ')
    const page = filter.page ?? 1
    const limit = filter.limit ?? 50
    const offset = (page - 1) * limit

    // Sorting — whitelist columns to prevent SQL injection
    const allowedSortColumns: Record<string, string> = {
      vendor_name: 'v.vendor_name',
      vendor_code: 'v.vendor_code',
      created_at: 'v.created_at',
    }
    const sortCol = allowedSortColumns[filter.sort_by ?? ''] ?? 'v.vendor_name'
    const sortDir = filter.sort_order === 'desc' ? 'DESC' : 'ASC'

    const [{ rows: data }, { rows: countRows }] = await Promise.all([
      pool.query<Vendor>(
        `SELECT * FROM vendors v WHERE ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM vendors v WHERE ${where}`,
        params,
      ),
    ])

    return { data, total: parseInt(countRows[0].count, 10) }
  },

  async findById(id: string, companyIds: string[]): Promise<Vendor | null> {
    const { rows } = await pool.query<Vendor>(
      `SELECT * FROM vendors WHERE id = $1 AND company_id = ANY($2::uuid[]) AND is_deleted = false`,
      [id, companyIds],
    )
    return rows[0] ?? null
  },

  async create(client: PoolClient, companyId: string, dto: CreateVendorDto, userId: string): Promise<Vendor> {
    const { rows } = await client.query<Vendor>(
      `INSERT INTO vendors (
        company_id, vendor_code, vendor_name, vendor_type,
        contact_person, phone, email, address,
        bank_name, bank_account_number, bank_account_name,
        notes, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
      RETURNING *`,
      [
        companyId, dto.vendor_code, dto.vendor_name, dto.vendor_type ?? null,
        dto.contact_person ?? null, dto.phone ?? null, dto.email ?? null, dto.address ?? null,
        dto.bank_name ?? null, dto.bank_account_number ?? null, dto.bank_account_name ?? null,
        dto.notes ?? null, userId,
      ],
    )
    return rows[0]
  },

  async update(client: PoolClient, id: string, companyId: string, dto: UpdateVendorDto, userId: string): Promise<Vendor> {
    const fields: string[] = []
    const params: unknown[] = []
    let idx = 1

    const allowed: Array<keyof UpdateVendorDto> = [
      'vendor_code', 'vendor_name', 'vendor_type', 'contact_person', 'phone', 'email',
      'address', 'bank_name', 'bank_account_number', 'bank_account_name',
      'notes', 'is_active',
    ]
    for (const key of allowed) {
      if (dto[key] !== undefined) {
        fields.push(`${key} = $${idx}`)
        params.push(dto[key])
        idx++
      }
    }

    fields.push(`updated_by = $${idx}`)
    params.push(userId)
    idx++
    params.push(id, companyId)

    const { rows } = await client.query<Vendor>(
      `UPDATE vendors SET ${fields.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} RETURNING *`,
      params,
    )
    return rows[0]
  },

  async softDelete(client: PoolClient, id: string, companyId: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE vendors SET is_deleted = true, deleted_at = now(), deleted_by = $1
       WHERE id = $2 AND company_id = $3`,
      [userId, id, companyId],
    )
  },
}

// ============================================================
// HELPER FUNCTION: Build Dashboard WHERE Clause
// ============================================================
function buildDashboardWhereClause(
  branchIds: string[],
  includeConfidential = false,
): { where: string; params: unknown[] } {
  const conditions: string[] = ['gi.branch_id = ANY($1::uuid[])', 'gi.is_deleted = false']
  const params: unknown[] = [branchIds]

  if (!includeConfidential) {
    conditions.push('gi.is_confidential = false')
  }

  return {
    where: conditions.join(' AND '),
    params,
  }
}

// ============================================================
// GENERAL INVOICE REPOSITORY
// ============================================================
export const generalInvoiceRepository = {
  withTransaction,
  generateInvoiceNumber,
  findBranchCode,

  async findAll(filter: GeneralInvoiceListFilter): Promise<{ data: GeneralInvoice[]; total: number }> {
    const scopedBranches = filter.branch_id
      ? filter.branch_ids.filter((id) => id === filter.branch_id)
      : filter.branch_ids
    const conditions: string[] = ['gi.branch_id = ANY($1::uuid[])', 'gi.is_deleted = false']
    const params: unknown[] = [scopedBranches]
    let idx = 2

    if (!filter.include_confidential) {
      conditions.push(`gi.is_confidential = false`)
    }

    if (filter.status) {
      conditions.push(`gi.status = $${idx}`)
      params.push(filter.status)
      idx++
    }
    if (filter.vendor_id) {
      conditions.push(`gi.vendor_id = $${idx}`)
      params.push(filter.vendor_id)
      idx++
    }
    if (filter.due_date_from) {
      conditions.push(`gi.due_date >= $${idx}`)
      params.push(filter.due_date_from)
      idx++
    }
    if (filter.due_date_to) {
      conditions.push(`gi.due_date <= $${idx}`)
      params.push(filter.due_date_to)
      idx++
    }
    if (filter.invoice_date_from) {
      conditions.push(`gi.invoice_date >= $${idx}`)
      params.push(filter.invoice_date_from)
      idx++
    }
    if (filter.invoice_date_to) {
      conditions.push(`gi.invoice_date <= $${idx}`)
      params.push(filter.invoice_date_to)
      idx++
    }
    if (filter.search) {
      conditions.push(`(gi.invoice_number ILIKE $${idx} OR v.vendor_name ILIKE $${idx})`)
      params.push(`%${filter.search}%`)
      idx++
    }
    if (filter.overdue) {
      conditions.push(`gi.status = 'POSTED'`)
      conditions.push(`gi.due_date IS NOT NULL AND gi.due_date < CURRENT_DATE`)
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM general_invoice_payments gip
        WHERE gip.general_invoice_id = gi.id
          AND gip.is_deleted = false
          AND gip.status IN ('PAID', 'RECONCILED')
      )`)
    }

    const where = conditions.join(' AND ')
    const page = filter.page ?? 1
    const limit = filter.limit ?? 20
    const offset = (page - 1) * limit

    const sql = `
      SELECT
        gi.*,
        v.vendor_name,
        v.vendor_type,
        b.branch_name,
        jh.journal_number,
        pay.id AS pay_id,
        pay.payment_number AS pay_payment_number,
        pay.status AS pay_status,
        pay.total_amount AS pay_total_amount,
        pay.payment_date AS pay_payment_date,
        pay.paid_at AS pay_paid_at
      FROM general_invoices gi
      JOIN vendors v ON v.id = gi.vendor_id
      JOIN branches b ON b.id = gi.branch_id
      LEFT JOIN journal_headers jh ON jh.id = gi.journal_id
      LEFT JOIN LATERAL (
        SELECT gip.id, gip.payment_number, gip.status, gip.total_amount, gip.payment_date, gip.paid_at
        FROM general_invoice_payments gip
        WHERE gip.general_invoice_id = gi.id
          AND gip.is_deleted = false
          AND gip.status <> 'REJECTED'
        ORDER BY gip.created_at DESC
        LIMIT 1
      ) pay ON true
      WHERE ${where}
      ORDER BY gi.invoice_date DESC, gi.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `

    const countSql = `
      SELECT COUNT(*) FROM general_invoices gi
      JOIN vendors v ON v.id = gi.vendor_id
      WHERE ${where}
    `

    const [{ rows: rawRows }, { rows: countRows }] = await Promise.all([
      pool.query(sql, [...params, limit, offset]),
      pool.query<{ count: string }>(countSql, params),
    ])

    type InvoiceListRow = GeneralInvoice & {
      pay_id: string | null
      pay_payment_number: string | null
      pay_status: GeneralInvoicePaymentSummary['status'] | null
      pay_total_amount: string | null
      pay_payment_date: string | null
      pay_paid_at: string | null
    }

    const data = (rawRows as InvoiceListRow[]).map((row) => {
      const {
        pay_id,
        pay_payment_number,
        pay_status,
        pay_total_amount,
        pay_payment_date,
        pay_paid_at,
        ...invoice
      } = row

      const active_payment: GeneralInvoicePaymentSummary | null = pay_id
        ? {
            id: pay_id,
            payment_number: pay_payment_number!,
            status: pay_status!,
            total_amount: Number(pay_total_amount),
            payment_date: pay_payment_date,
            paid_at: pay_paid_at,
          }
        : null

      return { ...invoice, active_payment }
    })

    return { data, total: parseInt(countRows[0].count, 10) }
  },

  async findByIdAccessible(id: string, branchIds: string[]): Promise<GeneralInvoiceDetail | null> {
    const { rows } = await pool.query<{ company_id: string }>(
      `SELECT company_id FROM general_invoices WHERE id = $1 AND branch_id = ANY($2::uuid[]) AND is_deleted = false`,
      [id, branchIds],
    )
    if (!rows[0]) return null
    return this.findById(id, rows[0].company_id)
  },

  async findById(id: string, companyId: string): Promise<GeneralInvoiceDetail | null> {
    const { rows } = await pool.query<GeneralInvoice>(
      `SELECT gi.*, v.vendor_name, v.vendor_type, jh.journal_number
       FROM general_invoices gi
       JOIN vendors v ON v.id = gi.vendor_id
       LEFT JOIN journal_headers jh ON jh.id = gi.journal_id
       WHERE gi.id = $1 AND gi.company_id = $2 AND gi.is_deleted = false`,
      [id, companyId],
    )
    if (!rows[0]) return null

    const { rows: lines } = await pool.query<GeneralInvoiceLine>(
      `SELECT gil.*,
              coa.account_code, coa.account_name,
              coa_exp.account_code AS expense_account_code,
              coa_exp.account_name AS expense_account_name,
              coa_tax.account_code AS tax_account_code,
              coa_tax.account_name AS tax_account_name
       FROM general_invoice_lines gil
       JOIN chart_of_accounts coa ON coa.id = gil.account_id
       LEFT JOIN chart_of_accounts coa_exp ON coa_exp.id = gil.expense_account_id
       LEFT JOIN chart_of_accounts coa_tax ON coa_tax.id = gil.tax_account_id
       WHERE gil.general_invoice_id = $1
       ORDER BY gil.line_number ASC`,
      [id],
    )

    const { rows: payRows } = await pool.query(
      `SELECT id, payment_number, status, total_amount, payment_date, paid_at
       FROM general_invoice_payments
       WHERE general_invoice_id = $1 AND is_deleted = false
       LIMIT 1`,
      [id],
    )

    return {
      ...rows[0],
      lines,
      payment: payRows[0] ?? null,
    }
  },

  async create(
    client: PoolClient,
    companyId: string,
    branchId: string,
    dto: CreateGeneralInvoiceDto,
    invoiceNumber: string,
    userId: string,
  ): Promise<{ id: string }> {
    const subtotal = dto.lines.reduce((s, l) => s + l.amount, 0)
    const totalTax = dto.lines.reduce((s, l) => s + (l.tax_amount ?? 0), 0)
    const totalAmount = subtotal + totalTax

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO general_invoices (
        company_id, branch_id, invoice_number, vendor_id,
        invoice_date, due_date, period_start, period_end,
        is_confidential,
        subtotal, total_tax, total_amount,
        notes, attachment_url, template_id,
        created_by, updated_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16
      ) RETURNING id`,
      [
        companyId, branchId, invoiceNumber, dto.vendor_id,
        dto.invoice_date, dto.due_date ?? null,
        dto.period_start ?? null, dto.period_end ?? null,
        dto.is_confidential ?? false,
        subtotal, totalTax, totalAmount,
        dto.notes ?? null, dto.attachment_url ?? null, dto.template_id ?? null,
        userId,
      ],
    )
    return rows[0]
  },

  async createLines(
    client: PoolClient,
    invoiceId: string,
    lines: Array<{
      line_number: number
      account_id: string
      description?: string
      amount: number
      tax_amount?: number
      tax_account_id?: string | null
      transaction_type?: string
      expense_account_id?: string
      total_periods?: number
      amortization_start_date?: string
    }>,
  ): Promise<void> {
    for (const line of lines) {
      const taxAmt = line.tax_amount ?? 0
      await client.query(
        `INSERT INTO general_invoice_lines
          (general_invoice_id, line_number, account_id, description, amount, tax_amount, tax_account_id, total_amount,
           transaction_type, expense_account_id, total_periods, amortization_start_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          invoiceId, line.line_number, line.account_id, line.description ?? null,
          line.amount, taxAmt, line.tax_account_id ?? null, line.amount + taxAmt,
          line.transaction_type ?? 'EXPENSE',
          line.expense_account_id ?? null,
          line.total_periods ?? null,
          line.amortization_start_date ?? null,
        ],
      )
    }
  },

  async replaceLines(
    client: PoolClient,
    invoiceId: string,
    lines: Array<{
      line_number: number
      account_id: string
      description?: string
      amount: number
      tax_amount?: number
      tax_account_id?: string | null
      transaction_type?: string
      expense_account_id?: string
      total_periods?: number
      amortization_start_date?: string
    }>,
  ): Promise<void> {
    await client.query(`DELETE FROM general_invoice_lines WHERE general_invoice_id = $1`, [invoiceId])
    await generalInvoiceRepository.createLines(client, invoiceId, lines)
  },

  async update(
    client: PoolClient,
    id: string,
    companyId: string,
    dto: UpdateGeneralInvoiceDto,
    userId: string,
  ): Promise<void> {
    const fields: string[] = []
    const params: unknown[] = []
    let idx = 1

    const allowed: Array<keyof UpdateGeneralInvoiceDto> = [
      'vendor_id', 'invoice_number', 'invoice_date', 'due_date',
      'period_start', 'period_end', 'is_confidential',
      'notes', 'attachment_url',
    ]
    for (const key of allowed) {
      if (dto[key] !== undefined) {
        fields.push(`${key} = $${idx}`)
        params.push(dto[key])
        idx++
      }
    }

    // Recalculate totals if lines are being updated
    if (dto.lines) {
      const subtotal = dto.lines.reduce((s, l) => s + l.amount, 0)
      const totalTax = dto.lines.reduce((s, l) => s + (l.tax_amount ?? 0), 0)
      fields.push(`subtotal = $${idx}`, `total_tax = $${idx + 1}`, `total_amount = $${idx + 2}`)
      params.push(subtotal, totalTax, subtotal + totalTax)
      idx += 3
    }

    fields.push(`updated_by = $${idx}`)
    params.push(userId)
    idx++
    params.push(id, companyId)

    await client.query(
      `UPDATE general_invoices SET ${fields.join(', ')}
       WHERE id = $${idx} AND company_id = $${idx + 1}`,
      params,
    )
  },

  async updateStatus(
    client: PoolClient,
    id: string,
    status: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const fields = ['status = $1']
    const params: unknown[] = [status]
    let idx = 2

    for (const [key, val] of Object.entries(extra)) {
      fields.push(`${key} = $${idx}`)
      params.push(val)
      idx++
    }

    params.push(id)
    await client.query(
      `UPDATE general_invoices SET ${fields.join(', ')} WHERE id = $${idx}`,
      params,
    )
  },

  async softDelete(client: PoolClient, id: string, companyId: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE general_invoices SET is_deleted = true, deleted_at = now(), deleted_by = $1
       WHERE id = $2 AND company_id = $3`,
      [userId, id, companyId],
    )
  },

  /**
   * Hard delete invoice beserta semua data terkait (lines, amortizations, entries).
   * Payment dan journal harus sudah di-handle sebelum panggil ini.
   */
  async hardDelete(client: PoolClient, id: string): Promise<void> {
    // 1. Delete amortization entries
    await client.query(
      `DELETE FROM general_invoice_amortization_entries
       WHERE amortization_id IN (
         SELECT id FROM general_invoice_amortizations WHERE invoice_id = $1
       )`,
      [id],
    )
    // 2. Delete amortization headers
    await client.query(
      `DELETE FROM general_invoice_amortizations WHERE invoice_id = $1`,
      [id],
    )
    // 3. Delete invoice lines
    await client.query(
      `DELETE FROM general_invoice_lines WHERE general_invoice_id = $1`,
      [id],
    )
    // 4. Delete invoice header
    await client.query(
      `DELETE FROM general_invoices WHERE id = $1`,
      [id],
    )
  },

  /** Find journal_id for a given invoice — used for cascade hard delete from journal page. */
  async findJournalIdByInvoiceId(invoiceId: string): Promise<string | null> {
    const { rows } = await pool.query<{ journal_id: string | null }>(
      `SELECT journal_id FROM general_invoices WHERE id = $1`,
      [invoiceId],
    )
    return rows[0]?.journal_id ?? null
  },

  /** Setelah jurnal posting di-hard-delete dari halaman Journal → invoice kembali DRAFT. */
  async revertPostedAfterJournalDelete(invoiceId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE general_invoices SET
         status = 'DRAFT',
         journal_id = NULL,
         posted_by = NULL,
         posted_at = NULL,
         updated_by = $2,
         updated_at = now()
       WHERE id = $1
         AND status = 'POSTED'
         AND is_deleted = false`,
      [invoiceId, userId],
    )
  },

  async updateAttachment(
    client: PoolClient,
    id: string,
    companyId: string,
    attachmentPath: string,
    userId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE general_invoices
       SET attachment_url = $1, updated_by = $2, updated_at = now()
       WHERE id = $3 AND company_id = $4 AND is_deleted = false`,
      [attachmentPath, userId, id, companyId],
    )
  },

  // ----------------------------------------------------------
  // COA untuk liability account (Hutang Usaha Umum)
  // Diambil dari accounting_purposes dengan key 'GEN-AP-LIABILITY'
  // ----------------------------------------------------------
  async findLiabilityAccountId(companyId: string): Promise<string | null> {
    const { rows } = await pool.query<{ account_id: string }>(
      `SELECT apa.account_id
       FROM accounting_purposes ap
       JOIN accounting_purpose_accounts apa ON apa.purpose_id = ap.id
       JOIN chart_of_accounts coa ON coa.id = apa.account_id
       WHERE ap.company_id = $1
         AND ap.purpose_code = 'GEN-AP-LIABILITY'
         AND (ap.is_deleted IS NULL OR ap.is_deleted = false)
         AND apa.is_active = true
         AND apa.deleted_at IS NULL
         AND coa.deleted_at IS NULL
       ORDER BY apa.priority ASC
       LIMIT 1`,
      [companyId],
    )
    return rows[0]?.account_id ?? null
  },

  // ----------------------------------------------------------
  // Dashboard
  // ----------------------------------------------------------
  async getDashboard(branchIds: string[], includeConfidential = false): Promise<GeneralApDashboard> {
    const today = new Date().toISOString().slice(0, 10)
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    const { where, params } = buildDashboardWhereClause(branchIds, includeConfidential)

    // Append date params first, then calculate final placeholder indexes based on actual params length
    // This prevents pg from seeing mismatched placeholder counts.
    params.push(today)
    params.push(weekEnd)

    const todayIdx = params.length - 1
    const weekEndIdx = params.length

    // Summary query with properly parameterized dates
    const { rows: summaryRows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE gi.status = 'DRAFT') AS draft_count,
         COUNT(*) FILTER (WHERE gi.status = 'POSTED') AS posted_count,
         COALESCE(SUM(gi.total_amount) FILTER (
           WHERE gi.status = 'POSTED'
             AND NOT EXISTS (
               SELECT 1 FROM general_invoice_payments gip
               WHERE gip.general_invoice_id = gi.id
                 AND gip.status = 'PAID'
                 AND gip.is_deleted = false
             )
         ), 0) AS total_unpaid,
         COUNT(*) FILTER (
           WHERE gi.status = 'POSTED'
             AND NOT EXISTS (
               SELECT 1 FROM general_invoice_payments gip
               WHERE gip.general_invoice_id = gi.id
                 AND gip.status = 'PAID'
                 AND gip.is_deleted = false
             )
         ) AS total_unpaid_count,
         COALESCE(SUM(gi.total_amount) FILTER (
           WHERE gi.status = 'POSTED'
             AND gi.due_date < $${todayIdx}
             AND NOT EXISTS (
               SELECT 1 FROM general_invoice_payments gip
               WHERE gip.general_invoice_id = gi.id
                 AND gip.status = 'PAID'
                 AND gip.is_deleted = false
             )
         ), 0) AS overdue_amount,
         COUNT(*) FILTER (
           WHERE gi.status = 'POSTED'
             AND gi.due_date < $${todayIdx}
             AND NOT EXISTS (
               SELECT 1 FROM general_invoice_payments gip
               WHERE gip.general_invoice_id = gi.id
                 AND gip.status = 'PAID'
                 AND gip.is_deleted = false
             )
         ) AS overdue_count,
         COALESCE(SUM(gi.total_amount) FILTER (
           WHERE gi.status = 'POSTED'
             AND gi.due_date BETWEEN $${todayIdx} AND $${weekEndIdx}
             AND NOT EXISTS (
               SELECT 1 FROM general_invoice_payments gip
               WHERE gip.general_invoice_id = gi.id
                 AND gip.status = 'PAID'
                 AND gip.is_deleted = false
             )
         ), 0) AS due_this_week,
         COUNT(*) FILTER (
           WHERE gi.status = 'POSTED'
             AND gi.due_date BETWEEN $${todayIdx} AND $${weekEndIdx}
             AND NOT EXISTS (
               SELECT 1 FROM general_invoice_payments gip
               WHERE gip.general_invoice_id = gi.id
                 AND gip.status = 'PAID'
                 AND gip.is_deleted = false
             )
         ) AS due_this_week_count
       FROM general_invoices gi
       WHERE ${where}`,
      params,
    )

    // Count pending amortizations (use branchIds directly, not positional assumption)
    const confidentialFilter = includeConfidential ? '' : 'AND gi.is_confidential = false'
    const { rows: amortRows } = await pool.query<{ pending_count: string }>(
      `SELECT COUNT(*) AS pending_count
       FROM general_invoice_amortization_entries ae
       JOIN general_invoice_amortizations a ON a.id = ae.amortization_id
       JOIN general_invoices gi ON gi.id = a.invoice_id
       WHERE a.status = 'ACTIVE'
         AND ae.journal_id IS NULL
         AND ae.period_date <= CURRENT_DATE
         AND gi.branch_id = ANY($1::uuid[])
         AND gi.is_deleted = false
         ${confidentialFilter}`,
      [branchIds],
    )

    const s = summaryRows[0]
    return {
      summary: {
        total_unpaid: Number(s.total_unpaid),
        total_unpaid_count: Number(s.total_unpaid_count),
        overdue_amount: Number(s.overdue_amount),
        overdue_count: Number(s.overdue_count),
        due_this_week: Number(s.due_this_week),
        due_this_week_count: Number(s.due_this_week_count),
        draft_count: Number(s.draft_count),
        posted_count: Number(s.posted_count),
      },
      pending_amortizations: Number(amortRows[0]?.pending_count ?? 0),
    }
  },
}

// ============================================================
// GENERAL INVOICE PAYMENT REPOSITORY
// ============================================================
export const generalPaymentRepository = {
  withTransaction,
  generatePaymentNumber,
  findBranchCode,

  async findAll(filter: GeneralPaymentListFilter): Promise<{ data: GeneralInvoicePayment[]; total: number }> {
    const scopedBranches = filter.branch_id
      ? filter.branch_ids.filter((id) => id === filter.branch_id)
      : filter.branch_ids
    const conditions: string[] = ['gip.branch_id = ANY($1::uuid[])', 'gip.is_deleted = false']
    const params: unknown[] = [scopedBranches]
    let idx = 2

    if (!filter.include_confidential) {
      conditions.push(`gi.is_confidential = false`)
    }
    if (filter.status) {
      conditions.push(`gip.status = $${idx}`)
      params.push(filter.status)
      idx++
    }
    if (filter.vendor_id) {
      conditions.push(`gi.vendor_id = $${idx}`)
      params.push(filter.vendor_id)
      idx++
    }
    if (filter.search) {
      conditions.push(`(gip.payment_number ILIKE $${idx} OR gi.invoice_number ILIKE $${idx} OR v.vendor_name ILIKE $${idx})`)
      params.push(`%${filter.search}%`)
      idx++
    }
    if (filter.payment_date_from) {
      conditions.push(`gip.payment_date >= $${idx}`)
      params.push(filter.payment_date_from)
      idx++
    }
    if (filter.payment_date_to) {
      conditions.push(`gip.payment_date <= $${idx}`)
      params.push(filter.payment_date_to)
      idx++
    }

    const where = conditions.join(' AND ')
    const page = filter.page ?? 1
    const isPaged = filter.limit !== -1
    const limit = filter.limit ?? 20
    const offset = isPaged ? (page - 1) * limit : 0

    const sql = `
      SELECT gip.*, gi.invoice_number, gi.status AS invoice_status,
             gi.total_amount AS invoice_total_amount,
             gi.due_date AS invoice_due_date,
             v.vendor_name,
             v.bank_name AS vendor_bank_name,
             v.bank_account_number AS vendor_bank_account_number,
             v.bank_account_name AS vendor_bank_account_name,
             b.branch_name,
             ba.account_name AS bank_account_name,
             ba.account_number AS bank_account_number,
             bk.bank_name AS bank_name,
             jh.journal_number
      FROM general_invoice_payments gip
      JOIN general_invoices gi ON gi.id = gip.general_invoice_id
      JOIN vendors v ON v.id = gi.vendor_id
      JOIN branches b ON b.id = gip.branch_id
      LEFT JOIN bank_accounts ba ON ba.id = gip.bank_account_id
      LEFT JOIN banks bk ON bk.id = ba.bank_id
      LEFT JOIN journal_headers jh ON jh.id = gip.journal_id
      WHERE ${where}
      ORDER BY gip.created_at DESC
      ${isPaged ? `LIMIT $${idx} OFFSET $${idx + 1}` : ''}
    `

    const countSql = `
      SELECT COUNT(*) FROM general_invoice_payments gip
      JOIN general_invoices gi ON gi.id = gip.general_invoice_id
      JOIN vendors v ON v.id = gi.vendor_id
      WHERE ${where}
    `

    const sqlParams = isPaged ? [...params, limit, offset] : params
    const [{ rows: data }, { rows: countRows }] = await Promise.all([
      pool.query<GeneralInvoicePayment & QueryResultRow>(sql, sqlParams),
      pool.query<{ count: string }>(countSql, params),
    ])

    return { data, total: parseInt(countRows[0].count, 10) }
  },

  async findByIdAccessible(id: string, branchIds: string[]): Promise<GeneralInvoicePayment | null> {
    const { rows } = await pool.query<{ company_id: string }>(
      `SELECT company_id FROM general_invoice_payments WHERE id = $1 AND branch_id = ANY($2::uuid[]) AND is_deleted = false`,
      [id, branchIds],
    )
    if (!rows[0]) return null
    return this.findById(id, rows[0].company_id)
  },

  async findById(id: string, companyId: string): Promise<GeneralInvoicePayment | null> {
    const { rows } = await pool.query<GeneralInvoicePayment & QueryResultRow>(
      `SELECT gip.*, gi.invoice_number, gi.status AS invoice_status,
              gi.total_amount AS invoice_total_amount,
              gi.due_date AS invoice_due_date,
              v.vendor_name,
              ba.account_name AS bank_account_name,
              ba.account_number AS bank_account_number,
              bk.bank_name AS bank_name,
              jh.journal_number,
              occ.card_label AS owner_credit_card_label,
              occ.coa_code AS owner_credit_card_coa_code
       FROM general_invoice_payments gip
       JOIN general_invoices gi ON gi.id = gip.general_invoice_id
       JOIN vendors v ON v.id = gi.vendor_id
       LEFT JOIN bank_accounts ba ON ba.id = gip.bank_account_id
       LEFT JOIN banks bk ON bk.id = ba.bank_id
       LEFT JOIN journal_headers jh ON jh.id = gip.journal_id
       LEFT JOIN owner_credit_cards occ ON occ.id = gip.owner_credit_card_id
       WHERE gip.id = $1 AND gip.company_id = $2 AND gip.is_deleted = false`,
      [id, companyId],
    )
    return rows[0] ?? null
  },

  async findByInvoiceId(invoiceId: string): Promise<GeneralInvoicePayment | null> {
    const { rows } = await pool.query<GeneralInvoicePayment & QueryResultRow>(
      `SELECT gip.*, gi.invoice_number, gi.status AS invoice_status,
              gi.total_amount AS invoice_total_amount,
              gi.due_date AS invoice_due_date,
              v.vendor_name,
              ba.account_name AS bank_account_name,
              ba.account_number AS bank_account_number,
              bk.bank_name AS bank_name,
              jh.journal_number,
              occ.card_label AS owner_credit_card_label,
              occ.coa_code AS owner_credit_card_coa_code
       FROM general_invoice_payments gip
       JOIN general_invoices gi ON gi.id = gip.general_invoice_id
       JOIN vendors v ON v.id = gi.vendor_id
       LEFT JOIN bank_accounts ba ON ba.id = gip.bank_account_id
       LEFT JOIN banks bk ON bk.id = ba.bank_id
       LEFT JOIN journal_headers jh ON jh.id = gip.journal_id
       LEFT JOIN owner_credit_cards occ ON occ.id = gip.owner_credit_card_id
       WHERE gip.general_invoice_id = $1 AND gip.is_deleted = false
       LIMIT 1`,
      [invoiceId],
    )
    return rows[0] ?? null
  },

  async create(
    client: PoolClient,
    companyId: string,
    branchId: string,
    dto: CreateGeneralInvoicePaymentDto,
    paymentNumber: string,
    userId: string,
  ): Promise<{ id: string }> {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO general_invoice_payments (
        company_id, branch_id, payment_number, general_invoice_id,
        bank_account_id, owner_credit_card_id, payment_method, total_amount,
        payment_date, notes, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
      RETURNING id`,
      [
        companyId, branchId, paymentNumber, dto.general_invoice_id,
        dto.bank_account_id ?? null, dto.owner_credit_card_id ?? null,
        dto.payment_method ?? 'TRANSFER', dto.total_amount,
        dto.payment_date ?? null, dto.notes ?? null, userId,
      ],
    )
    return rows[0]
  },

  async updateStatus(
    client: PoolClient,
    id: string,
    status: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const fields = ['status = $1']
    const params: unknown[] = [status]
    let idx = 2

    for (const [key, val] of Object.entries(extra)) {
      fields.push(`${key} = $${idx}`)
      params.push(val)
      idx++
    }

    params.push(id)
    await client.query(
      `UPDATE general_invoice_payments SET ${fields.join(', ')} WHERE id = $${idx}`,
      params,
    )
  },

  async softDelete(client: PoolClient, id: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE general_invoice_payments
       SET is_deleted = true, deleted_at = now(), updated_by = $1
       WHERE id = $2`,
      [userId, id],
    )
  },

  /** Hard delete payment record permanently. Journal harus sudah di-handle sebelumnya. */
  async hardDelete(client: PoolClient, id: string): Promise<void> {
    await client.query(
      `DELETE FROM general_invoice_payments WHERE id = $1`,
      [id],
    )
  },

  /** Hard delete ALL payments for a given invoice. */
  async hardDeleteByInvoiceId(client: PoolClient, invoiceId: string): Promise<void> {
    await client.query(
      `DELETE FROM general_invoice_payments WHERE general_invoice_id = $1`,
      [invoiceId],
    )
  },

  /** Find all payments (including soft-deleted) for an invoice — used for hard delete cascade. */
  async findAllByInvoiceId(invoiceId: string): Promise<Array<{ id: string; journal_id: string | null; status: string; cc_settlement_id: string | null }>> {
    const { rows } = await pool.query<{ id: string; journal_id: string | null; status: string; cc_settlement_id: string | null }>(
      `SELECT id, journal_id, status, cc_settlement_id FROM general_invoice_payments WHERE general_invoice_id = $1`,
      [invoiceId],
    )
    return rows
  },

  /** Setelah jurnal pembayaran di-hard-delete → payment kembali APPROVED (bukti tetap). */
  async revertPaidAfterJournalDelete(paymentId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE general_invoice_payments SET
         status = 'APPROVED',
         journal_id = NULL,
         paid_at = NULL,
         paid_by = NULL,
         payment_date = NULL,
         updated_by = $2,
         updated_at = now()
       WHERE id = $1
         AND status IN ('PAID', 'RECONCILED')
         AND is_deleted = false`,
      [paymentId, userId],
    )
  },

  async findBankCoaId(bankAccountId: number, companyId?: string): Promise<string | null> {
    if (companyId) {
      const { rows } = await pool.query<{ coa_account_id: string | null }>(
        `SELECT ba.coa_account_id
         FROM bank_accounts ba
         JOIN chart_of_accounts coa ON coa.id = ba.coa_account_id
         WHERE ba.id = $1
           AND ba.deleted_at IS NULL
           AND ba.owner_type = 'company'
           AND ba.owner_id = $2
           AND coa.company_id = $3
           AND coa.deleted_at IS NULL`,
        [bankAccountId, companyId, companyId],
      )
      return rows[0]?.coa_account_id ?? null
    }
    const { rows } = await pool.query<{ coa_account_id: string | null }>(
      `SELECT coa_account_id FROM bank_accounts WHERE id = $1 AND deleted_at IS NULL`,
      [bankAccountId],
    )
    return rows[0]?.coa_account_id ?? null
  },

  /** Find invoice_id for a given payment — used for cascade hard delete from journal page. */
  async findInvoiceIdByPaymentId(paymentId: string): Promise<string | null> {
    const { rows } = await pool.query<{ general_invoice_id: string }>(
      `SELECT general_invoice_id FROM general_invoice_payments WHERE id = $1`,
      [paymentId],
    )
    return rows[0]?.general_invoice_id ?? null
  },

  /** Find COA account_id for an owner credit card (for journal creation). */
  async findCcOwnerCoaId(ownerCreditCardId: string, companyId: string): Promise<string | null> {
    const { rows } = await pool.query<{ account_id: string }>(
      `SELECT coa.id AS account_id
       FROM owner_credit_cards occ
       JOIN chart_of_accounts coa ON coa.account_code = occ.coa_code AND coa.company_id = occ.company_id
       WHERE occ.id = $1 AND occ.company_id = $2 AND occ.is_active = true
         AND coa.deleted_at IS NULL`,
      [ownerCreditCardId, companyId],
    )
    return rows[0]?.account_id ?? null
  },

  /** Find settlement record by cc_settlement_id (for hard delete cleanup). */
  async findSettlementById(settlementId: string): Promise<{ id: string; journal_id: string | null } | null> {
    const { rows } = await pool.query<{ id: string; journal_id: string | null }>(
      `SELECT id, journal_id FROM marketplace_settlements WHERE id = $1`,
      [settlementId],
    )
    return rows[0] ?? null
  },

  /** Delete a marketplace_settlement record (for hard delete cleanup). */
  async deleteSettlementRecord(client: PoolClient, settlementId: string): Promise<void> {
    // Nullify FK reference from general_invoice_payments before deleting
    await client.query(
      `UPDATE general_invoice_payments SET cc_settlement_id = NULL WHERE cc_settlement_id = $1`,
      [settlementId],
    )
    await client.query(`DELETE FROM marketplace_settlements WHERE id = $1`, [settlementId])
  },
}

// ============================================================
// TEMPLATE REPOSITORY
// ============================================================
// Helper for vendor bank accounts (used by template repository)
async function getVendorBankAccounts(vendorIds: string[]): Promise<Map<string, VendorBankAccount[]>> {
  if (vendorIds.length === 0) return new Map()
  const { rows } = await pool.query(
    `SELECT ba.id, ba.owner_id, ba.account_number, ba.account_name, ba.is_primary, bk.bank_name
     FROM bank_accounts ba
     LEFT JOIN banks bk ON bk.id = ba.bank_id
     WHERE ba.owner_type = 'vendor'
       AND ba.owner_id = ANY($1::text[])
       AND ba.is_active = true
       AND ba.deleted_at IS NULL
     ORDER BY ba.is_primary DESC, ba.id ASC`,
    [vendorIds],
  )
  const map = new Map<string, VendorBankAccount[]>()
  for (const row of rows) {
    const vid = row.owner_id as string
    const list = map.get(vid) ?? []
    list.push({
      id: row.id,
      bank_name: row.bank_name ?? '',
      account_number: row.account_number,
      account_name: row.account_name,
      is_primary: row.is_primary,
    })
    map.set(vid, list)
  }
  return map
}

async function isVendorBankAccount(vendorId: string, bankAccountId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM bank_accounts
     WHERE id = $1
       AND owner_type = 'vendor'
       AND owner_id = $2
       AND is_active = true
       AND deleted_at IS NULL`,
    [bankAccountId, vendorId],
  )
  return rows.length > 0
}

export const generalTemplateRepository = {
  withTransaction,

  async findAll(companyIds: string[]): Promise<GeneralInvoiceTemplate[]> {
    const { rows } = await pool.query<GeneralInvoiceTemplate>(
      `SELECT t.*, v.vendor_name
       FROM general_invoice_templates t
       JOIN vendors v ON v.id = t.vendor_id
       WHERE t.company_id = ANY($1::uuid[]) AND t.is_deleted = false
       ORDER BY t.template_name ASC`,
      [companyIds],
    )

    const ids = rows.map((r) => r.id)
    if (ids.length === 0) return []

    // attach lines
    const { rows: lines } = await pool.query<GeneralInvoiceTemplateLine>(
      `SELECT tl.*, coa.account_code, coa.account_name,
              coa_exp.account_code AS expense_account_code,
              coa_exp.account_name AS expense_account_name,
              coa_tax.account_code AS tax_account_code,
              coa_tax.account_name AS tax_account_name
       FROM general_invoice_template_lines tl
       JOIN chart_of_accounts coa ON coa.id = tl.account_id
       LEFT JOIN chart_of_accounts coa_exp ON coa_exp.id = tl.expense_account_id
       LEFT JOIN chart_of_accounts coa_tax ON coa_tax.id = tl.tax_account_id
       WHERE tl.template_id = ANY($1::uuid[])
       ORDER BY tl.template_id, tl.line_number`,
      [ids],
    )

    const lineMap = new Map<string, GeneralInvoiceTemplateLine[]>()
    for (const l of lines) {
      const list = lineMap.get(l.template_id) ?? []
      list.push(l)
      lineMap.set(l.template_id, list)
    }

    // attach vendor bank accounts
    const vendorIds = [...new Set(rows.map((r) => r.vendor_id))]
    const bankAccountMap = await getVendorBankAccounts(vendorIds)

    return rows.map((r) => ({
      ...r,
      lines: lineMap.get(r.id) ?? [],
      vendor_bank_accounts: bankAccountMap.get(r.vendor_id) ?? [],
    }))
  },

  async findById(id: string, companyIds: string[]): Promise<GeneralInvoiceTemplate | null> {
    const { rows } = await pool.query<GeneralInvoiceTemplate>(
      `SELECT t.*, v.vendor_name
       FROM general_invoice_templates t
       JOIN vendors v ON v.id = t.vendor_id
       WHERE t.id = $1 AND t.company_id = ANY($2::uuid[]) AND t.is_deleted = false`,
      [id, companyIds],
    )
    if (!rows[0]) return null

    const { rows: lines } = await pool.query<GeneralInvoiceTemplateLine>(
      `SELECT tl.*, coa.account_code, coa.account_name,
              coa_exp.account_code AS expense_account_code,
              coa_exp.account_name AS expense_account_name,
              coa_tax.account_code AS tax_account_code,
              coa_tax.account_name AS tax_account_name
       FROM general_invoice_template_lines tl
       JOIN chart_of_accounts coa ON coa.id = tl.account_id
       LEFT JOIN chart_of_accounts coa_exp ON coa_exp.id = tl.expense_account_id
       LEFT JOIN chart_of_accounts coa_tax ON coa_tax.id = tl.tax_account_id
       WHERE tl.template_id = $1 ORDER BY tl.line_number`,
      [id],
    )

    // attach vendor bank accounts
    const bankAccountMap = await getVendorBankAccounts([rows[0].vendor_id])

    return {
      ...rows[0],
      lines,
      vendor_bank_accounts: bankAccountMap.get(rows[0].vendor_id) ?? [],
    }
  },

  async create(
    client: PoolClient,
    companyId: string,
    branchId: string,
    dto: CreateGeneralInvoiceTemplateDto,
    userId: string,
  ): Promise<{ id: string }> {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO general_invoice_templates (
        company_id, branch_id, template_name, vendor_id,
        is_confidential, recurrence,
        default_amount, due_date_offset_days, notes,
        preferred_vendor_bank_account_id,
        created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
      RETURNING id`,
      [
        companyId, branchId, dto.template_name, dto.vendor_id,
        dto.is_confidential ?? false, dto.recurrence,
        dto.default_amount ?? null, dto.due_date_offset_days ?? 14, dto.notes ?? null,
        dto.preferred_vendor_bank_account_id ?? null,
        userId,
      ],
    )

    for (const line of dto.lines) {
      await client.query(
        `INSERT INTO general_invoice_template_lines
          (template_id, line_number, account_id, description, amount_ratio,
           transaction_type, expense_account_id, total_periods, amortization_start_offset_days,
           tax_account_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          rows[0].id, line.line_number, line.account_id,
          line.description ?? null, line.amount_ratio ?? null,
          line.transaction_type ?? 'EXPENSE',
          line.expense_account_id ?? null,
          line.total_periods ?? null,
          line.amortization_start_offset_days ?? null,
          line.tax_account_id ?? null,
        ],
      )
    }

    return rows[0]
  },

  async updateLastGenerated(client: PoolClient, templateId: string, date: string): Promise<void> {
    await client.query(
      `UPDATE general_invoice_templates SET last_generated_at = $1 WHERE id = $2`,
      [date, templateId],
    )
  },

  isVendorBankAccount,

  async updatePreferredBankAccount(
    client: PoolClient,
    id: string,
    companyId: string,
    bankAccountId: number | null,
    userId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE general_invoice_templates
       SET preferred_vendor_bank_account_id = $1, updated_by = $2, updated_at = now()
       WHERE id = $3 AND company_id = $4 AND is_deleted = false`,
      [bankAccountId, userId, id, companyId],
    )
  },

  async softDelete(client: PoolClient, id: string, companyId: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE general_invoice_templates
       SET is_deleted = true, deleted_at = now(), updated_by = $1
       WHERE id = $2 AND company_id = $3`,
      [userId, id, companyId],
    )
  },
}

// ============================================================
// AMORTIZATION REPOSITORY
// ============================================================
export const amortizationRepository = {
  withTransaction,

  async findAll(filter: {
    branchIds: string[]
    status?: string
    overdue?: boolean
    includeConfidential?: boolean
    limit: number
    offset: number
  }) {
    const conditions = ['a.branch_id = ANY($1::uuid[])']
    const params: unknown[] = [filter.branchIds]
    let idx = 2

    if (!filter.includeConfidential) {
      conditions.push(`gi.is_confidential = false`)
    }

    if (filter.status) {
      conditions.push(`a.status = $${idx}`)
      params.push(filter.status)
      idx++
    }

    if (filter.overdue) {
      conditions.push(`EXISTS (
        SELECT 1 FROM general_invoice_amortization_entries ae
        WHERE ae.amortization_id = a.id
          AND ae.journal_id IS NULL
          AND ae.period_date <= CURRENT_DATE
      )`)
    }

    const where = conditions.join(' AND ')

    const { rows } = await pool.query(
      `SELECT a.*,
              coa_p.account_code AS prepaid_account_code,
              coa_p.account_name AS prepaid_account_name,
              coa_e.account_code AS expense_account_code,
              coa_e.account_name AS expense_account_name,
              gi.invoice_number,
              v.vendor_name
       FROM general_invoice_amortizations a
       JOIN chart_of_accounts coa_p ON coa_p.id = a.prepaid_account_id
       JOIN chart_of_accounts coa_e ON coa_e.id = a.expense_account_id
       JOIN general_invoices gi ON gi.id = a.invoice_id
       JOIN vendors v ON v.id = gi.vendor_id
       WHERE ${where}
       ORDER BY a.start_date ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filter.limit, filter.offset],
    )
    return rows
  },

  async findEntriesByAmortizationIds(ids: string[]) {
    if (ids.length === 0) return []
    const { rows } = await pool.query(
      `SELECT * FROM general_invoice_amortization_entries
       WHERE amortization_id = ANY($1::uuid[])
       ORDER BY amortization_id, period_number`,
      [ids],
    )
    return rows
  },

  async findById(id: string) {
    const { rows } = await pool.query(
      `SELECT a.*, gi.branch_id, gi.company_id, gi.invoice_number, gi.is_confidential, v.vendor_name
       FROM general_invoice_amortizations a
       JOIN general_invoices gi ON gi.id = a.invoice_id
       JOIN vendors v ON v.id = gi.vendor_id
       WHERE a.id = $1 AND a.status = 'ACTIVE'`,
      [id],
    )
    return rows[0] ?? null
  },

  async findEntry(amortizationId: string, periodNumber: number) {
    const { rows } = await pool.query(
      `SELECT * FROM general_invoice_amortization_entries
       WHERE amortization_id = $1 AND period_number = $2`,
      [amortizationId, periodNumber],
    )
    return rows[0] ?? null
  },

  /** Same as findEntry but with row lock for concurrent safety */
  async findEntryForUpdate(client: PoolClient, amortizationId: string, periodNumber: number) {
    const { rows } = await client.query(
      `SELECT * FROM general_invoice_amortization_entries
       WHERE amortization_id = $1 AND period_number = $2
       FOR UPDATE`,
      [amortizationId, periodNumber],
    )
    return rows[0] ?? null
  },

  async countJournalsForAmortization(amortizationId: string): Promise<string[]> {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM journal_headers
       WHERE reference_type = 'amortization'
         AND reference_id = $1
         AND source_module = 'general_invoices'
         AND status != 'REVERSED'`,
      [amortizationId],
    )
    return rows.map((r) => r.id)
  },

  async markEntryExecuted(client: PoolClient, entryId: string, journalId: string, userId: string): Promise<boolean> {
    // Conditional update: only succeeds if journal_id is still NULL (natural concurrency guard)
    const { rowCount } = await client.query(
      `UPDATE general_invoice_amortization_entries
       SET journal_id = $1, executed_at = now(), executed_by = $2
       WHERE id = $3 AND journal_id IS NULL`,
      [journalId, userId, entryId],
    )
    return (rowCount ?? 0) > 0
  },

  async updateProgress(client: PoolClient, amortizationId: string, periodsExecuted: number, lastDate: string, status: string): Promise<void> {
    await client.query(
      `UPDATE general_invoice_amortizations
       SET periods_executed = $1, last_executed_at = $2, status = $3
       WHERE id = $4`,
      [periodsExecuted, lastDate, status, amortizationId],
    )
  },

  async cancelByInvoiceId(client: PoolClient, invoiceId: string): Promise<void> {
    await client.query(
      `UPDATE general_invoice_amortizations
       SET status = 'CANCELLED', updated_at = now()
       WHERE invoice_id = $1 AND status = 'ACTIVE'`,
      [invoiceId],
    )
  },

  /** Find all journal IDs from amortization entries for a given invoice (for hard delete cascade). */
  async findJournalIdsByInvoiceId(invoiceId: string): Promise<string[]> {
    const { rows } = await pool.query<{ journal_id: string }>(
      `SELECT ae.journal_id
       FROM general_invoice_amortization_entries ae
       JOIN general_invoice_amortizations a ON a.id = ae.amortization_id
       WHERE a.invoice_id = $1
         AND ae.journal_id IS NOT NULL`,
      [invoiceId],
    )
    return rows.map((r) => r.journal_id)
  },
}
