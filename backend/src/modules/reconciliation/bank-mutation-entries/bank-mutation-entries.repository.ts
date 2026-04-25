import { supabase } from '../../../config/supabase'
import { logError } from '../../../config/logger'
import type { BankMutationEntryRow, BankMutationEntryStatus, BankMutationEntryType } from './bank-mutation-entries.types'
import { BankMutationEntryNotFoundError, BankMutationEntryDatabaseError } from './bank-mutation-entries.errors'

export class BankMutationEntriesRepository {

  async create(data: {
    companyId: string
    entryDate: string
    entryType: BankMutationEntryType
    description: string
    amount: number
    referenceNumber?: string
    bankAccountId?: number
    coaId: string
    coaCode?: string
    coaName?: string
    bankStatementId: string
    reconciledBy?: string
    notes?: string
    createdBy?: string
  }): Promise<BankMutationEntryRow> {
    const now = new Date().toISOString()
    const { data: row, error } = await supabase
      .from('bank_mutation_entries')
      .insert({
        company_id: data.companyId,
        entry_date: data.entryDate,
        entry_type: data.entryType,
        description: data.description,
        amount: data.amount,
        reference_number: data.referenceNumber || null,
        bank_account_id: data.bankAccountId || null,
        coa_id: data.coaId,
        coa_code: data.coaCode || null,
        coa_name: data.coaName || null,
        bank_statement_id: data.bankStatementId,
        is_reconciled: true,
        reconciled_at: now,
        reconciled_by: data.reconciledBy || null,
        notes: data.notes || null,
        created_by: data.createdBy || null,
        updated_by: data.createdBy || null,
      })
      .select('*')
      .single()

    if (error) {
      logError('Failed to create bank mutation entry', { error: error.message })
      throw new BankMutationEntryDatabaseError('create', error.message)
    }
    return row
  }

  async findById(id: string, companyId: string): Promise<BankMutationEntryRow | null> {
    const { data, error } = await supabase
      .from('bank_mutation_entries')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      logError('Failed to find bank mutation entry', { id, error: error.message })
      throw new BankMutationEntryDatabaseError('find', error.message)
    }
    return data
  }

  async findByIdOrThrow(id: string, companyId: string): Promise<BankMutationEntryRow> {
    const row = await this.findById(id, companyId)
    if (!row) throw new BankMutationEntryNotFoundError(id)
    return row
  }

  async findByBankStatementId(bankStatementId: string): Promise<BankMutationEntryRow | null> {
    const { data, error } = await supabase
      .from('bank_mutation_entries')
      .select('*')
      .eq('bank_statement_id', bankStatementId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      logError('Failed to find mutation entry by statement', { bankStatementId, error: error.message })
      throw new BankMutationEntryDatabaseError('find_by_statement', error.message)
    }
    return data
  }

  async list(filter: {
    companyId: string
    bankAccountId?: number
    entryType?: BankMutationEntryType
    status?: BankMutationEntryStatus
    isReconciled?: boolean
    dateFrom?: string
    dateTo?: string
    search?: string
    limit: number
    offset: number
  }): Promise<{ data: BankMutationEntryRow[]; total: number }> {
    let query = supabase
      .from('bank_mutation_entries')
      .select('*', { count: 'exact' })
      .eq('company_id', filter.companyId)
      .is('deleted_at', null)

    if (filter.bankAccountId) query = query.eq('bank_account_id', filter.bankAccountId)
    if (filter.entryType) query = query.eq('entry_type', filter.entryType)
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.isReconciled !== undefined) query = query.eq('is_reconciled', filter.isReconciled)
    if (filter.dateFrom) query = query.gte('entry_date', filter.dateFrom)
    if (filter.dateTo) query = query.lte('entry_date', filter.dateTo)
    if (filter.search) {
      const term = `%${filter.search}%`
      query = query.or(`description.ilike.${term},reference_number.ilike.${term}`)
    }

    const { data, count, error } = await query
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(filter.offset, filter.offset + filter.limit - 1)

    if (error) {
      logError('Failed to list bank mutation entries', { error: error.message })
      throw new BankMutationEntryDatabaseError('list', error.message)
    }
    return { data: data || [], total: count || 0 }
  }

  async updateJournalHeaderId(id: string, journalHeaderId: string): Promise<void> {
    const { error } = await supabase
      .from('bank_mutation_entries')
      .update({ journal_header_id: journalHeaderId, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      logError('Failed to update journal_header_id', { id, error: error.message })
      throw new BankMutationEntryDatabaseError('update_journal', error.message)
    }
  }

  async voidEntry(id: string, reason: string, userId: string): Promise<void> {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('bank_mutation_entries')
      .update({
        status: 'VOIDED',
        is_reconciled: false,
        void_reason: reason,
        voided_at: now,
        voided_by: userId,
        updated_at: now,
        updated_by: userId,
      })
      .eq('id', id)

    if (error) {
      logError('Failed to void bank mutation entry', { id, error: error.message })
      throw new BankMutationEntryDatabaseError('void', error.message)
    }
  }

  async linkBankStatement(bankStatementId: string, mutationEntryId: string, userId?: string): Promise<void> {
    const updateData: Record<string, unknown> = {
      is_reconciled: true,
      is_pending: false,
      bank_mutation_entry_id: mutationEntryId,
      updated_at: new Date().toISOString(),
    }
    if (userId) updateData.updated_by = userId

    const { error } = await supabase
      .from('bank_statements')
      .update(updateData)
      .eq('id', bankStatementId)

    if (error) {
      logError('Failed to link bank statement to mutation entry', { bankStatementId, error: error.message })
      throw new BankMutationEntryDatabaseError('link_statement', error.message)
    }
  }

  async unlinkBankStatement(bankStatementId: string, userId?: string): Promise<void> {
    const updateData: Record<string, unknown> = {
      is_reconciled: false,
      bank_mutation_entry_id: null,
      updated_at: new Date().toISOString(),
    }
    if (userId) updateData.updated_by = userId

    const { error } = await supabase
      .from('bank_statements')
      .update(updateData)
      .eq('id', bankStatementId)

    if (error) {
      logError('Failed to unlink bank statement', { bankStatementId, error: error.message })
      throw new BankMutationEntryDatabaseError('unlink_statement', error.message)
    }
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('bank_mutation_entries')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)

    if (error) {
      logError('Failed to soft delete bank mutation entry', { id, error: error.message })
      throw new BankMutationEntryDatabaseError('delete', error.message)
    }
  }

  async getBankAccountCoaId(bankAccountId: number): Promise<string | null> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('coa_id')
      .eq('id', bankAccountId)
      .maybeSingle()

    if (error) {
      logError('Failed to get bank account COA', { bankAccountId, error: error.message })
      return null
    }
    return data?.coa_id || null
  }
}

export const bankMutationEntriesRepository = new BankMutationEntriesRepository()
