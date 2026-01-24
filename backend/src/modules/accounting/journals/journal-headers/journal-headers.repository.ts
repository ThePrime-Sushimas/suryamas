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
      .select('*, branches(branch_name)', { count: 'exact' })
      .eq('company_id', companyId)
    
    let countQuery = supabase
      .from('journal_headers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
    
    // Default: show only active (not deleted)
    // show_deleted=true: show all (including deleted)
    if (!filter?.show_deleted) {
      query = query.is('deleted_at', null)
      countQuery = countQuery.is('deleted_at', null)
    }
    
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
    
    if (sort) {
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
      branch_name: (item as any).branches?.branch_name || null
    }))
    
    return { data: mappedData, total: count || 0 }
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
    
    // Default: show only active (not deleted)
    if (!filter?.show_deleted) {
      query = query.is('deleted_at', null)
      countQuery = countQuery.is('deleted_at', null)
    }
    
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
    
    if (sort) {
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
      const branchName = item.branches?.branch_name || null
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
    
    return { data: mappedData, total: count || 0 }
  }

  async findById(id: string, includeDeleted: boolean = false): Promise<JournalHeaderWithLines | null> {
    let query = supabase
      .from('journal_headers')
      .select('*, branches(branch_name)')
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

    return { 
      ...header, 
      branch_name: (header as any).branches?.branch_name || null,
      lines: linesWithAccounts
    }
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
  }, userId: string): Promise<JournalHeaderWithLines> {
    const { lines, ...headerData } = data
    
    // Step 1: Insert header
    const { data: header, error: headerError } = await supabase
      .from('journal_headers')
      .insert({
        ...headerData,
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

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('journal_headers')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
  }

  /**
   * Get next sequence number for journal numbering
   * 
   * CONCURRENCY NOTE:
   * Race condition possible if 2 users create journal simultaneously.
   * DB unique constraint (company_id, journal_type, period, sequence_number)
   * will block duplicate. Second insert will fail and client should retry.
   */
  async getNextSequence(companyId: string, type: string, period: string): Promise<number> {
    const { data, error } = await supabase
      .from('journal_headers')
      .select('sequence_number')
      .eq('company_id', companyId)
      .eq('journal_type', type)
      .eq('period', period)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return (data?.sequence_number || 0) + 1
  }

  async markReversed(id: string, reversalJournalId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('journal_headers')
      .update({
        is_reversed: true,
        reversed_by: reversalJournalId, // NOTE: This is journal_id, not user_id (semantic naming issue acknowledged)
        reversal_date: new Date().toISOString(),
        reversal_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
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
