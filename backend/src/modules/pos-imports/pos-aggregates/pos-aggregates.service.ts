import { supabase } from '../../../config/supabase'
import { posAggregatesRepository } from './pos-aggregates.repository'
import { posImportLinesRepository } from '../pos-import-lines/pos-import-lines.repository'
import { 
  AggregatedTransaction, 
  AggregatedTransactionWithDetails,
  AggregatedTransactionFilterParams,
  AggregatedTransactionSortParams,
  AggregatedTransactionStatus,
  AggregatedTransactionSourceType,
  CreateAggregatedTransactionDto,
  UpdateAggregatedTransactionDto,
  AggregatedTransactionSummary,
  AggregatedTransactionBatchResult,
  GenerateJournalRequestDto,
  GenerateJournalPerDateDto
} from './pos-aggregates.types'
import { 
  AggregatedTransactionErrors 
} from './pos-aggregates.errors'
import { getPaginationParams, createPaginatedResponse } from '../../../utils/pagination.util'
import { logInfo, logError } from '../../../config/logger'

export class PosAggregatesService {
  /**
   * Validate that company exists and is active
   */
  private async validateCompany(companyId: string): Promise<void> {
    const { data, error } = await supabase
      .from('companies')
      .select('id, status')
      .eq('id', companyId)
      .maybeSingle()

    if (error) throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to validate company', error)
    if (!data) throw AggregatedTransactionErrors.COMPANY_NOT_FOUND(companyId)
    if ((data as any).status === 'closed') {
      throw AggregatedTransactionErrors.COMPANY_INACTIVE(companyId)
    }
  }

/**
   * Validate that branch exists (if provided)
   * Note: branchId can be either UUID (id) or branch name (string)
   */
  private async validateBranch(branchId: string | null, companyId?: string): Promise<void> {
    if (!branchId) return

    // Check if branchId is a valid UUID (5fdd0a7b-etc format)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)

    let query = supabase
      .from('branches')
      .select('id, status')

    if (isUuid) {
      // Query by UUID id
      query = query.eq('id', branchId)
    } else {
      // Query by branch_name (string)
      query = query.eq('branch_name', branchId.trim())
    }

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to validate branch', error)
    if (!data) throw AggregatedTransactionErrors.BRANCH_NOT_FOUND(branchId)
    if ((data as any).status !== 'active') {
      throw AggregatedTransactionErrors.BRANCH_INACTIVE(branchId)
    }
  }

/**
   * Find branch by name within a company
   * Note: Uses case-insensitive search to handle differences in branch name capitalization
   */
  private async findBranchByName(companyId: string, branchName: string): Promise<{ id: string; branch_name: string } | null> {
    // Normalize branch name: trim + collapse multiple spaces to single space
    const normalizedBranchName = branchName.trim().replace(/\s+/g, ' ')
    
    // Try exact match first (case-insensitive via ilike)
    const { data, error } = await supabase
      .from('branches')
      .select('id, branch_name')
      .eq('company_id', companyId)
      .ilike('branch_name', normalizedBranchName)
      .eq('status', 'active')
      .maybeSingle()

    if (error) {
      logError('Failed to find branch by name', { 
        company_id: companyId, 
        branch_name: branchName,
        normalized_name: normalizedBranchName,
        error 
      })
      throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to find branch by name', error)
    }

    logInfo('Branch lookup result', {
      company_id: companyId,
      original_name: branchName,
      normalized_name: normalizedBranchName,
      found: !!data,
      branch_name: data?.id
    })

    return data
  }

  /**
   * Validate that payment method exists and is active
   */
  private async validatePaymentMethod(paymentMethodId: number): Promise<void> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, is_active')
      .eq('id', paymentMethodId)
      .maybeSingle()

    if (error) throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to validate payment method', error)
    if (!data) throw AggregatedTransactionErrors.PAYMENT_METHOD_NOT_FOUND(paymentMethodId.toString())
    if (!(data as any).is_active) {
      throw AggregatedTransactionErrors.PAYMENT_METHOD_INACTIVE(paymentMethodId.toString())
    }
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: AggregatedTransactionStatus, 
    newStatus: AggregatedTransactionStatus
  ): void {
    const validTransitions: Record<AggregatedTransactionStatus, AggregatedTransactionStatus[]> = {
      READY: ['PENDING', 'CANCELLED'],
      PENDING: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw AggregatedTransactionErrors.INVALID_STATUS_TRANSITION(
        currentStatus, 
        newStatus
      )
    }
  }

  /**
   * Convert CreateDto to Repository insert format
   */
  private toInsertData(data: CreateAggregatedTransactionDto): Omit<AggregatedTransaction, 'id' | 'created_at' | 'updated_at' | 'version'> {
    return {
      company_id: data.company_id,
      branch_name: data.branch_name ?? null,
      source_type: data.source_type,
      source_id: data.source_id,
      source_ref: data.source_ref,
      transaction_date: data.transaction_date,
      payment_method_id: data.payment_method_id,
      gross_amount: data.gross_amount,
      discount_amount: data.discount_amount ?? 0,
      tax_amount: data.tax_amount ?? 0,
      service_charge_amount: data.service_charge_amount ?? 0,
      net_amount: data.net_amount,
      currency: data.currency ?? 'IDR',
      journal_id: null,
      is_reconciled: false,
      status: data.status ?? 'READY',
      deleted_at: null,
      deleted_by: null,
    }
  }

  /**
   * Create new aggregated transaction
   */
  async createTransaction(data: CreateAggregatedTransactionDto, skipPaymentMethodValidation = false): Promise<AggregatedTransaction> {
    await this.validateCompany(data.company_id)
    
    // Skip branch validation for POS imports - store branch_name directly
    // Branch validation only needed when using branch_id (UUID)
    // await this.validateBranch(data.branch_name ?? null)
    
    // Skip payment method validation if using fallback ID
    if (!skipPaymentMethodValidation) {
      await this.validatePaymentMethod(data.payment_method_id)
    }

    const exists = await posAggregatesRepository.sourceExists(
      data.source_type,
      data.source_id,
      data.source_ref
    )

    if (exists) {
      throw AggregatedTransactionErrors.DUPLICATE_SOURCE(
        data.source_type,
        data.source_id,
        data.source_ref
      )
    }

    logInfo('Creating aggregated transaction', {
      source_type: data.source_type,
      source_id: data.source_id,
      source_ref: data.source_ref,
      company_id: data.company_id
    })

    const insertData = this.toInsertData(data)
    return posAggregatesRepository.create(insertData)
  }

  /**
   * Create multiple transactions (batch)
   */
  async createBatch(
    transactions: CreateAggregatedTransactionDto[]
  ): Promise<AggregatedTransactionBatchResult> {
    const results: AggregatedTransactionBatchResult = {
      success: [],
      failed: [],
      total_processed: transactions.length
    }

    for (const tx of transactions) {
      try {
        await this.createTransaction(tx)
        results.success.push(tx.source_ref)
      } catch (err) {
        results.failed.push({
          source_ref: tx.source_ref,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        logError('Failed to create transaction in batch', { 
          source_ref: tx.source_ref, 
          error: err 
        })
      }
    }

    logInfo('Batch transaction creation completed', {
      total: transactions.length,
      success: results.success.length,
      failed: results.failed.length
    })

    return results
  }

  /**
   * Get single transaction by ID
   */
  async getTransactionById(id: string): Promise<AggregatedTransactionWithDetails> {
    const transaction = await posAggregatesRepository.findById(id)
    if (!transaction) {
      throw AggregatedTransactionErrors.NOT_FOUND(id)
    }
    return transaction
  }

  /**
   * Get transactions with pagination and filters
   */
  async getTransactions(
    filter?: AggregatedTransactionFilterParams,
    sort?: AggregatedTransactionSortParams
  ) {
    const { page, limit, offset } = getPaginationParams(filter as any)
    const { data, total } = await posAggregatesRepository.findAll(
      { limit, offset },
      filter,
      sort
    )
    
    return createPaginatedResponse(data, total, page, limit)
  }

  /**
   * Update transaction
   */
  async updateTransaction(
    id: string, 
    updates: UpdateAggregatedTransactionDto,
    expectedVersion?: number
  ): Promise<AggregatedTransaction> {
    const existing = await posAggregatesRepository.findById(id)
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id)
    }

    if (updates.status && updates.status !== existing.status) {
      this.validateStatusTransition(existing.status, updates.status)
    }

    if (updates.payment_method_id) {
      await this.validatePaymentMethod(updates.payment_method_id)
    }

    if (updates.branch_name !== undefined) {
      await this.validateBranch(updates.branch_name)
    }

    logInfo('Updating aggregated transaction', {
      id,
      expected_version: expectedVersion,
      updates: Object.keys(updates)
    })

    try {
      return await posAggregatesRepository.update(id, updates, expectedVersion)
    } catch (err: any) {
      if (err.message?.includes('version') || err.code === 'P0001') {
        throw AggregatedTransactionErrors.VERSION_CONFLICT(
          id, 
          expectedVersion || existing.version, 
          (expectedVersion || existing.version) + 1
        )
      }
      throw err
    }
  }

  /**
   * Soft delete transaction
   */
  async deleteTransaction(id: string, deletedBy?: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id)
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id)
    }

    if (existing.status === 'COMPLETED') {
      throw AggregatedTransactionErrors.CANNOT_DELETE_COMPLETED(id)
    }

    logInfo('Deleting aggregated transaction', {
      id,
      status: existing.status,
      deleted_by: deletedBy
    })

    await posAggregatesRepository.softDelete(id, deletedBy)
  }

  /**
   * Restore soft-deleted transaction
   */
  async restoreTransaction(id: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id)
    if (existing && !existing.deleted_at) {
      throw AggregatedTransactionErrors.ALREADY_ACTIVE(id)
    }

    logInfo('Restoring aggregated transaction', { id })
    await posAggregatesRepository.restore(id)
  }

  /**
   * Mark transaction as reconciled
   */
  async reconcileTransaction(id: string, reconciledBy: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id)
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id)
    }

    if (existing.is_reconciled) {
      throw AggregatedTransactionErrors.ALREADY_RECONCILED(id)
    }

    if (!existing.journal_id) {
      throw AggregatedTransactionErrors.NO_JOURNAL_ASSIGNED(id)
    }

    logInfo('Reconciling transaction', { id, reconciled_by: reconciledBy })
    await posAggregatesRepository.markReconciled([id], reconciledBy)
  }

  /**
   * Batch reconcile transactions
   */
  async reconcileBatch(transactionIds: string[], reconciledBy: string): Promise<number> {
    let reconciled = 0

    for (const id of transactionIds) {
      try {
        const existing = await posAggregatesRepository.findById(id)
        if (existing && !existing.is_reconciled && existing.journal_id) {
          await posAggregatesRepository.markReconciled([id], reconciledBy)
          reconciled++
        }
      } catch (err) {
        logError('Failed to reconcile transaction', { id, error: err })
      }
    }

    logInfo('Batch reconciliation completed', {
      total: transactionIds.length,
      reconciled
    })

    return reconciled
  }

  /**
   * Get summary statistics
   */
  async getSummary(
    companyId: string,
    dateFrom?: string,
    dateTo?: string,
    branchName?: string
  ): Promise<AggregatedTransactionSummary> {
    await this.validateCompany(companyId)

    const summary = await posAggregatesRepository.getSummary(
      companyId,
      dateFrom,
      dateTo,
      branchName
    )

    const statusCounts = await posAggregatesRepository.getStatusCounts(companyId)

    return {
      ...summary,
      by_status: statusCounts
    }
  }

  /**
   * Get unreconciled transactions for journal generation
   */
  async getUnreconciledTransactions(
    companyId: string,
    dateFrom: string,
    dateTo: string,
    branchName?: string
  ): Promise<AggregatedTransaction[]> {
    await this.validateCompany(companyId)

    return posAggregatesRepository.findUnreconciled(
      companyId,
      dateFrom,
      dateTo,
      branchName
    )
  }

  /**
   * Assign journal to transaction
   */
  async assignJournal(id: string, journalId: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id)
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id)
    }

    if (existing.journal_id) {
      throw AggregatedTransactionErrors.JOURNAL_ALREADY_ASSIGNED(id)
    }

    logInfo('Assigning journal to transaction', { id, journal_id: journalId })
    await posAggregatesRepository.assignJournal(id, journalId)
  }

  /**
   * Assign journal to multiple transactions (batch)
   */
  async assignJournalBatch(
    transactionIds: string[],
    journalId: string
  ): Promise<{ assigned: number; skipped: number }> {
    let assigned = 0
    let skipped = 0

    for (const id of transactionIds) {
      try {
        const existing = await posAggregatesRepository.findById(id)
        if (existing && !existing.journal_id) {
          await posAggregatesRepository.assignJournal(id, journalId)
          assigned++
        } else {
          skipped++
        }
      } catch (err) {
        logError('Failed to assign journal to transaction', { id, error: err })
        skipped++
      }
    }

    logInfo('Batch journal assignment completed', {
      total: transactionIds.length,
      assigned,
      skipped
    })

    return { assigned, skipped }
  }

  /**
   * Generate journals for eligible transactions
   * Creates journal entries from aggregated POS transactions
   */
  async generateJournals(request: GenerateJournalRequestDto): Promise<Array<{
    date: string
    transaction_ids: string[]
    journal_id: string | null
    total_amount: number
    journal_number?: string
  }>> {
    await this.validateCompany(request.company_id)

    if (request.branch_name) {
      await this.validateBranch(request.branch_name)
    }

    const transactions = await this.getUnreconciledTransactions(
      request.company_id,
      request.transaction_date_from,
      request.transaction_date_to,
      request.branch_name
    )

    if (transactions.length === 0) {
      return []
    }
    

    let filtered = transactions
    if (request.include_unreconciled_only) {
      filtered = transactions.filter(tx => !tx.is_reconciled)
    }
    if (request.payment_method_id) {
      filtered = filtered.filter(tx => tx.payment_method_id === request.payment_method_id)
    }
    if (request.transaction_ids && request.transaction_ids.length > 0) {
      filtered = filtered.filter(tx => request.transaction_ids!.includes(tx.id))
    }

    if (filtered.length === 0) {
      return []
    }

    // 1️⃣ GROUP PER TANGGAL
    const txByDate = new Map<string, AggregatedTransaction[]>()

    for (const tx of filtered as AggregatedTransaction[]) {
      if (!txByDate.has(tx.transaction_date)) {
        txByDate.set(tx.transaction_date, [])
      }
      txByDate.get(tx.transaction_date)!.push(tx)
    }

    // 2️⃣ LOOP PER TANGGAL (AUTO JOURNAL)
    const results = []

    for (const [date, transactions] of txByDate) {
      const journalResult = await this.generateJournalPerDate({
        company_id: request.company_id,
        branch_name: request.branch_name,
        transaction_date: date,
        _transactions: transactions
      })
      results.push(journalResult)
    }
    return results
  }  
    // generate journal per date
    private async generateJournalPerDate(
      request: GenerateJournalPerDateDto
    ) {
      const transactions = request._transactions
      if (!transactions?.length) {
        throw new Error('No transactions provided')
      }
    
    // Get unique payment method IDs from filtered transactions -> pindah ke generateJournalPerDate
    const paymentMethodIds = [
      ...new Set(transactions.map((tx: AggregatedTransaction) => tx.payment_method_id))
    ]

    // Fetch payment method COA accounts
    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('id, coa_account_id, name, code')
      .in('id', paymentMethodIds)
      .eq('is_active', true)

    if (pmError) {
      throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to fetch payment methods', pmError)
    }

    // Create a map of payment_method_id -> coa_account_id
    const paymentMethodCoaMap = new Map<number, string>()
    for (const pm of paymentMethods || []) {
      if (pm.coa_account_id) {
        paymentMethodCoaMap.set(pm.id, pm.coa_account_id)
      }
    }

    // Get SAL-INV purpose account (Sales Revenue) for credit side
    // Find purpose_id for SAL-INV
    const { data: salesPurpose, error: purposeError } = await supabase
      .from('accounting_purposes')
      .select('id, purpose_code, purpose_name')
      .eq('company_id', request.company_id)
      .eq('purpose_code', 'SAL-INV')
      .eq('is_active', true)
      .maybeSingle()

    if (purposeError) {
      throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to fetch SAL-INV purpose', purposeError)
    }

    let salesCoaAccountId: string | null = null
    if (salesPurpose) {
      // Get the CREDIT side account for SAL-INV
      const { data: salesAccounts, error: accError } = await supabase
        .from('accounting_purpose_accounts')
        .select('account_id')
        .eq('purpose_id', salesPurpose.id)
        .eq('side', 'CREDIT')
        .eq('is_active', true)
        .eq('is_auto', true)
        .maybeSingle()

      if (accError) {
        throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to fetch SAL-INV account', accError)
      }

      if (salesAccounts) {
        salesCoaAccountId = salesAccounts.account_id
      }
    }

    if (!salesCoaAccountId) {
      throw new Error('Sales COA (SAL-INV) belum dikonfigurasi');
    }
    
    // Group transactions by payment method COA for journal lines
    const coaGroups = new Map<string, { amount: number; transactions: string[] }>()
    
    for (const tx of transactions) {
      const coaAccountId = paymentMethodCoaMap.get(tx.payment_method_id) 
      if (!coaAccountId) continue

      if (!coaGroups.has(coaAccountId)) {
        coaGroups.set(coaAccountId, { amount: 0, transactions: [] })
      }
      const group = coaGroups.get(coaAccountId)!
      group.amount += Number(tx.net_amount)
      group.transactions.push(tx.id)
    }

    // If no valid COA accounts found, return error
    if (coaGroups.size === 0) {
      throw new Error('No valid COA accounts found for payment methods')
    }

  // ✅ DATE SOURCE — BUKAN ARRAY
  const journalDate = request.transaction_date
  const period = journalDate

    // Calculate totals
    const totalAmount = [...coaGroups.values()].reduce((sum, g) => sum + g.amount, 0)
    const transactionIds = transactions.map((tx: AggregatedTransaction) => tx.id)

    // Resolve branch ID if branch_name provided (DONT FUCKING CHANGE)
    let resolvedBranchId: string | null = null
    if (request.branch_name) {
      const branch = await this.findBranchByName(
        request.company_id,
        request.branch_name
      )
      if (!branch) {
        throw AggregatedTransactionErrors.BRANCH_NOT_FOUND(request.branch_name)
      }
      resolvedBranchId = branch.id
    }

    // Create journal header
    const journalDescription = `POS Sales ${journalDate}${request.branch_name ? ` - ${request.branch_name}` : ''}`

    const { data: journalHeader, error: headerError } = await supabase
      .from('journal_headers')
      .insert({
        company_id: request.company_id,
        branch_id: resolvedBranchId, // DONT FUCKING CHANGE
        journal_number: `AUTO-${Date.now()}`, // Will be replaced by sequence
        journal_type: 'RECEIPT',
        journal_date: journalDate,
        period: period,
        description: journalDescription,
        total_debit: totalAmount,
        total_credit: totalAmount,
        currency: 'IDR',
        exchange_rate: 1,
        status: 'DRAFT',
        is_auto: true,
        source_module: 'POS_AGGREGATES',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (headerError) {
      throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to create journal header', headerError)
    }

    // Update journal with proper journal_number (get sequence)
    const { data: sequenceData, error: seqError } = await supabase
      .from('journal_headers')
      .select('sequence_number')
      .eq('company_id', request.company_id)
      .eq('journal_type', 'RECEIPT')
      .eq('period', period)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sequenceNumber = (sequenceData?.sequence_number || 0) + 1
    const journalNumber = `RCP-${journalDate}${journalDate}-${sequenceNumber.toString().padStart(4, '0')}`

    // Update with proper journal number
    const { data: updatedJournal, error: updateError } = await supabase
      .from('journal_headers')
      .update({
        journal_number: journalNumber,
        sequence_number: sequenceNumber
      })
      .eq('id', journalHeader.id)
      .select()
      .single()

    if (updateError) {
      logError('Failed to update journal number', { error: updateError })
      // Continue anyway, journal already created
    }

    // Insert journal lines
    if (coaGroups.has(salesCoaAccountId)) {
      throw new Error('Payment COA tidak boleh sama dengan Sales COA');
    }

    // Create journal lines
    const journalLines: any[] = []
    let lineNumber = 1

    // Debit lines (one per COA group)
    for (const [coaAccountId, group] of coaGroups) {
      journalLines.push({
        journal_header_id: journalHeader.id,
        line_number: lineNumber++,
        account_id: coaAccountId,
        description: `POS Sales - Payment`,
        debit_amount: group.amount,
        credit_amount: 0,
        currency: 'IDR',
        exchange_rate: 1,
        base_debit_amount: group.amount,
        base_credit_amount: 0,
        created_at: new Date().toISOString()
      })
    }

    // Credit line (Sales Revenue) - one line for total
    if (salesCoaAccountId) {
      journalLines.push({
        journal_header_id: journalHeader.id,
        line_number: lineNumber++,
        account_id: salesCoaAccountId,
        description: `POS Sales Revenue`,
        debit_amount: 0,
        credit_amount: totalAmount,
        currency: 'IDR',
        exchange_rate: 1,
        base_debit_amount: 0,
        base_credit_amount: totalAmount,
        created_at: new Date().toISOString()
      })
    }

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(journalLines)

    if (linesError) {
      // Delete the journal header if lines fail
      await supabase.from('journal_headers').delete().eq('id', journalHeader.id)
      throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to create journal lines', linesError)
    }

    // Assign journal_id to all transactions
    const { error: assignError } = await supabase
      .from('aggregated_transactions')
      .update({
        journal_id: journalHeader.id,
        status: 'PROCESSING' as AggregatedTransactionStatus,
        updated_at: new Date().toISOString()
      })
      .in('id', transactionIds)

    if (assignError) {
      logError('Failed to assign journal to transactions', { error: assignError })
      // Journal is created, but transactions not updated
    }

    logInfo('Generated journal from aggregated transactions', {
      journal_id: journalHeader.id,
      journal_number: journalNumber,
      company_id: request.company_id,
      transaction_count: transactionIds.length,
      total_amount: totalAmount
    })

    return {
      date:journalDate,
      transaction_ids: transactionIds,
      journal_id: journalHeader.id,
      total_amount: totalAmount,
      journal_number: journalNumber
    }
  }
 
  // batas pindah generateJournalPerDate

  /**
   * Check source existence (for external use)
   */
  async checkSourceExists(
    sourceType: AggregatedTransactionSourceType,
    sourceId: string,
    sourceRef: string
  ): Promise<boolean> {
    return posAggregatesRepository.sourceExists(sourceType, sourceId, sourceRef)
  }

  /**
   * Generate aggregated transactions from POS import lines
   */
  async generateFromPosImportLines(
    posImportId: string,
    companyId: string,
    branchName?: string
  ): Promise<{
    created: number
    skipped: number
    errors: Array<{ source_ref: string; error: string }>
  }> {
    await this.validateCompany(companyId)

    // Get all lines from the import
    const lines = await posImportLinesRepository.findAllByImportId(posImportId)
    
    if (lines.length === 0) {
      return { created: 0, skipped: 0, errors: [] }
    }

    // Group lines by transaction (bill_number + sales_number + sales_date + payment_method)
    const transactionGroups = new Map<string, typeof lines>()
    
    for (const line of lines) {
      const transactionKey = `${line.bill_number}|${line.sales_number}|${line.sales_date}|${line.payment_method}`
      if (!transactionGroups.has(transactionKey)) {
        transactionGroups.set(transactionKey, [])
      }
      transactionGroups.get(transactionKey)!.push(line)
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as Array<{ source_ref: string; error: string }>
    }

    // Process each transaction group
    for (const [, groupLines] of transactionGroups) {
      try {
        const firstLine = groupLines[0]
        const sourceRef = `${firstLine.bill_number}-${firstLine.sales_number}`
        
        // Check if already exists
        const exists = await this.checkSourceExists('POS', posImportId, sourceRef)
        if (exists) {
          results.skipped++
          continue
        }

        // Resolve branch from import line data
        // Note: Store branch_name as NULL if not a valid UUID
        // Database branch_name column expects UUID
        let resolvedBranchName: string | null = null
        
        if (firstLine.branch?.trim()) {
          resolvedBranchName = firstLine.branch.trim()
        }        

        // Calculate aggregated amounts
        const grossAmount = groupLines.reduce((sum: number, line: any) => sum + Number(line.subtotal || 0), 0)
        const discountAmount = groupLines.reduce((sum: number, line: any) => sum + Number(line.discount || 0), 0)
        const taxAmount = groupLines.reduce((sum: number, line: any) => sum + Number(line.tax || 0), 0)
        const netAmount = groupLines.reduce((sum: number, line: any) => sum + Number(line.total_after_bill_discount || line.total || 0), 0)

        // Get payment method ID - global search (PT/CV/-M variants exist)
        const { id: paymentMethodId, isFallback: isPaymentMethodFallback } = await this.getPaymentMethodId(firstLine.payment_method || 'Cash')

        // Ensure sales_date is valid with null safety
        const transactionDate = firstLine.sales_date || new Date().toISOString().split('T')[0]

        const aggregatedTransaction: CreateAggregatedTransactionDto = {
          company_id: companyId,
          branch_name: resolvedBranchName,
          source_type: 'POS',
          source_id: posImportId,
          source_ref: sourceRef,
          transaction_date: transactionDate,
          payment_method_id: paymentMethodId,
          gross_amount: grossAmount,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          service_charge_amount: 0, // Not available in POS import lines
          net_amount: netAmount,
          currency: 'IDR',
          status: 'READY'
        }

        // Skip payment method validation if using fallback
        await this.createTransaction(aggregatedTransaction, isPaymentMethodFallback)
        results.created++

        logInfo('Generated aggregated transaction from POS import', {
          source_ref: sourceRef,
          branch_name: firstLine.branch,
          resolved_branch_name: resolvedBranchName,
          gross_amount: grossAmount,
          net_amount: netAmount,
          line_count: groupLines.length
        })

      } catch (error) {
        const sourceRef = `${groupLines[0].bill_number}-${groupLines[0].sales_number}`
        results.errors.push({
          source_ref: sourceRef,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        logError('Failed to generate aggregated transaction', {
          source_ref: sourceRef,
          branch_name: groupLines[0].branch,
          error
        })
      }
    }

    logInfo('Completed generating aggregated transactions from POS import', {
      pos_import_id: posImportId,
      total_groups: transactionGroups.size,
      created: results.created,
      skipped: results.skipped,
      errors: results.errors.length
    })

    return results
  }

  /**
   * Get payment method ID by name (helper method)
   * Note: Global search - returns first match (PT/CV/-M variants exist)
   */
  private async getPaymentMethodId(paymentMethodName: string): Promise<{ id: number; isFallback: boolean }> {
    // Try to find payment method (global search)
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, name')
      .ilike('name', paymentMethodName)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (error) {
      logError('Failed to get payment method', { name: paymentMethodName, error })
    }

    if (data) {
      return { id: data.id, isFallback: false }
    }

    // Default to CASH PT (id 20) if not found
    logInfo('Payment method not found, using default', { 
      requested: paymentMethodName,
      default_id: 20 
    })
    return { id: 20, isFallback: true }
  }
}

export const posAggregatesService = new PosAggregatesService()
