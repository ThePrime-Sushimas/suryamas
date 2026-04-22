import { supabase } from '../../../../config/supabase'
import { JournalHeader, JournalHeaderWithLines, CreateJournalDto, JournalFilter, SortParams } from './journal-headers.types'
import { JournalStatus } from '../shared/journal.types'
import { logError, logInfo } from '../../../../config/logger'

export class JournalHeadersRepository {
  
  async findAll(
    companyId: string,
    pagination: { limit: number; offset: number },
    sort?: SortParams,
    filter?: JournalFilter
  ): Promise<{ data: JournalHeader[]; total: number }> {
    let query = supabase
      .from('journal_headers')
      .select('*, branches(branch_name), companies(company_name)', { count: 'exact' })
      .eq('company_id', companyId)
    
    let countQuery = supabase
      .from('journal_headers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
    
    // Use helper for consistent deleted filter
    query = this.applyDeletedFilter(query, filter)
    countQuery = this.applyDeletedFilter(countQuery, filter)
    
    if (filter) {
      if (filter.branch_id) {
        query = query.eq('branch_id', filter.branch_id)
        countQuery = countQuery.eq('branch_id', filter.branch_id)
      }
      if (filter.journal_type) {
        query = query.eq('journal_type', filter.journal_type)
        countQuery = countQuery.eq('journal_type', filter.journal_type)
      }
      if (filter.status) {
        query = query.eq('status', filter.status)
        countQuery = countQuery.eq('status', filter.status)
      }
      if (filter.date_from) {
        query = query.gte('journal_date', filter.date_from)
        countQuery = countQuery.gte('journal_date', filter.date_from)
      }
      if (filter.date_to) {
        query = query.lte('journal_date', filter.date_to)
        countQuery = countQuery.lte('journal_date', filter.date_to)
      }
      if (filter.period) {
        query = query.eq('period', filter.period)
        countQuery = countQuery.eq('period', filter.period)
      }
      if (filter.search) {
        query = query.or(`journal_number.ilike.%${filter.search}%,description.ilike.%${filter.search}%`)
        countQuery = countQuery.or(`journal_number.ilike.%${filter.search}%,description.ilike.%${filter.search}%`)
      }
    }
    
    // Deleted sorting: newest deleted first
    if (filter?.show_deleted) {
      query = query.order('deleted_at', { ascending: false })
    } else if (sort) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      query = query.order('journal_date', { ascending: false })
    }
    
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)
    
    // Map branch_name from nested object
    const mappedData = (data || []).map(item => ({
      ...item,
      branch_name: (item as any).branches?.branch_name || (item as any).companies?.company_name || null
    }))
    
    return { data: await this.populateNames(mappedData), total: count || 0 }
  }

  async findAllWithLines(
    companyId: string,
    pagination: { limit: number; offset: number },
    sort?: SortParams,
    filter?: JournalFilter
  ): Promise<{ data: JournalHeaderWithLines[]; total: number }> {
    let query = supabase
      .from('journal_headers')
      .select(`
        *,
        branches(branch_name),
        companies(company_name),
        journal_lines (
          *,
          chart_of_accounts!inner(
            account_code,
            account_name,
            account_type
          )
        )
      `, { count: 'exact' })
      .eq('company_id', companyId)
    
    let countQuery = supabase
      .from('journal_headers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
    
    // Use helper for consistent deleted filter
    query = this.applyDeletedFilter(query, filter)
    countQuery = this.applyDeletedFilter(countQuery, filter)
    
    if (filter) {
      if (filter.branch_id) {
        query = query.eq('branch_id', filter.branch_id)
        countQuery = countQuery.eq('branch_id', filter.branch_id)
      }
      if (filter.journal_type) {
        query = query.eq('journal_type', filter.journal_type)
        countQuery = countQuery.eq('journal_type', filter.journal_type)
      }
      if (filter.status) {
        query = query.eq('status', filter.status)
        countQuery = countQuery.eq('status', filter.status)
      }
      if (filter.date_from) {
        query = query.gte('journal_date', filter.date_from)
        countQuery = countQuery.gte('journal_date', filter.date_from)
      }
      if (filter.date_to) {
        query = query.lte('journal_date', filter.date_to)
        countQuery = countQuery.lte('journal_date', filter.date_to)
      }
      if (filter.period) {
        query = query.eq('period', filter.period)
        countQuery = countQuery.eq('period', filter.period)
      }
      if (filter.search) {
        query = query.or(`journal_number.ilike.%${filter.search}%,description.ilike.%${filter.search}%`)
        countQuery = countQuery.or(`journal_number.ilike.%${filter.search}%,description.ilike.%${filter.search}%`)
      }
    }
    
    // Deleted sorting: newest deleted first  
    if (filter?.show_deleted) {
      query = query.order('deleted_at', { ascending: false })
    } else if (sort) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      query = query.order('journal_date', { ascending: false })
    }
    
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)
    
    // Process and flatten the data
    const mappedData = (data || []).map((item: any) => {
      const branchName = item.branches?.branch_name || item.companies?.company_name || null
      const lines = (item.journal_lines || []).map((line: any) => ({
        ...line,
        account_code: line.chart_of_accounts?.account_code,
        account_name: line.chart_of_accounts?.account_name,
        account_type: line.chart_of_accounts?.account_type
      }))
      
      return {
        ...item,
        branch_name: branchName,
        lines: lines
      }
    })
    
    return { data: await this.populateNames(mappedData), total: count || 0 }
  }

  async findById(id: string, includeDeleted: boolean = false): Promise<JournalHeaderWithLines | null> {
    let query = supabase
      .from('journal_headers')
      .select('*, branches(branch_name), companies(company_name)')
      .eq('id', id)
    
    if (!includeDeleted) {
      query = query.is('deleted_at', null)
    }
    
    const { data: header, error: headerError } = await query.maybeSingle()

    if (headerError) throw new Error(headerError.message)
    if (!header) return null

    const { data: lines, error: linesError } = await supabase
      .from('journal_lines')
      .select(`
        *,
        chart_of_accounts!inner(
          account_code,
          account_name,
          account_type
        )
      `)
      .eq('journal_header_id', id)
      .order('line_number')

    if (linesError) throw new Error(linesError.message)

    // Flatten account data into line object
    const linesWithAccounts = (lines || []).map(line => {
      const account = (line as any).chart_of_accounts
      return {
        ...line,
        account_code: account?.account_code,
        account_name: account?.account_name,
        account_type: account?.account_type
      }
    })

    const result = { 
      ...header, 
      branch_name: (header as any).branches?.branch_name || (header as any).companies?.company_name || null,
      lines: linesWithAccounts
    }

    const [populated] = await this.populateNames([result])
    return populated
  }

  private async populateNames(data: any[]): Promise<any[]> {
    if (!data.length) return data

    const ids = new Set<string>()
    data.forEach(item => {
      if (item.created_by) ids.add(item.created_by)
      if (item.updated_by) ids.add(item.updated_by)
      if (item.submitted_by) ids.add(item.submitted_by)
      if (item.approved_by) ids.add(item.approved_by)
      if (item.posted_by) ids.add(item.posted_by)
      if (item.rejected_by) ids.add(item.rejected_by)
      if (item.reversed_by) ids.add(item.reversed_by)
      if (item.deleted_by) ids.add(item.deleted_by)
    })

    const idList = Array.from(ids).filter(Boolean)
    if (idList.length === 0) return data

    // Fetch employees checking BOTH id and user_id columns to be exhaustive
    // Using two queries to avoid potential complex OR query issues with Supabase filters
    const [{ data: byId }, { data: byUserId }] = await Promise.all([
      supabase.from('employees').select('id, full_name').in('id', idList),
      supabase.from('employees').select('user_id, full_name').in('user_id', idList)
    ])

    const nameMap = new Map<string, string>()
    byId?.forEach(emp => nameMap.set(emp.id, emp.full_name))
    byUserId?.forEach(emp => {
      if (emp.user_id) nameMap.set(emp.user_id, emp.full_name)
    })

    return data.map(item => ({
      ...item,
      created_by_name: (item.created_by && nameMap.get(item.created_by)) || null,
      updated_by_name: (item.updated_by && nameMap.get(item.updated_by)) || null,
      submitted_by_name: (item.submitted_by && nameMap.get(item.submitted_by)) || null,
      approved_by_name: (item.approved_by && nameMap.get(item.approved_by)) || null,
      posted_by_name: (item.posted_by && nameMap.get(item.posted_by)) || null,
      rejected_by_name: (item.rejected_by && nameMap.get(item.rejected_by)) || null,
      reversed_by_name: (item.reversed_by && nameMap.get(item.reversed_by)) || null,
      deleted_by_name: (item.deleted_by && nameMap.get(item.deleted_by)) || null,
    }))
  }


  /**
   * Create journal with compensating transaction pattern
   * 
   * NOTE: Supabase JS client doesn't support native transactions.
   * This uses compensating transaction pattern (manual rollback on error).
   * This is an accepted pattern in Supabase projects.
   * 
   * Flow:
   * 1. Insert header
   * 2. Insert lines
   * 3. If lines fail → manually delete header
   */
  async create(data: CreateJournalDto & { 
    journal_number: string
    sequence_number: number
    period: string
    total_debit: number
    total_credit: number
    status: JournalStatus
    reversal_of_journal_id?: string
  }, userId: string): Promise<JournalHeaderWithLines> {
    const { lines, ...headerData } = data
    
    // Step 1: Insert header
    const { data: header, error: headerError } = await supabase
      .from('journal_headers')
      .insert({
        ...headerData,
        reversal_of_journal_id: data.reversal_of_journal_id,
        created_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (headerError) {
      logError('Failed to create journal header', { error: headerError.message })
      throw new Error(headerError.message)
    }

    // Step 2: Insert lines
    const linesWithHeaderId = lines.map(line => ({
      ...line,
      journal_header_id: header.id,
      currency: data.currency || 'IDR',
      exchange_rate: data.exchange_rate || 1,
      base_debit_amount: line.debit_amount * (data.exchange_rate || 1),
      base_credit_amount: line.credit_amount * (data.exchange_rate || 1),
      created_at: new Date().toISOString()
    }))

    const { data: createdLines, error: linesError } = await supabase
      .from('journal_lines')
      .insert(linesWithHeaderId)
      .select()

    // Step 3: Compensating transaction - rollback if lines fail
    if (linesError) {
      await supabase.from('journal_headers').delete().eq('id', header.id)
      logError('Failed to create journal lines, header rolled back', { 
        error: linesError.message,
        header_id: header.id 
      })
      throw new Error(linesError.message)
    }

    logInfo('Journal created', { journal_id: header.id, journal_number: header.journal_number })
    return { ...header, lines: createdLines || [] }
  }

  async update(id: string, data: Partial<JournalHeader>, userId: string): Promise<JournalHeader> {
    const { data: updated, error } = await supabase
      .from('journal_headers')
      .update({
        ...data,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return updated
  }

  async updateStatus(id: string, status: JournalStatus, userId: string, timestamps?: Record<string, any>): Promise<void> {
    const updateData: any = {
      status,
      updated_by: userId,
      updated_at: new Date().toISOString(),
      ...timestamps
    }

    const { error } = await supabase
      .from('journal_headers')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)

    if (error) throw new Error(error.message)
  }

  async delete(id: string, _userId: string): Promise<void> {
    await supabase.from('journal_lines').delete().eq('journal_header_id', id)

    const { error } = await supabase
      .from('journal_headers')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  }

  /**
   * Get next sequence number ATOMIC using UPSERT
   * 100% race-condition proof
   */
  async getNextSequence(companyId: string, type: string, period: string): Promise<number> {
    const { data, error } = await supabase
.rpc('get_next_journal_sequence', {
  p_company_id: companyId,
  p_period: period,
  p_journal_type: type
})

    if (error) {
      logError('Sequence generation failed', { error: error.message, companyId, type, period })
      throw new Error(`Sequence generation failed: ${error.message}`)
    }
    
    return data as number
  }

  async markReversed(id: string, reversalJournalId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('journal_headers')
      .update({
        is_reversed: true,
        reversed_by_journal_id: reversalJournalId,
        reversal_date: new Date().toISOString(),
        reversal_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
  }

  private applyDeletedFilter(query: any, filter?: JournalFilter) {
    if (filter?.show_deleted) {
      return query.not('deleted_at', 'is', null)
    }
    return query.is('deleted_at', null)
  }

  async restore(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('journal_headers')
      .update({
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
  }

  /**
   * Update journal lines (delete old, insert new)
   * 
   * WARNING: Uses destructive replace pattern.
   * If insert fails after delete, journal will have no lines.
   * This is acceptable for DRAFT journals only.
   */
  async updateLines(journalHeaderId: string, lines: any[]): Promise<void> {
    // Step 1: Delete old lines
    const { error: deleteError } = await supabase
      .from('journal_lines')
      .delete()
      .eq('journal_header_id', journalHeaderId)

    if (deleteError) {
      logError('Failed to delete old journal lines', { error: deleteError.message })
      throw new Error(deleteError.message)
    }

    // Step 2: Insert new lines
    const { error: insertError } = await supabase
      .from('journal_lines')
      .insert(lines)

    if (insertError) {
      logError('Failed to insert new journal lines - journal now has no lines', { 
        error: insertError.message,
        journal_header_id: journalHeaderId
      })
      throw new Error(insertError.message)
    }
  }
}

export const journalHeadersRepository = new JournalHeadersRepository()
