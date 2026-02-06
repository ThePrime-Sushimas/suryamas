/**
 * Bank Statement Import Repository
 * Database operations untuk bank statement imports dan statements
 */

import { supabase } from '../../../config/supabase'
import { 
  BankStatementImport, 
  BankStatement, 
  CreateBankStatementImportDto,
  UpdateBankStatementImportDto,
  CreateBankStatementDto,
  BankStatementImportFilterParams,
  BankStatementFilterParams
} from './bank-statement-import.types'
import { BankStatementImportErrors } from './bank-statement-import.errors'
import { logError } from '../../../config/logger'

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class BankStatementImportRepository {
  /**
   * Create new import record
   */
  async create(data: CreateBankStatementImportDto): Promise<BankStatementImport | null> {
    const { data: result, error } = await supabase
      .from('bank_statement_imports')
      .insert({
        company_id: data.company_id,
        bank_account_id: data.bank_account_id,
        file_name: data.file_name,
        file_size: data.file_size,
        file_hash: data.file_hash,
        status: 'PENDING',
        total_rows: 0,
        processed_rows: 0,
        failed_rows: 0,
        created_by: data.created_by
      })
      .select()
      .single()

    if (error) {
      logError('BankStatementImportRepository.create error', { error: error.message })
      throw BankStatementImportErrors.CREATE_FAILED()
    }

    return result as BankStatementImport
  }

  /**
   * Find import by ID
   */
  async findById(id: number): Promise<BankStatementImport | null> {
    const { data, error } = await supabase
      .from('bank_statement_imports')
      .select(`
        *,
        bank_accounts:bank_account_id (
          account_name,
          account_number,
          banks:bank_id (
            bank_name
          )
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      logError('BankStatementImportRepository.findById error', { id, error: error.message })
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(id)
    }

    // Transform to include bank account fields at top level
    const transformed = {
      ...data,
      bank_name: data.bank_accounts?.banks?.bank_name || null,
      account_number: data.bank_accounts?.account_number || null,
      account_name: data.bank_accounts?.account_name || null,
    }

    return transformed as BankStatementImport | null
  }

  /**
   * Find all imports dengan pagination
   */
  async findAll(
    companyId: string,
    pagination: { page: number; limit: number },
    filter?: BankStatementImportFilterParams
  ): Promise<{ data: BankStatementImport[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit

    let query = supabase
      .from('bank_statement_imports')
      .select(`
        *,
        bank_accounts:bank_account_id (
          account_name,
          account_number,
          banks:bank_id (
            bank_name
          )
        )
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.limit - 1)

    if (filter?.bank_account_id) {
      query = query.eq('bank_account_id', filter.bank_account_id)
    }
    if (filter?.status) {
      query = query.eq('status', filter.status)
    }
    if (filter?.date_from) {
      query = query.gte('created_at', filter.date_from)
    }
    if (filter?.date_to) {
      query = query.lte('created_at', filter.date_to)
    }
    if (filter?.search) {
      query = query.ilike('file_name', `%${filter.search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      logError('BankStatementImportRepository.findAll error', { error: error.message })
      throw new Error(error.message)
    }

    // Transform data to include bank account fields at top level
    const transformedData = (data || []).map((item: any) => ({
      ...item,
      bank_name: item.bank_accounts?.banks?.bank_name || null,
      account_number: item.bank_accounts?.account_number || null,
      account_name: item.bank_accounts?.account_name || null,
    }))

    return {
      data: transformedData as BankStatementImport[],
      total: count || 0
    }
  }

  /**
   * Update import record
   */
  async update(id: number, data: UpdateBankStatementImportDto): Promise<BankStatementImport | null> {
    const { data: result, error } = await supabase
      .from('bank_statement_imports')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logError('BankStatementImportRepository.update error', { id, error: error.message })
      throw BankStatementImportErrors.UPDATE_FAILED(id)
    }

    return result as BankStatementImport | null
  }

  /**
   * Update import progress
   */
  async updateProgress(id: number, processedRows: number, failedRows: number): Promise<void> {
    const { error } = await supabase
      .from('bank_statement_imports')
      .update({ processed_rows: processedRows, failed_rows: failedRows, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      logError('BankStatementImportRepository.updateProgress error', { id, error: error.message })
    }
  }

  /**
   * Soft delete import
   */
  async delete(id: number, userId: string): Promise<void> {
    // Try to update with deleted_by, but if column doesn't exist, just set deleted_at
    const { error } = await supabase
      .from('bank_statement_imports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    // If the update failed due to deleted_by column not existing, try without it
    if (error) {
      logError('BankStatementImportRepository.delete error', { id, error: error.message })
      // Try again with just deleted_at if the error mentions deleted_by
      if (error.message.includes('deleted_by')) {
        const { error: retryError } = await supabase
          .from('bank_statement_imports')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
        
        if (retryError) {
          logError('BankStatementImportRepository.delete retry error', { id, error: retryError.message })
          throw BankStatementImportErrors.DELETE_FAILED(id)
        }
        return
      }
      throw BankStatementImportErrors.DELETE_FAILED(id)
    }
  }

  /**
   * Bulk insert bank statements
   * Filters out rows where both debit_amount and credit_amount are 0
   * to prevent constraint violation for chk_amount_not_both_zero
   */
  async bulkInsert(statements: CreateBankStatementDto[]): Promise<number> {
    if (statements.length === 0) return 0

    // Filter out rows where both debit_amount and credit_amount are 0
    // This prevents constraint violation for chk_amount_not_both_zero
    const validStatements = statements.filter(statement => {
      const debit = statement.debit_amount ?? 0
      const credit = statement.credit_amount ?? 0
      return debit !== 0 || credit !== 0
    })

    if (validStatements.length === 0) {
      logError('BankStatementImportRepository.bulkInsert: No valid statements to insert', {
        originalCount: statements.length,
      })
      return 0
    }

    // Log warning if some rows were filtered out
    if (validStatements.length < statements.length) {
      logError('BankStatementImportRepository.bulkInsert: Some rows filtered out', {
        originalCount: statements.length,
        validCount: validStatements.length,
        filteredCount: statements.length - validStatements.length,
      })
    }

    const { data, error } = await supabase
      .from('bank_statements')
      .insert(validStatements)
      .select('id')

    if (error) {
      logError('BankStatementImportRepository.bulkInsert error', { 
        error: error.message,
        statementCount: validStatements.length,
      })
      throw BankStatementImportErrors.IMPORT_FAILED()
    }

    return (data || []).length
  }

  /**
   * Find statements by import ID
   */
  async findByImportId(
    importId: number,
    pagination: { page: number; limit: number }
  ): Promise<{ data: BankStatement[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit

    const { data, error, count } = await supabase
      .from('bank_statements')
      .select('*', { count: 'exact' })
      .eq('import_id', importId)
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false })
      .order('row_number', { ascending: true })
      .range(offset, offset + pagination.limit - 1)

    if (error) {
      logError('BankStatementImportRepository.findByImportId error', { importId, error: error.message })
      throw new Error(error.message)
    }

    return { data: (data || []) as BankStatement[], total: count || 0 }
  }

  /**
   * Find statements dengan filters
   */
  async findStatements(
    companyId: string,
    pagination: { page: number; limit: number },
    filter?: BankStatementFilterParams
  ): Promise<{ data: BankStatement[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit

    let query = supabase
      .from('bank_statements')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false })
      .range(offset, offset + pagination.limit - 1)

    if (filter?.bank_account_id) query = query.eq('bank_account_id', filter.bank_account_id)
    if (filter?.transaction_date_from) query = query.gte('transaction_date', filter.transaction_date_from)
    if (filter?.transaction_date_to) query = query.lte('transaction_date', filter.transaction_date_to)
    if (filter?.is_reconciled !== undefined) query = query.eq('is_reconciled', filter.is_reconciled)
    if (filter?.transaction_type) query = query.eq('transaction_type', filter.transaction_type)
    if (filter?.import_id) query = query.eq('import_id', filter.import_id)
    if (filter?.search) query = query.or(`description.ilike.%${filter.search}%,reference_number.ilike.%${filter.search}%`)

    const { data, error, count } = await query

    if (error) {
      logError('BankStatementImportRepository.findStatements error', { error: error.message })
      throw new Error(error.message)
    }

    return { data: (data || []) as BankStatement[], total: count || 0 }
  }

  /**
   * Check for duplicate file hash (including soft-deleted records)
   * Returns the record if found (including deleted ones), null if not found
   */
  async checkFileHashExistsIncludingDeleted(fileHash: string, companyId: string): Promise<BankStatementImport | null> {
    const { data, error } = await supabase
      .from('bank_statement_imports')
      .select('*')
      .eq('file_hash', fileHash)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)

    // Handle case where no records found (not an error)
    if (error) {
      // If it's a "PGRST116" error (no rows returned), that's actually okay
      if (error.message.includes('PGRST116') || error.message.includes('row')) {
        return null
      }
      logError('BankStatementImportRepository.checkFileHashExistsIncludingDeleted error', { error: error.message })
      return null
    }

    if (!data || data.length === 0) {
      return null
    }

    return data[0] as BankStatementImport | null
  }

  /**
   * Check for active (non-deleted) file hash
   */
  async checkFileHashExists(fileHash: string, companyId: string): Promise<BankStatementImport | null> {
    const { data, error } = await supabase
      .from('bank_statement_imports')
      .select('*')
      .eq('file_hash', fileHash)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)

    // Handle case where no records found (not an error)
    if (error) {
      // If it's a "PGRST116" error (no rows returned), that's actually okay
      if (error.message.includes('PGRST116') || error.message.includes('row')) {
        return null
      }
      logError('BankStatementImportRepository.checkFileHashExists error', { error: error.message })
      return null
    }

    if (!data || data.length === 0) {
      return null
    }

    return data[0] as BankStatementImport | null
  }

  /**
   * Check for duplicate transactions
   * Improved to handle empty reference_numbers and match by date + amount + description similarity
   */
  async checkDuplicates(transactions: { reference_number?: string; transaction_date: string; debit_amount: number; credit_amount: number; description?: string }[]): Promise<BankStatement[]> {
    if (transactions.length === 0) return []

    // Build conditions for duplicate checking
    // We check for exact matches on: date + debit + credit
    // Reference number is used if available, but not required
    const dateAmountPairs = transactions.map(t => ({
      transaction_date: t.transaction_date,
      debit_amount: t.debit_amount,
      credit_amount: t.credit_amount,
    }))

    // Remove duplicates from dateAmountPairs to reduce query size
    const uniquePairs = dateAmountPairs.filter((pair, index, self) =>
      index === self.findIndex(p => 
        p.transaction_date === pair.transaction_date &&
        p.debit_amount === pair.debit_amount &&
        p.credit_amount === pair.credit_amount
      )
    )

    // Query for each unique pair
    const allDuplicates: BankStatement[] = []
    
    for (const pair of uniquePairs) {
      const { data, error } = await supabase
        .from('bank_statements')
        .select('id, reference_number, transaction_date, credit_amount, debit_amount, import_id, description')
        .eq('transaction_date', pair.transaction_date)
        .eq('debit_amount', pair.debit_amount)
        .eq('credit_amount', pair.credit_amount)
        .is('deleted_at', null)
        .limit(50)

      if (error) {
        logError('BankStatementImportRepository.checkDuplicates error', { error: error.message, pair })
        continue
      }

      if (data && data.length > 0) {
        allDuplicates.push(...data as BankStatement[])
      }
    }

    // Remove duplicates from results
    const uniqueDuplicates = allDuplicates.filter((dup, index, self) =>
      index === self.findIndex(d => d.id === dup.id)
    )

    return uniqueDuplicates
  }

  /**
   * Get summary by import ID
   */
  async getSummaryByImportId(importId: number): Promise<{ total_statements: number; total_credit: number; total_debit: number; reconciled_count: number }> {
    const { data, error } = await supabase
      .from('bank_statements')
      .select('credit_amount, debit_amount, is_reconciled')
      .eq('import_id', importId)
      .is('deleted_at', null)

    if (error) {
      logError('BankStatementImportRepository.getSummaryByImportId error', { importId, error: error.message })
      throw new Error(error.message)
    }

    const statements = data || []
    return {
      total_statements: statements.length,
      total_credit: statements.reduce((sum, s) => sum + (s.credit_amount || 0), 0),
      total_debit: statements.reduce((sum, s) => sum + (s.debit_amount || 0), 0),
      reconciled_count: statements.filter(s => s.is_reconciled).length
    }
  }

  /**
   * Delete statements by import ID
   */
  async deleteByImportId(importId: number): Promise<void> {
    const { error } = await supabase
      .from('bank_statements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('import_id', importId)

    if (error) {
      logError('BankStatementImportRepository.deleteByImportId error', { importId, error: error.message })
    }
  }
}

export const bankStatementImportRepository = new BankStatementImportRepository()
