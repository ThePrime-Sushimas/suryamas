import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
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
  CreateGeneralInvoicePaymentDto,
  GeneralPaymentListFilter,
  GeneralInvoiceTemplate,
  GeneralInvoiceTemplateLine,
  CreateGeneralInvoiceTemplateDto,
  GeneralApDashboard,
  GeneralApDashboardByType,
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

  // Use FOR UPDATE to prevent race conditions in concurrent transactions
  const { rows } = await client.query<{ max_num: string | null }>(
    `SELECT MAX(invoice_number) AS max_num
     FROM general_invoices
     WHERE company_id = $1
       AND invoice_number LIKE $2
       AND is_deleted = false
     FOR UPDATE`,
    [companyId, `${prefix}%`],
  )

  const last = rows[0]?.max_num
  const seq = last ? parseInt(last.split('/').pop() ?? '0', 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
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

  // Use FOR UPDATE to prevent race conditions in concurrent transactions
  const { rows } = await client.query<{ max_num: string | null }>(
    `SELECT MAX(payment_number) AS max_num
     FROM general_invoice_payments
     WHERE company_id = $1
       AND payment_number LIKE $2
       AND is_deleted = false
     FOR UPDATE`,
    [companyId, `${prefix}%`],
  )

  const last = rows[0]?.max_num
  const seq = last ? parseInt(last.split('/').pop() ?? '0', 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
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
    const conditions: string[] = ['v.company_id = $1', 'v.is_deleted = false']
    const params: unknown[] = [filter.company_id]
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

    const [{ rows: data }, { rows: countRows }] = await Promise.all([
      pool.query<Vendor>(
        `SELECT * FROM vendors v WHERE ${where} ORDER BY v.vendor_name ASC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM vendors v WHERE ${where}`,
        params,
      ),
    ])

    return { data, total: parseInt(countRows[0].count, 10) }
  },

  async findById(id: string, companyId: string): Promise<Vendor | null> {
    const { rows } = await pool.query<Vendor>(
      `SELECT * FROM vendors WHERE id = $1 AND company_id = $2 AND is_deleted = false`,
      [id, companyId],
    )
    return rows[0] ?? null
  },

  async create(client: PoolClient, companyId: string, dto: CreateVendorDto, userId: string): Promise<Vendor> {
    const { rows } = await client.query<Vendor>(
      `INSERT INTO vendors (
        company_id, vendor_code, vendor_name, vendor_type,
        phone, email, address,
        bank_name, bank_account_number, bank_account_name,
        notes, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
      RETURNING *`,
      [
        companyId, dto.vendor_code, dto.vendor_name, dto.vendor_type ?? null,
        dto.phone ?? null, dto.email ?? null, dto.address ?? null,
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
      'vendor_code', 'vendor_name', 'vendor_type', 'phone', 'email',
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
  companyId: string,
  branchIds?: string[],
  includeConfidential = false,
): { where: string; params: unknown[] } {
  const conditions: string[] = ['gi.company_id = $1', 'gi.is_deleted = false']
  const params: unknown[] = [companyId]
  let idx = 2

  if (!includeConfidential) {
    conditions.push('gi.is_confidential = false')
  }

  if (branchIds && branchIds.length > 0) {
    conditions.push(`gi.branch_id = ANY($${idx}::uuid[])`)
    params.push(branchIds)
    idx++
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
    const conditions: string[] = ['gi.company_id = $1', 'gi.is_deleted = false']
    const params: unknown[] = [filter.company_id]
    let idx = 2

    // Confidential filter — kalau tidak punya permission, sembunyikan is_confidential=true
    if (!filter.include_confidential) {
      conditions.push(`gi.is_confidential = false`)
    }

    if (filter.branch_ids && filter.branch_ids.length > 0) {
      conditions.push(`gi.branch_id = ANY($${idx}::uuid[])`)
      params.push(filter.branch_ids)
      idx++
    } else if (filter.branch_id) {
      conditions.push(`gi.branch_id = $${idx}`)
      params.push(filter.branch_id)
      idx++
    }

    if (filter.status) {
      conditions.push(`gi.status = $${idx}`)
      params.push(filter.status)
      idx++
    }
    if (filter.expense_type) {
      conditions.push(`gi.expense_type = $${idx}`)
      params.push(filter.expense_type)
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

    const where = conditions.join(' AND ')
    const page = filter.page ?? 1
    const limit = filter.limit ?? 20
    const offset = (page - 1) * limit

    const sql = `
      SELECT
        gi.*,
        v.vendor_name,
        v.vendor_type,
        jh.journal_number
      FROM general_invoices gi
      JOIN vendors v ON v.id = gi.vendor_id
      LEFT JOIN journal_headers jh ON jh.id = gi.journal_id
      WHERE ${where}
      ORDER BY gi.invoice_date DESC, gi.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `

    const countSql = `
      SELECT COUNT(*) FROM general_invoices gi
      JOIN vendors v ON v.id = gi.vendor_id
      WHERE ${where}
    `

    const [{ rows: data }, { rows: countRows }] = await Promise.all([
      pool.query<GeneralInvoice>(sql, [...params, limit, offset]),
      pool.query<{ count: string }>(countSql, params),
    ])

    return { data, total: parseInt(countRows[0].count, 10) }
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
      `SELECT gil.*, coa.account_code, coa.account_name
       FROM general_invoice_lines gil
       JOIN chart_of_accounts coa ON coa.id = gil.account_id
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
        expense_type, is_confidential,
        subtotal, total_tax, total_amount,
        notes, attachment_url, template_id,
        created_by, updated_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17
      ) RETURNING id`,
      [
        companyId, branchId, invoiceNumber, dto.vendor_id,
        dto.invoice_date, dto.due_date ?? null,
        dto.period_start ?? null, dto.period_end ?? null,
        dto.expense_type, dto.is_confidential ?? false,
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
    lines: Array<{ line_number: number; account_id: string; description?: string; amount: number; tax_amount?: number }>,
  ): Promise<void> {
    for (const line of lines) {
      const taxAmt = line.tax_amount ?? 0
      await client.query(
        `INSERT INTO general_invoice_lines
          (general_invoice_id, line_number, account_id, description, amount, tax_amount, total_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [invoiceId, line.line_number, line.account_id, line.description ?? null, line.amount, taxAmt, line.amount + taxAmt],
      )
    }
  },

  async replaceLines(
    client: PoolClient,
    invoiceId: string,
    lines: Array<{ line_number: number; account_id: string; description?: string; amount: number; tax_amount?: number }>,
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
      'period_start', 'period_end', 'expense_type', 'is_confidential',
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

  // ----------------------------------------------------------
  // COA untuk liability account (Hutang Usaha Umum)
  // Diambil dari accounting_purposes dengan key 'GEN-AP-LIABILITY'
  // ----------------------------------------------------------
  async findLiabilityAccountId(companyId: string): Promise<string | null> {
    const { rows } = await pool.query<{ account_id: string }>(
      `SELECT apa.account_id
       FROM accounting_purposes ap
       JOIN accounting_purpose_accounts apa ON apa.purpose_id = ap.id
       WHERE ap.company_id = $1
         AND ap.purpose_key = 'GEN-AP-LIABILITY'
         AND apa.is_active = true
       LIMIT 1`,
      [companyId],
    )
    return rows[0]?.account_id ?? null
  },

  // ----------------------------------------------------------
  // Dashboard
  // ----------------------------------------------------------
  async getDashboard(companyId: string, branchIds?: string[], includeConfidential = false): Promise<GeneralApDashboard> {
    const today = new Date().toISOString().slice(0, 10)
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    // Build base WHERE clause
    const { where, params } = buildDashboardWhereClause(companyId, branchIds, includeConfidential)

    // Add date params with clear indexing
    const todayIdx = params.length + 1
    params.push(today)
    const weekEndIdx = params.length + 1
    params.push(weekEnd)

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

    // Rebuild params for by_expense_type query
    const { rows: byTypeRows } = await pool.query<GeneralApDashboardByType>(
      `SELECT
         gi.expense_type,
         SUM(gi.total_amount) AS total_amount,
         COUNT(*) AS invoice_count,
         COALESCE(SUM(gi.total_amount) FILTER (
           WHERE gi.status = 'POSTED'
             AND NOT EXISTS (
               SELECT 1 FROM general_invoice_payments gip
               WHERE gip.general_invoice_id = gi.id
                 AND gip.status = 'PAID'
                 AND gip.is_deleted = false
             )
         ), 0) AS unpaid_amount
       FROM general_invoices gi
       WHERE ${where}
       GROUP BY gi.expense_type
       ORDER BY total_amount DESC`,
      params,
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
      by_expense_type: byTypeRows.map((r) => ({
        expense_type: r.expense_type,
        total_amount: Number(r.total_amount),
        invoice_count: Number(r.invoice_count),
        unpaid_amount: Number(r.unpaid_amount),
      })),
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
    const conditions: string[] = ['gip.company_id = $1', 'gip.is_deleted = false']
    const params: unknown[] = [filter.company_id]
    let idx = 2

    if (!filter.include_confidential) {
      conditions.push(`gi.is_confidential = false`)
    }
    if (filter.branch_ids && filter.branch_ids.length > 0) {
      conditions.push(`gip.branch_id = ANY($${idx}::uuid[])`)
      params.push(filter.branch_ids)
      idx++
    } else if (filter.branch_id) {
      conditions.push(`gip.branch_id = $${idx}`)
      params.push(filter.branch_id)
      idx++
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

    const where = conditions.join(' AND ')
    const page = filter.page ?? 1
    const limit = filter.limit ?? 20
    const offset = (page - 1) * limit

    const sql = `
      SELECT gip.*, gi.invoice_number, v.vendor_name,
             ba.account_name AS bank_account_name,
             jh.journal_number
      FROM general_invoice_payments gip
      JOIN general_invoices gi ON gi.id = gip.general_invoice_id
      JOIN vendors v ON v.id = gi.vendor_id
      LEFT JOIN bank_accounts ba ON ba.id = gip.bank_account_id
      LEFT JOIN journal_headers jh ON jh.id = gip.journal_id
      WHERE ${where}
      ORDER BY gip.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `

    const countSql = `
      SELECT COUNT(*) FROM general_invoice_payments gip
      JOIN general_invoices gi ON gi.id = gip.general_invoice_id
      JOIN vendors v ON v.id = gi.vendor_id
      WHERE ${where}
    `

    const [{ rows: data }, { rows: countRows }] = await Promise.all([
      pool.query<GeneralInvoicePayment>(sql, [...params, limit, offset]),
      pool.query<{ count: string }>(countSql, params),
    ])

    return { data, total: parseInt(countRows[0].count, 10) }
  },

  async findById(id: string, companyId: string): Promise<GeneralInvoicePayment | null> {
    const { rows } = await pool.query<GeneralInvoicePayment>(
      `SELECT gip.*, gi.invoice_number, v.vendor_name,
              ba.account_name AS bank_account_name,
              jh.journal_number
       FROM general_invoice_payments gip
       JOIN general_invoices gi ON gi.id = gip.general_invoice_id
       JOIN vendors v ON v.id = gi.vendor_id
       LEFT JOIN bank_accounts ba ON ba.id = gip.bank_account_id
       LEFT JOIN journal_headers jh ON jh.id = gip.journal_id
       WHERE gip.id = $1 AND gip.company_id = $2 AND gip.is_deleted = false`,
      [id, companyId],
    )
    return rows[0] ?? null
  },

  async findByInvoiceId(invoiceId: string): Promise<GeneralInvoicePayment | null> {
    const { rows } = await pool.query<GeneralInvoicePayment>(
      `SELECT gip.*, gi.invoice_number, v.vendor_name,
              ba.account_name AS bank_account_name,
              jh.journal_number
       FROM general_invoice_payments gip
       JOIN general_invoices gi ON gi.id = gip.general_invoice_id
       JOIN vendors v ON v.id = gi.vendor_id
       LEFT JOIN bank_accounts ba ON ba.id = gip.bank_account_id
       LEFT JOIN journal_headers jh ON jh.id = gip.journal_id
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
        bank_account_id, payment_method, total_amount,
        payment_date, notes, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
      RETURNING id`,
      [
        companyId, branchId, paymentNumber, dto.general_invoice_id,
        dto.bank_account_id, dto.payment_method ?? 'TRANSFER', dto.total_amount,
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

  async findBankCoaId(bankAccountId: number): Promise<string | null> {
    const { rows } = await pool.query<{ coa_id: string }>(
      `SELECT coa_id FROM bank_accounts WHERE id = $1`,
      [bankAccountId],
    )
    return rows[0]?.coa_id ?? null
  },
}

// ============================================================
// TEMPLATE REPOSITORY
// ============================================================
export const generalTemplateRepository = {
  withTransaction,

  async findAll(companyId: string): Promise<GeneralInvoiceTemplate[]> {
    const { rows } = await pool.query<GeneralInvoiceTemplate>(
      `SELECT t.*, v.vendor_name
       FROM general_invoice_templates t
       JOIN vendors v ON v.id = t.vendor_id
       WHERE t.company_id = $1 AND t.is_deleted = false
       ORDER BY t.template_name ASC`,
      [companyId],
    )

    // attach lines
    const ids = rows.map((r) => r.id)
    if (ids.length === 0) return []

    const { rows: lines } = await pool.query<GeneralInvoiceTemplateLine>(
      `SELECT tl.*, coa.account_code, coa.account_name
       FROM general_invoice_template_lines tl
       JOIN chart_of_accounts coa ON coa.id = tl.account_id
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

    return rows.map((r) => ({ ...r, lines: lineMap.get(r.id) ?? [] }))
  },

  async findById(id: string, companyId: string): Promise<GeneralInvoiceTemplate | null> {
    const { rows } = await pool.query<GeneralInvoiceTemplate>(
      `SELECT t.*, v.vendor_name
       FROM general_invoice_templates t
       JOIN vendors v ON v.id = t.vendor_id
       WHERE t.id = $1 AND t.company_id = $2 AND t.is_deleted = false`,
      [id, companyId],
    )
    if (!rows[0]) return null

    const { rows: lines } = await pool.query<GeneralInvoiceTemplateLine>(
      `SELECT tl.*, coa.account_code, coa.account_name
       FROM general_invoice_template_lines tl
       JOIN chart_of_accounts coa ON coa.id = tl.account_id
       WHERE tl.template_id = $1 ORDER BY tl.line_number`,
      [id],
    )

    return { ...rows[0], lines }
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
        expense_type, is_confidential, recurrence,
        default_amount, due_date_offset_days, notes,
        created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
      RETURNING id`,
      [
        companyId, branchId, dto.template_name, dto.vendor_id,
        dto.expense_type, dto.is_confidential ?? false, dto.recurrence,
        dto.default_amount ?? null, dto.due_date_offset_days ?? 14, dto.notes ?? null,
        userId,
      ],
    )

    for (const line of dto.lines) {
      await client.query(
        `INSERT INTO general_invoice_template_lines
          (template_id, line_number, account_id, description, amount_ratio)
         VALUES ($1,$2,$3,$4,$5)`,
        [rows[0].id, line.line_number, line.account_id, line.description ?? null, line.amount_ratio ?? null],
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

  async softDelete(client: PoolClient, id: string, companyId: string, userId: string): Promise<void> {
    await client.query(
      `UPDATE general_invoice_templates
       SET is_deleted = true, deleted_at = now(), updated_by = $1
       WHERE id = $2 AND company_id = $3`,
      [userId, id, companyId],
    )
  },
}
