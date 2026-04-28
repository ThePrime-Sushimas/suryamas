import { pool } from '../../../../config/db'
import { JournalLineWithDetails, JournalLineFilter, JournalLineSortParams } from './journal-lines.types'

const BASE_SELECT = `
  jl.*,
  jh.journal_number, jh.journal_date, jh.journal_type, jh.status AS journal_status,
  jh.description AS journal_description, jh.period, jh.is_reversed, jh.branch_id AS jh_branch_id,
  jh.company_id AS jh_company_id, jh.deleted_at AS jh_deleted_at,
  coa.account_code, coa.account_name, coa.account_type
`
const BASE_FROM = `
  FROM journal_lines jl
  JOIN journal_headers jh ON jh.id = jl.journal_header_id
  JOIN chart_of_accounts coa ON coa.id = jl.account_id
`

function buildConditions(companyId: string, filter?: JournalLineFilter) {
  const conditions: string[] = ['jh.company_id = $1']
  const params: (string | boolean)[] = [companyId]
  let idx = 2

  if (!filter?.show_deleted) conditions.push('jh.deleted_at IS NULL')
  if (!filter?.include_reversed) conditions.push('jh.is_reversed = false')

  if (filter?.branch_id) { params.push(filter.branch_id); conditions.push(`jh.branch_id = $${idx}`); idx++ }
  if (filter?.account_id) { params.push(filter.account_id); conditions.push(`jl.account_id = $${idx}`); idx++ }
  if (filter?.journal_type) { params.push(filter.journal_type); conditions.push(`jh.journal_type = $${idx}`); idx++ }

  if (filter?.journal_status === 'POSTED_ONLY') {
    conditions.push("jh.status = 'POSTED'")
  } else if (filter?.journal_status) {
    params.push(filter.journal_status); conditions.push(`jh.status = $${idx}`); idx++
  }

  if (filter?.period_from) { params.push(filter.period_from); conditions.push(`jh.period >= $${idx}`); idx++ }
  if (filter?.period_to) { params.push(filter.period_to); conditions.push(`jh.period <= $${idx}`); idx++ }
  if (filter?.date_from) { params.push(filter.date_from); conditions.push(`jh.journal_date >= $${idx}`); idx++ }
  if (filter?.date_to) { params.push(filter.date_to); conditions.push(`jh.journal_date <= $${idx}`); idx++ }
  if (filter?.search) {
    params.push(`%${filter.search}%`)
    conditions.push(`(jl.description ILIKE $${idx} OR jh.journal_number ILIKE $${idx})`)
    idx++
  }

  return { where: `WHERE ${conditions.join(' AND ')}`, params, idx }
}

const VALID_SORT_MAP: Record<string, string> = {
  journal_date: 'jh.journal_date', journal_number: 'jh.journal_number',
  account_code: 'coa.account_code', amount: 'jl.debit_amount',
  created_at: 'jl.created_at', line_number: 'jl.line_number',
}

function buildOrderBy(sort?: JournalLineSortParams): string {
  if (sort?.field && VALID_SORT_MAP[sort.field]) {
    return `ORDER BY ${VALID_SORT_MAP[sort.field]} ${sort.order === 'desc' ? 'DESC' : 'ASC'}`
  }
  return 'ORDER BY jh.journal_date ASC, jh.journal_number ASC, jl.line_number ASC'
}

function transformRow(row: Record<string, unknown>): JournalLineWithDetails {
  return {
    id: row.id, journal_header_id: row.journal_header_id, line_number: row.line_number,
    account_id: row.account_id, description: row.description,
    debit_amount: row.debit_amount, credit_amount: row.credit_amount,
    is_debit: Number(row.debit_amount) > 0,
    amount: Number(row.debit_amount) > 0 ? row.debit_amount : row.credit_amount,
    currency: row.currency, exchange_rate: row.exchange_rate,
    base_debit_amount: row.base_debit_amount, base_credit_amount: row.base_credit_amount,
    cost_center_id: row.cost_center_id, project_id: row.project_id,
    created_at: row.created_at, updated_at: row.updated_at,
    account_code: row.account_code, account_name: row.account_name, account_type: row.account_type,
    journal_number: row.journal_number, journal_date: row.journal_date,
    journal_type: row.journal_type, journal_status: row.journal_status,
    journal_description: row.journal_description, period: row.period,
    is_reversed: row.is_reversed, branch_id: row.jh_branch_id,
  } as unknown as JournalLineWithDetails
}

export class JournalLinesRepository {
  async findAll(
    companyId: string, pagination: { limit: number; offset: number },
    sort?: JournalLineSortParams, filter?: JournalLineFilter
  ): Promise<{ data: JournalLineWithDetails[]; total: number }> {
    const { where, params, idx } = buildConditions(companyId, filter)
    const orderBy = buildOrderBy(sort)

    const [dataRes, countRes] = await Promise.all([
      pool.query(`SELECT ${BASE_SELECT} ${BASE_FROM} ${where} ${orderBy} LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      pool.query(`SELECT COUNT(*)::int AS total ${BASE_FROM} ${where}`, params)
    ])

    return { data: dataRes.rows.map(transformRow), total: countRes.rows[0].total }
  }

  async findById(id: string, companyId: string): Promise<JournalLineWithDetails | null> {
    const { rows } = await pool.query(
      `SELECT ${BASE_SELECT} ${BASE_FROM} WHERE jl.id = $1 AND jh.company_id = $2 AND jh.deleted_at IS NULL`,
      [id, companyId]
    )
    return rows[0] ? transformRow(rows[0]) : null
  }

  async findByJournalHeaderId(journalHeaderId: string, companyId: string): Promise<JournalLineWithDetails[]> {
    const { rows } = await pool.query(
      `SELECT ${BASE_SELECT} ${BASE_FROM} WHERE jl.journal_header_id = $1 AND jh.company_id = $2 AND jh.deleted_at IS NULL ORDER BY jl.line_number ASC`,
      [journalHeaderId, companyId]
    )
    return rows.map(transformRow)
  }

  async findByAccountId(accountId: string, companyId: string, filter?: JournalLineFilter): Promise<JournalLineWithDetails[]> {
    const defaultFilter: JournalLineFilter = {
      company_id: companyId,
      account_id: accountId,
      journal_status: filter?.journal_status || 'POSTED_ONLY',
      include_reversed: filter?.include_reversed ?? false,
      show_deleted: filter?.show_deleted ?? false,
      date_from: filter?.date_from,
      date_to: filter?.date_to,
    }
    const { where, params } = buildConditions(companyId, defaultFilter)

    const { rows } = await pool.query(
      `SELECT ${BASE_SELECT} ${BASE_FROM} ${where} ORDER BY jh.journal_date ASC, jh.journal_number ASC, jl.line_number ASC`,
      params
    )
    return rows.map(transformRow)
  }
}

export const journalLinesRepository = new JournalLinesRepository()
