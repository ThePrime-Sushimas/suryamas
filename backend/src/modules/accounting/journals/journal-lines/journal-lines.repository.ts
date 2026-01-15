import { supabase } from '../../../../config/supabase'
import { JournalLine, JournalLineWithDetails, JournalLineFilter, JournalLineSortParams } from './journal-lines.types'

export class JournalLinesRepository {
  
  /**
   * Find all lines with details (account, journal info)
   * Includes computed semantic fields (is_debit, amount)
   */
  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    sort?: JournalLineSortParams,
    filter?: JournalLineFilter
  ): Promise<{ data: JournalLineWithDetails[]; total: number }> {
    
    // Build select with computed fields
    let query = supabase
      .from('journal_lines')
      .select(`
        *,
        journal_headers!inner(
          id,
          company_id,
          branch_id,
          journal_number,
          journal_date,
          journal_type,
          status,
          description,
          period,
          is_reversed,
          deleted_at
        ),
        chart_of_accounts!inner(
          account_code,
          account_name,
          account_type
        )
      `, { count: 'exact' })
    
    let countQuery = supabase
      .from('journal_lines')
      .select('id, journal_headers!inner(company_id, deleted_at)', { count: 'exact', head: true })
    
    // Company filter (via journal_headers)
    query = query.eq('journal_headers.company_id', companyId)
    countQuery = countQuery.eq('journal_headers.company_id', companyId)
    
    // Soft delete filter (default: hide deleted)
    if (!filter?.show_deleted) {
      query = query.is('journal_headers.deleted_at', null)
      countQuery = countQuery.is('journal_headers.deleted_at', null)
    }
    
    // Reversed filter (default: hide reversed)
    if (!filter?.include_reversed) {
      query = query.eq('journal_headers.is_reversed', false)
      countQuery = countQuery.eq('journal_headers.is_reversed', false)
    }
    
    if (filter) {
      if (filter.branch_id) {
        query = query.eq('journal_headers.branch_id', filter.branch_id)
        countQuery = countQuery.eq('journal_headers.branch_id', filter.branch_id)
      }
      
      if (filter.account_id) {
        query = query.eq('account_id', filter.account_id)
        countQuery = countQuery.eq('account_id', filter.account_id)
      }
      
      if (filter.journal_type) {
        query = query.eq('journal_headers.journal_type', filter.journal_type)
        countQuery = countQuery.eq('journal_headers.journal_type', filter.journal_type)
      }
      
      if (filter.journal_status === 'POSTED_ONLY') {
        query = query.eq('journal_headers.status', 'POSTED')
        countQuery = countQuery.eq('journal_headers.status', 'POSTED')
      } else if (filter.journal_status) {
        query = query.eq('journal_headers.status', filter.journal_status)
        countQuery = countQuery.eq('journal_headers.status', filter.journal_status)
      }
      
      if (filter.period_from) {
        query = query.gte('journal_headers.period', filter.period_from)
        countQuery = countQuery.gte('journal_headers.period', filter.period_from)
      }
      
      if (filter.period_to) {
        query = query.lte('journal_headers.period', filter.period_to)
        countQuery = countQuery.lte('journal_headers.period', filter.period_to)
      }
      
      if (filter.date_from) {
        query = query.gte('journal_headers.journal_date', filter.date_from)
        countQuery = countQuery.gte('journal_headers.journal_date', filter.date_from)
      }
      
      if (filter.date_to) {
        query = query.lte('journal_headers.journal_date', filter.date_to)
        countQuery = countQuery.lte('journal_headers.journal_date', filter.date_to)
      }
      
      if (filter.search) {
        const search = `%${filter.search}%`
        query = query.or(
          `description.ilike.${search},journal_headers.journal_number.ilike.${search}`
        )
        countQuery = countQuery.or(
          `description.ilike.${search},journal_headers.journal_number.ilike.${search}`
        )
      }
    }
    
    // Default sort: accounting-friendly
    if (sort) {
      const ascending = sort.order === 'asc'
      switch (sort.field) {
        case 'journal_date':
          query = query.order('journal_date', { foreignTable: 'journal_headers', ascending })
          break
        case 'journal_number':
          query = query.order('journal_number', { foreignTable: 'journal_headers', ascending })
          break
        case 'account_code':
          query = query.order('account_code', { foreignTable: 'chart_of_accounts', ascending })
          break
        case 'amount':
          query = query.order('debit_amount', { ascending })
          break
        case 'created_at':
          query = query.order('created_at', { ascending })
          break
        case 'line_number':
        default:
          query = query.order('line_number', { ascending })
          break
      }
    } else {
      // Default: journal_date ASC, journal_number ASC, line_number ASC
      query = query
        .order('journal_date', { foreignTable: 'journal_headers', ascending: true })
        .order('journal_number', { foreignTable: 'journal_headers', ascending: true })
        .order('line_number', { ascending: true })
    }
    
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)
    
    // Transform to flat structure with computed fields
    const transformedData = (data || []).map(this.transformToWithDetails)
    
    return { data: transformedData, total: count || 0 }
  }

  async findById(id: string, companyId: string): Promise<JournalLineWithDetails | null> {
    const { data, error } = await supabase
      .from('journal_lines')
      .select(`
        *,
        journal_headers!inner(
          id,
          company_id,
          branch_id,
          journal_number,
          journal_date,
          journal_type,
          status,
          description,
          period,
          is_reversed,
          deleted_at
        ),
        chart_of_accounts!inner(
          account_code,
          account_name,
          account_type
        )
      `)
      .eq('id', id)
      .eq('journal_headers.company_id', companyId)
      .is('journal_headers.deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null

    return this.transformToWithDetails(data)
  }

  async findByJournalHeaderId(journalHeaderId: string, companyId: string): Promise<JournalLineWithDetails[]> {
    const { data, error } = await supabase
      .from('journal_lines')
      .select(`
        *,
        journal_headers!inner(
          id,
          company_id,
          branch_id,
          journal_number,
          journal_date,
          journal_type,
          status,
          description,
          period,
          is_reversed,
          deleted_at
        ),
        chart_of_accounts!inner(
          account_code,
          account_name,
          account_type
        )
      `)
      .eq('journal_header_id', journalHeaderId)
      .eq('journal_headers.company_id', companyId)
      .is('journal_headers.deleted_at', null)
      .order('line_number', { ascending: true })

    if (error) throw new Error(error.message)

    return (data || []).map(this.transformToWithDetails)
  }

  async findByAccountId(
    accountId: string,
    companyId: string,
    filter?: JournalLineFilter
  ): Promise<JournalLineWithDetails[]> {
    let query = supabase
      .from('journal_lines')
      .select(`
        *,
        journal_headers!inner(
          id,
          company_id,
          branch_id,
          journal_number,
          journal_date,
          journal_type,
          status,
          description,
          period,
          is_reversed,
          deleted_at
        ),
        chart_of_accounts!inner(
          account_code,
          account_name,
          account_type
        )
      `)
      .eq('account_id', accountId)
      .eq('journal_headers.company_id', companyId)
    
    // Default: only posted, not reversed, not deleted
    if (filter?.journal_status === 'POSTED_ONLY' || !filter?.journal_status) {
      query = query.eq('journal_headers.status', 'POSTED')
    }
    
    if (!filter?.include_reversed) {
      query = query.eq('journal_headers.is_reversed', false)
    }
    
    if (!filter?.show_deleted) {
      query = query.is('journal_headers.deleted_at', null)
    }
    
    if (filter?.date_from) {
      query = query.gte('journal_headers.journal_date', filter.date_from)
    }
    
    if (filter?.date_to) {
      query = query.lte('journal_headers.journal_date', filter.date_to)
    }
    
    // Accounting-friendly sort
    query = query
      .order('journal_date', { foreignTable: 'journal_headers', ascending: true })
      .order('journal_number', { foreignTable: 'journal_headers', ascending: true })
      .order('line_number', { ascending: true })

    const { data, error } = await query

    if (error) throw new Error(error.message)

    return (data || []).map(this.transformToWithDetails)
  }

  /**
   * Transform Supabase nested result to flat structure with computed fields
   */
  private transformToWithDetails(row: any): JournalLineWithDetails {
    const jh = row.journal_headers
    const coa = row.chart_of_accounts
    
    return {
      id: row.id,
      journal_header_id: row.journal_header_id,
      line_number: row.line_number,
      account_id: row.account_id,
      description: row.description,
      
      debit_amount: row.debit_amount,
      credit_amount: row.credit_amount,
      
      // Computed semantic fields
      is_debit: row.debit_amount > 0,
      amount: row.debit_amount > 0 ? row.debit_amount : row.credit_amount,
      
      currency: row.currency,
      exchange_rate: row.exchange_rate,
      base_debit_amount: row.base_debit_amount,
      base_credit_amount: row.base_credit_amount,
      
      cost_center_id: row.cost_center_id,
      project_id: row.project_id,
      
      created_at: row.created_at,
      updated_at: row.updated_at,
      
      // Account info
      account_code: coa.account_code,
      account_name: coa.account_name,
      account_type: coa.account_type,
      
      // Journal info
      journal_number: jh.journal_number,
      journal_date: jh.journal_date,
      journal_type: jh.journal_type,
      journal_status: jh.status,
      journal_description: jh.description,
      period: jh.period,
      
      // Posting state (derived from journal_status)
      is_reversed: jh.is_reversed,
      
      branch_id: jh.branch_id
    }
  }
}

export const journalLinesRepository = new JournalLinesRepository()
