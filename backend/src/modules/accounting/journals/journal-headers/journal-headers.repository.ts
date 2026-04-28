import { pool } from '../../../../config/db'
import { JournalHeader, JournalHeaderWithLines, CreateJournalDto, JournalFilter, SortParams } from './journal-headers.types'
import { JournalStatus } from '../shared/journal.types'
import { logError, logInfo } from '../../../../config/logger'

const VALID_SORT_FIELDS = ['journal_number', 'journal_date', 'journal_type', 'status', 'total_debit', 'created_at', 'updated_at', 'id']

function buildConditions(companyId: string, filter?: JournalFilter) {
  const conditions: string[] = ['jh.company_id = $1']
  const params: (string | boolean)[] = [companyId]
  let idx = 2

  if (filter?.show_deleted) {
    conditions.push('jh.deleted_at IS NOT NULL')
  } else {
    conditions.push('jh.deleted_at IS NULL')
  }

  if (filter?.branch_id) { params.push(filter.branch_id); conditions.push(`jh.branch_id = $${idx}`); idx++ }
  if (filter?.journal_type) { params.push(filter.journal_type); conditions.push(`jh.journal_type = $${idx}`); idx++ }
  if (filter?.status) { params.push(filter.status); conditions.push(`jh.status = $${idx}`); idx++ }
  if (filter?.date_from) { params.push(filter.date_from); conditions.push(`jh.journal_date >= $${idx}`); idx++ }
  if (filter?.date_to) { params.push(filter.date_to); conditions.push(`jh.journal_date <= $${idx}`); idx++ }
  if (filter?.period) { params.push(filter.period); conditions.push(`jh.period = $${idx}`); idx++ }
  if (filter?.search) { params.push(`%${filter.search}%`); conditions.push(`(jh.journal_number ILIKE $${idx} OR jh.description ILIKE $${idx})`); idx++ }

  return { where: `WHERE ${conditions.join(' AND ')}`, params, idx }
}

export class JournalHeadersRepository {
  async findAll(companyId: string, pagination: { limit: number; offset: number }, sort?: SortParams, filter?: JournalFilter): Promise<{ data: JournalHeader[]; total: number }> {
    const { where, params, idx } = buildConditions(companyId, filter)
    const sortField = sort?.field && VALID_SORT_FIELDS.includes(sort.field) ? `jh.${sort.field}` : (filter?.show_deleted ? 'jh.deleted_at' : 'jh.journal_date')
    const sortOrder = filter?.show_deleted ? 'DESC' : (sort?.order === 'asc' ? 'ASC' : 'DESC')

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT jh.*, b.branch_name, c.company_name
         FROM journal_headers jh
         LEFT JOIN branches b ON b.id = jh.branch_id
         LEFT JOIN companies c ON c.id = jh.company_id
         ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM journal_headers jh ${where}`, params)
    ])

    const mapped = dataRes.rows.map((r: Record<string, unknown>) => ({ ...r, branch_name: r.branch_name || r.company_name || null }))
    return { data: await this.populateNames(mapped) as unknown as JournalHeader[], total: countRes.rows[0].total }
  }

  async findAllWithLines(companyId: string, pagination: { limit: number; offset: number }, sort?: SortParams, filter?: JournalFilter): Promise<{ data: JournalHeaderWithLines[]; total: number }> {
    const { data: headers, total } = await this.findAll(companyId, pagination, sort, filter)
    if (!headers.length) return { data: [], total }

    const headerIds = headers.map(h => (h as unknown as Record<string, unknown>).id)
    const { rows: lines } = await pool.query(
      `SELECT jl.*, coa.account_code, coa.account_name, coa.account_type
       FROM journal_lines jl
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
       WHERE jl.journal_header_id = ANY($1::uuid[])
       ORDER BY jl.line_number ASC`,
      [headerIds]
    )

    const linesByHeader = new Map<string, Record<string, unknown>[]>()
    for (const line of lines) {
      const hid = line.journal_header_id as string
      if (!linesByHeader.has(hid)) linesByHeader.set(hid, [])
      linesByHeader.get(hid)!.push(line)
    }

    const withLines = headers.map(h => ({
      ...h,
      lines: linesByHeader.get((h as unknown as Record<string, unknown>).id as string) || [],
    }))

    return { data: withLines as unknown as JournalHeaderWithLines[], total }
  }

  async findById(id: string, includeDeleted = false): Promise<JournalHeaderWithLines | null> {
    const deletedFilter = includeDeleted ? '' : ' AND jh.deleted_at IS NULL'
    const { rows: headerRows } = await pool.query(
      `SELECT jh.*, b.branch_name, c.company_name
       FROM journal_headers jh
       LEFT JOIN branches b ON b.id = jh.branch_id
       LEFT JOIN companies c ON c.id = jh.company_id
       WHERE jh.id = $1${deletedFilter}`,
      [id]
    )
    if (!headerRows[0]) return null

    const header = { ...headerRows[0], branch_name: headerRows[0].branch_name || headerRows[0].company_name || null }

    const { rows: lines } = await pool.query(
      `SELECT jl.*, coa.account_code, coa.account_name, coa.account_type
       FROM journal_lines jl
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
       WHERE jl.journal_header_id = $1 ORDER BY jl.line_number`,
      [id]
    )

    const result = { ...header, lines }
    const [populated] = await this.populateNames([result])
    return populated as unknown as JournalHeaderWithLines
  }

  private async populateNames(data: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    if (!data.length) return data

    const ids = new Set<string>()
    const fields = ['created_by', 'updated_by', 'submitted_by', 'approved_by', 'posted_by', 'rejected_by', 'reversed_by', 'deleted_by']
    data.forEach(item => fields.forEach(f => { if (item[f]) ids.add(item[f] as string) }))

    const idList = Array.from(ids).filter(Boolean)
    if (!idList.length) return data

    const [byIdRes, byUserIdRes] = await Promise.all([
      pool.query('SELECT id, full_name FROM employees WHERE id = ANY($1::uuid[])', [idList]),
      pool.query('SELECT user_id, full_name FROM employees WHERE user_id = ANY($1::uuid[])', [idList]),
    ])

    const nameMap = new Map<string, string>()
    byIdRes.rows.forEach((r: { id: string; full_name: string }) => nameMap.set(r.id, r.full_name))
    byUserIdRes.rows.forEach((r: { user_id: string; full_name: string }) => { if (r.user_id) nameMap.set(r.user_id, r.full_name) })

    return data.map(item => {
      const result = { ...item }
      fields.forEach(f => { result[`${f}_name`] = (item[f] && nameMap.get(item[f] as string)) || null })
      return result
    })
  }

  async create(data: CreateJournalDto & {
    journal_number: string; sequence_number: number; period: string;
    total_debit: number; total_credit: number; status: JournalStatus; reversal_of_journal_id?: string
  }, userId: string): Promise<JournalHeaderWithLines> {
    const { lines, ...headerData } = data
    const now = new Date().toISOString()

    const headerInsert = { ...headerData, created_by: userId, updated_by: userId, created_at: now, updated_at: now }
    const keys = Object.keys(headerInsert)
    const values = Object.values(headerInsert)

    const { rows: headerRows } = await pool.query(
      `INSERT INTO journal_headers (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      values
    )
    const header = headerRows[0]

    const lineValues: unknown[] = []
    const linePlaceholders: string[] = []
    const lineKeys = ['journal_header_id', 'line_number', 'account_id', 'description', 'debit_amount', 'credit_amount', 'currency', 'exchange_rate', 'base_debit_amount', 'base_credit_amount', 'created_at']

    lines.forEach((line, i) => {
      const offset = i * lineKeys.length
      linePlaceholders.push(`(${lineKeys.map((_, j) => `$${offset + j + 1}`).join(', ')})`)
      lineValues.push(
        header.id, line.line_number, line.account_id, line.description,
        line.debit_amount, line.credit_amount, data.currency || 'IDR', data.exchange_rate || 1,
        line.debit_amount * (data.exchange_rate || 1), line.credit_amount * (data.exchange_rate || 1), now
      )
    })

    try {
      const { rows: createdLines } = await pool.query(
        `INSERT INTO journal_lines (${lineKeys.join(', ')}) VALUES ${linePlaceholders.join(', ')} RETURNING *`,
        lineValues
      )
      logInfo('Journal created', { journal_id: header.id, journal_number: header.journal_number })
      return { ...header, lines: createdLines } as JournalHeaderWithLines
    } catch (error) {
      await pool.query('DELETE FROM journal_headers WHERE id = $1', [header.id])
      logError('Failed to create journal lines, header rolled back', { error: (error as Error).message, header_id: header.id })
      throw error
    }
  }

  async update(id: string, data: Partial<JournalHeader>, userId: string): Promise<JournalHeader> {
    const fullData = { ...data, updated_by: userId, updated_at: new Date().toISOString() }
    const keys = Object.keys(fullData)
    const values = Object.values(fullData)
    const { rows } = await pool.query(
      `UPDATE journal_headers SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} AND deleted_at IS NULL RETURNING *`,
      [...values, id]
    )
    return rows[0]
  }

  async updateStatus(id: string, status: JournalStatus, userId: string, timestamps?: Record<string, unknown>): Promise<void> {
    const updateData: Record<string, unknown> = { status, updated_by: userId, updated_at: new Date().toISOString(), ...timestamps }
    const keys = Object.keys(updateData)
    const values = Object.values(updateData)
    await pool.query(
      `UPDATE journal_headers SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} AND deleted_at IS NULL`,
      [...values, id]
    )
  }

  async delete(id: string, _userId: string): Promise<void> {
    await pool.query('DELETE FROM journal_lines WHERE journal_header_id = $1', [id])
    await pool.query('DELETE FROM journal_headers WHERE id = $1', [id])
  }

  async getNextSequence(companyId: string, type: string, period: string): Promise<number> {
    const { rows } = await pool.query('SELECT get_next_journal_sequence($1, $2, $3) AS seq', [companyId, period, type])
    if (!rows[0]?.seq) throw new Error('Sequence generation failed')
    return rows[0].seq as number
  }

  async markReversed(id: string, reversalJournalId: string, reason: string): Promise<void> {
    await pool.query(
      'UPDATE journal_headers SET is_reversed = true, reversed_by_journal_id = $1, reversal_date = NOW(), reversal_reason = $2, updated_at = NOW() WHERE id = $3',
      [reversalJournalId, reason, id]
    )
  }

  async restore(id: string, userId: string): Promise<void> {
    await pool.query(
      'UPDATE journal_headers SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW(), updated_by = $1 WHERE id = $2',
      [userId, id]
    )
  }

  async clearJournalReferences(journalId: string): Promise<void> {
    await Promise.all([
      pool.query("UPDATE bank_statements SET journal_id = NULL, updated_at = NOW() WHERE journal_id = $1", [journalId]),
      pool.query("UPDATE aggregated_transactions SET journal_id = NULL, status = 'READY', updated_at = NOW() WHERE journal_id = $1", [journalId]),
    ])
  }

  async updateLines(journalHeaderId: string, lines: Record<string, unknown>[]): Promise<void> {
    await pool.query('DELETE FROM journal_lines WHERE journal_header_id = $1', [journalHeaderId])
    if (!lines.length) return

    const keys = Object.keys(lines[0])
    const placeholders = lines.map((_, i) =>
      `(${keys.map((_, j) => `$${i * keys.length + j + 1}`).join(', ')})`
    ).join(', ')
    const values = lines.flatMap(l => keys.map(k => l[k]))
    await pool.query(`INSERT INTO journal_lines (${keys.join(', ')}) VALUES ${placeholders}`, values)
  }

  async updatePosAggregateStatus(journalId: string): Promise<string | null> {
    const { rows } = await pool.query(
      "UPDATE aggregated_transactions SET status = 'POSTED', updated_at = NOW() WHERE journal_id = $1 AND source_type = 'POS' AND status = 'PROCESSING' AND deleted_at IS NULL RETURNING source_id",
      [journalId]
    )
    return rows[0]?.source_id ?? null
  }

  async countUnjournaledByImport(posImportId: string): Promise<number> {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM aggregated_transactions WHERE source_id = $1 AND source_type = 'POS' AND deleted_at IS NULL AND status != 'FAILED' AND journal_id IS NULL",
      [posImportId]
    )
    return rows[0].cnt
  }

  async markPosImportPosted(posImportId: string): Promise<void> {
    await pool.query("UPDATE pos_imports SET status = 'POSTED', updated_at = NOW() WHERE id = $1 AND status = 'MAPPED'", [posImportId])
  }

  async getAggregatedForCompleteness(branchId: string, journalDate: string): Promise<Array<{ id: string; payment_method_id: number; nett_amount: number; is_reconciled: boolean; status: string }>> {
    const { rows } = await pool.query(
      'SELECT id, payment_method_id, nett_amount, is_reconciled, status FROM aggregated_transactions WHERE branch_id = $1 AND transaction_date = $2::date AND superseded_by IS NULL AND deleted_at IS NULL',
      [branchId, journalDate]
    )
    return rows
  }

  async getPaymentMethodNames(pmIds: number[]): Promise<Record<number, string>> {
    if (!pmIds.length) return {}
    const { rows } = await pool.query('SELECT id, name FROM payment_methods WHERE id = ANY($1::int[])', [pmIds])
    const map: Record<number, string> = {}
    for (const r of rows) map[r.id] = r.name
    return map
  }
}

export const journalHeadersRepository = new JournalHeadersRepository()
