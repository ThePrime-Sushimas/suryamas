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
  BankStatementFilterParams,
  ImportJobParams,
  JobProgressUpdate,
} from './bank-statement-import.types'
import { BankStatementImportErrors } from './bank-statement-import.errors'
import { logError, logWarn, logInfo } from '../../../config/logger'
import { jobsRepository } from '@/modules/jobs'

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
    // Try to update with deleted_by first
    const { error } = await supabase
      .from('bank_statement_imports')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: userId 
      })
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
   * Bulk insert bank statements with validation
   * Filters out rows where both debit_amount and credit_amount are 0
   * to prevent constraint violation for chk_amount_not_both_zero
   */
  async bulkInsert(statements: CreateBankStatementDto[]): Promise<number> {
    if (statements.length === 0) return 0

    // Filter out rows where both debit_amount and credit_amount are 0
    // This prevents constraint violation for chk_amount_not_both_zero
    const validStatements = statements.filter(statement => {
      const debit = typeof statement.debit_amount === 'number' ? statement.debit_amount : 0
      const credit = typeof statement.credit_amount === 'number' ? statement.credit_amount : 0
      return debit > 0 || credit > 0
    })

    if (validStatements.length === 0) {
      logWarn('BankStatementImportRepository.bulkInsert: No valid statements to insert', {
        originalCount: statements.length,
      })
      return 0
    }

    // Log info if some rows were filtered out
    if (validStatements.length < statements.length) {
      logWarn('BankStatementImportRepository.bulkInsert: Some rows filtered out', {
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
      throw BankStatementImportErrors.IMPORT_FAILED(error.message)
    }

    return (data || []).length
  }

  /**
   * Bulk insert with detailed error tracking
   * Returns both successful count and failed rows for retry logic
   */
  async bulkInsertWithDetails(
    statements: CreateBankStatementDto[]
  ): Promise<{ inserted: number; failed: CreateBankStatementDto[] }> {
    if (statements.length === 0) {
      return { inserted: 0, failed: [] }
    }

    // Filter valid statements
    const validStatements: CreateBankStatementDto[] = []
    const failedStatements: CreateBankStatementDto[] = []

    statements.forEach(statement => {
      const debit = typeof statement.debit_amount === 'number' ? statement.debit_amount : 0
      const credit = typeof statement.credit_amount === 'number' ? statement.credit_amount : 0
      
      if (debit > 0 || credit > 0) {
        validStatements.push(statement)
      } else {
        failedStatements.push(statement)
      }
    })

    if (validStatements.length === 0) {
      return { inserted: 0, failed: statements }
    }

    // Try bulk insert first
    try {
      const { data, error } = await supabase
        .from('bank_statements')
        .insert(validStatements)
        .select('id')

      if (error) {
        logError('BankStatementImportRepository.bulkInsertWithDetails error', {
          error: error.message,
          statementCount: validStatements.length,
        })
        
        // If bulk insert fails, try individual inserts
        return this.insertIndividually(validStatements)
      }

      return { inserted: (data || []).length, failed: failedStatements }
    } catch (err) {
      // Fallback to individual inserts on unexpected error
      logError('BankStatementImportRepository.bulkInsertWithDetails unexpected error', {
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      return this.insertIndividually(validStatements)
    }
  }

  /**
   * Insert statements individually as fallback
   */
  private async insertIndividually(
    statements: CreateBankStatementDto[]
  ): Promise<{ inserted: number; failed: CreateBankStatementDto[] }> {
    let inserted = 0
    const failed: CreateBankStatementDto[] = []

    for (const statement of statements) {
      try {
        const { error } = await supabase
          .from('bank_statements')
          .insert(statement)
          .select('id')

        if (error) {
          failed.push(statement)
        } else {
          inserted++
        }
      } catch {
        failed.push(statement)
      }
    }

    if (failed.length > 0) {
      logWarn('BankStatementImportRepository: Some statements failed to insert', {
        attempted: statements.length,
        inserted,
        failed: failed.length,
      })
    }

    return { inserted, failed }
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
 async checkDuplicates(
    transactions: { reference_number?: string; transaction_date: string; debit_amount: number; credit_amount: number; description?: string; balance?: number; bank_account_id: number }[], 
    bankAccountId: number
  ): Promise<BankStatement[]> {
    if (transactions.length === 0) return []

    const dateAmountPairs = transactions.map(t => ({
      transaction_date: t.transaction_date,
      debit_amount: t.debit_amount,
      credit_amount: t.credit_amount,
      description: t.description || '',
      reference_number: t.reference_number || ''
    }))

    const uniquePairs = dateAmountPairs.filter((pair, index, self) =>
      index === self.findIndex(p => 
        p.transaction_date === pair.transaction_date &&
        p.debit_amount === pair.debit_amount &&
        p.credit_amount === pair.credit_amount
      )
    )

    const allDuplicates: BankStatement[] = []
    
    for (const pair of uniquePairs) {
      // ✅ FIXED: Add bank_account_id filter + company isolation
      let query = supabase
        .from('bank_statements')
        .select(`
          id, reference_number, transaction_date, credit_amount, debit_amount, 
          import_id, description, balance, bank_account_id
        `)
        .eq('transaction_date', pair.transaction_date)
        .eq('debit_amount', pair.debit_amount)
        .eq('credit_amount', pair.credit_amount)
        .eq('bank_account_id', bankAccountId)
        .is('deleted_at', null)
        .limit(20)


      // Add description OR reference condition
      // ✅ ENTITY FILTER: Skip noise keywords, use normalized desc
      if (pair.description && pair.description.trim()) {
        // Extract keywords AFTER removing noise (like duplicate-detector)
        const normalizedDesc = pair.description.toUpperCase()
          .replace(/BI-FAST|DB|BIAYA|TXN?X?|KE|ADMIN|FEE|TRANSFER|SETTLEMENT|SYSTEM|TRF/gi, '')
          .substring(0, 100)
        
        const descKeywords = normalizedDesc.split(' ').filter(Boolean).slice(0, 3)
        if (descKeywords.length > 0) {
          query = query.or(
            `description.ilike.%${descKeywords.join('%')}%,
             reference_number.eq.${pair.reference_number || ''}`
          )
        }
      } else if (pair.reference_number) {
        query = query.eq('reference_number', pair.reference_number)
      }

      const { data, error } = await query

      if (error) {
        logError('BankStatementImportRepository.checkDuplicates error', { error: error.message, pair })
        continue
      }

      allDuplicates.push(...(data as BankStatement[]))
    }

    const uniqueDuplicates = allDuplicates.filter((dup, index, self) =>
      index === self.findIndex(d => d.id === dup.id)
    )

    return uniqueDuplicates
  }

  /**
   * Calculate description similarity using simple string comparison
   * Returns value between 0 and 1 (1 = exact match)
   */
  private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    if (!desc1 || !desc2) return 0
    if (desc1 === desc2) return 1

    // Normalize descriptions
    const normalize = (s: string) => s
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
    
    const n1 = normalize(desc1)
    const n2 = normalize(desc2)

    if (n1 === n2) return 1

    // Calculate similarity using common substring approach
    const shorter = n1.length < n2.length ? n1 : n2
    const longer = n1.length < n2.length ? n2 : n1

    if (shorter.length === 0) return 0

    // Check if shorter is contained in longer
    if (longer.includes(shorter)) return 0.9

    // Calculate word overlap
    const words1 = new Set(shorter.split(' ').filter(w => w.length > 2))
    const words2 = longer.split(' ').filter(w => w.length > 2)
    
    if (words1.size === 0) return 0

    let matches = 0
    for (const word of words1) {
      if (words2.includes(word)) matches++
    }

    return matches / words1.size
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

  /**
   * Hard delete of an import record
   */
  async hardDelete(id: number): Promise<void> {
    const { error } = await supabase
      .from('bank_statement_imports')
      .delete()
      .eq('id', id)

    if (error) {
      logError('BankStatementImportRepository.hardDelete error', { id, error: error.message })
      throw new Error(`Failed to hard delete import: ${error.message}`)
    }
  }

  /**
   * Count existing statements in a date range
   */
  async countExistingStatements(
    companyId: string,
    bankAccountId: number,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const { count, error } = await supabase
      .from('bank_statements')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('bank_account_id', bankAccountId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .is('deleted_at', null)

    if (error) {
      logError('BankStatementImportRepository.countExistingStatements error', { companyId, bankAccountId, error: error.message })
      throw new Error(`Failed to count existing statements: ${error.message}`)
    }

    return count || 0
  }

  /**
   * Create background job record for import
   */
  async createImportJob(params: ImportJobParams): Promise<string> {
    const { data, error } = await supabase.rpc('create_job_atomic', {
      p_user_id: params.userId,
      p_company_id: params.companyId,
      p_type: 'import',
      p_module: 'bank_statements',
      p_name: `Import Bank Statement ${params.fileName}`,
      p_metadata: {
        importId: params.importId,
        bankAccountId: params.bankAccountId,
        companyId: params.companyId,
        skipDuplicates: params.skipDuplicates,
        totalRows: params.totalRows
      }
    })

    if (error) {
      logError('BankStatementImportRepository.createImportJob error', { error: error.message })
      throw new Error(`Failed to create job: ${error.message}`)
    }

    const jobId = (data as { id?: unknown } | null)?.id
    if (typeof jobId !== 'string' || jobId.length === 0) {
      logError('BankStatementImportRepository.createImportJob invalid response', { data })
      throw new Error('Failed to create job')
    }

    return jobId
  }

  /**
   * Update job progress payload
   */
  async updateJobProgress(
    jobId: string,
    progress: JobProgressUpdate
  ): Promise<void> {
    const percentage = Math.max(0, Math.min(100, Math.round(progress.percentage)))
    try {
      await jobsRepository.updateProgress(jobId, percentage)
    } catch (error: any) {
      logWarn('BankStatementImportRepository.updateJobProgress error', {
        jobId,
        percentage,
        error: error?.message || String(error)
      })
    }
  }

  /**
   * Get import file name (for source_file field)
   */
  async getImportFileName(importId: number): Promise<string> {
    const { data, error } = await supabase
      .from('bank_statement_imports')
      .select('file_name')
      .eq('id', importId)
      .maybeSingle()

    if (error) {
      logError('BankStatementImportRepository.getImportFileName error', { importId, error: error.message })
      throw new Error(`Failed to get import file name: ${error.message}`)
    }

    const fileName = (data as { file_name?: unknown } | null)?.file_name
    if (typeof fileName !== 'string' || fileName.length === 0) {
      throw new Error(`Import with ID ${importId} not found`)
    }

    return fileName
  }

  /**
   * Store temporary import rows to Supabase Storage
   */
  async uploadTemporaryData<T = any>(importId: number, rows: T[]): Promise<void> {
    const jsonData = JSON.stringify(rows)
    const bucket = 'bank-statement-imports-temp'
    const objectPath = `${importId}.json`

    const supabaseHost = (() => {
      try {
        const url = process.env.SUPABASE_URL
        if (!url) return null
        return new URL(url).host
      } catch {
        return null
      }
    })()

    // In Node, pass Buffer to avoid ambiguous string handling
    const body = Buffer.from(jsonData, 'utf8')
    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, body, {
        contentType: 'application/json',
        upsert: true
      })

    if (error) {
      logError('BankStatementImportRepository.uploadTemporaryData error', {
        importId,
        bucket,
        path: objectPath,
        supabase_host: supabaseHost,
        error_name: (error as any)?.name,
        error_message: (error as any)?.message,
        error_status: (error as any)?.statusCode ?? (error as any)?.status,
        error
      })
      throw error
    }

    // Postflight: verify object exists (best-effort, makes env mismatch obvious)
    try {
      const { data: listed, error: listErr } = await supabase.storage
        .from(bucket)
        .list('', { search: objectPath })
      if (listErr) {
        logWarn('BankStatementImportRepository.uploadTemporaryData verify list error', {
          importId,
          bucket,
          path: objectPath,
          supabase_host: supabaseHost,
          error_name: (listErr as any)?.name,
          error_message: (listErr as any)?.message,
          error: listErr
        })
      } else {
        const found = (listed || []).some(o => o.name === objectPath)
        if (!found) {
          logWarn('BankStatementImportRepository.uploadTemporaryData verify not found', {
            importId,
            bucket,
            path: objectPath,
            supabase_host: supabaseHost,
            listed_names_sample: (listed || []).slice(0, 5).map(o => o.name)
          })
        }
      }
    } catch (e) {
      logWarn('BankStatementImportRepository.uploadTemporaryData verify failed', {
        importId,
        bucket,
        path: objectPath,
        supabase_host: supabaseHost,
        error_string: String(e)
      })
    }

    logInfo('BankStatementImportRepository.uploadTemporaryData success', { importId, bucket, path: objectPath, supabase_host: supabaseHost })
  }

  /**
   * Retrieve temporary import rows from Supabase Storage
   */
  async downloadTemporaryData<T = any>(importId: number): Promise<T[]> {
    const objectPath = `${importId}.json`
    const bucket = 'bank-statement-imports-temp'
    const supabaseHost = (() => {
      try {
        const url = process.env.SUPABASE_URL
        if (!url) return null
        return new URL(url).host
      } catch {
        return null
      }
    })()

    // Preflight: check bucket existence to make errors actionable
    try {
      const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets()
      if (bucketErr) {
        logWarn('BankStatementImportRepository.downloadTemporaryData listBuckets error', {
          importId,
          bucket,
          path: objectPath,
          error_name: (bucketErr as any)?.name,
          error_message: (bucketErr as any)?.message,
          error: bucketErr
        })
      } else {
        const exists = buckets?.some(b => b.name === bucket) ?? false
        if (!exists) {
          logError('BankStatementImportRepository.downloadTemporaryData bucket missing', { importId, bucket })
          throw new Error(`Storage bucket not found: ${bucket}`)
        }
      }
    } catch (e) {
      // If listBuckets itself fails (permissions/env), keep original behavior but with better log
      logWarn('BankStatementImportRepository.downloadTemporaryData bucket preflight failed', {
        importId,
        bucket,
        path: objectPath,
        error_string: String(e)
      })
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .download(objectPath)

    if (error) {
      // Extra diagnostics: try list() to see if object exists (best-effort)
      try {
        const { data: listed, error: listErr } = await supabase.storage
          .from(bucket)
          .list('', { search: objectPath })
        if (listErr) {
          logWarn('BankStatementImportRepository.downloadTemporaryData list error', {
            importId,
            bucket,
            path: objectPath,
            error_name: (listErr as any)?.name,
            error_message: (listErr as any)?.message,
            error: listErr
          })
        } else {
          logWarn('BankStatementImportRepository.downloadTemporaryData list result', {
            importId,
            bucket,
            path: objectPath,
            found: (listed || []).some(o => o.name === objectPath),
            listed_names_sample: (listed || []).slice(0, 5).map(o => o.name)
          })
        }
      } catch (e) {
        logWarn('BankStatementImportRepository.downloadTemporaryData list diagnostic failed', {
          importId,
          bucket,
          path: objectPath,
          error_string: String(e)
        })
      }

      logError('BankStatementImportRepository.downloadTemporaryData error', {
        importId,
        bucket,
        path: objectPath,
        supabase_host: supabaseHost,
        error_name: (error as any)?.name,
        error_message: (error as any)?.message,
        error_status: (error as any)?.statusCode ?? (error as any)?.status,
        error_string: String(error),
        error_keys: error ? Object.getOwnPropertyNames(error as any) : [],
        original_error_string: String((error as any)?.originalError),
        original_error_keys: (error as any)?.originalError
          ? Object.getOwnPropertyNames((error as any).originalError)
          : [],
        error
      })
      throw error
    }

    const text = await data.text()
    return JSON.parse(text) as T[]
  }

  /**
   * Remove temporary import rows from Supabase Storage (reliable, 3x retry)
   */
  async removeTemporaryData(importId: number): Promise<boolean> {
    const objectPath = `${importId}.json`;
    const bucket = 'bank-statement-imports-temp';
    
    // Check bucket exists first
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === bucket);
      if (!bucketExists) {
        logWarn('Temp bucket does not exist, skipping cleanup', { importId, bucket });
        return false;
      }
    } catch (bucketCheckError) {
      logWarn('Bucket check failed, proceeding with cleanup anyway', { importId, error: String(bucketCheckError) });
    }

    // Retry logic: 3 attempts with exponential backoff
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { error } = await supabase.storage
          .from(bucket)
          .remove([objectPath]);

        if (!error) {
          logInfo('BankStatementImportRepository.removeTemporaryData success', { 
            importId, 
            attempt,
            path: objectPath 
          });
          return true;
        }

        lastError = error;
        logWarn(`Cleanup attempt ${attempt} failed`, { 
          importId, 
          path: objectPath, 
          error: error.message 
        });

        // Backoff: 100ms * attempt
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      } catch (retryError) {
        lastError = retryError;
        logWarn(`Cleanup retry ${attempt} threw error`, { importId, error: String(retryError) });
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      }
    }

    // Final failure log
    logError('BankStatementImportRepository.removeTemporaryData final failure after retries', {
      importId,
      path: objectPath,
      attempts: maxRetries,
      final_error: lastError?.message || String(lastError)
    });

    return false; // Failed but non-blocking
  }
}

export const bankStatementImportRepository = new BankStatementImportRepository()
