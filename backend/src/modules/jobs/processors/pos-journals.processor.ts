/**
 * POS Journal Generation Optimized Processor
 * 
 * Features:
 * 1. Progress tracking dengan callback
 * 2. Batch payment method + COA lookup
 * 3. Chunked journal lines insert
 * 4. Error handling per chunk
 * 5. Retry mechanism dengan exponential backoff
 * 6. Transaction rollback capability
 */

import { supabase } from '../../../config/supabase'
import { logInfo, logError, logWarn } from '../../../config/logger'
import type { AggregatedTransaction, GenerateJournalResult } from '../../pos-imports/pos-aggregates/pos-aggregates.types'

// ==============================
// CONFIGURATION
// ==============================
const CHUNK_SIZE = 500              // Journal lines insert chunk size
const PM_LOOKUP_BATCH = 500         // Payment method lookup batch size
const MAX_RETRIES = 3               // Max retry attempts per operation
const RETRY_DELAY_MS = 1000         // Base delay for retry (ms)
const BATCH_SIZE = 1000             // Transactions per batch processing

// ==============================
// TYPES
// ==============================

interface ProgressCallback {
  (progress: { current: number; total: number; phase: string; message: string }): void
}

interface GenerateJournalsResult {
  success: GenerateJournalResult[]
  failed: Array<{ date: string; branch: string; error: string }>
  total_transactions: number
  total_journals: number
  duration_ms: number
}

interface PaymentMethodCoa {
  coaAccountId: string
  name: string
  code: string
  bankAccountId?: string
}

interface JournalGenerationError {
  groupKey: string
  date: string
  branch: string
  error: string
  retryCount: number
  isRecoverable: boolean
}

// ==============================
// HELPER FUNCTIONS
// ==============================

/**
 * Sleep utility untuk retry delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Exponential backoff delay calculation
 */
function getRetryDelay(attempt: number, baseDelay: number = RETRY_DELAY_MS): number {
  return baseDelay * Math.pow(2, attempt - 1)
}

// ==============================
// CORE FUNCTIONS
// ==============================

/**
 * Batch lookup payment methods dengan COA accounts
 * Optimization: Single query dengan JOIN untuk semua payment methods
 */
async function lookupPaymentMethodsWithCoa(
  paymentMethodIds: number[]
): Promise<Map<number, PaymentMethodCoa>> {
  const result = new Map<number, PaymentMethodCoa>()

  if (paymentMethodIds.length === 0) return result

  // Batch query untuk payment methods + COA
  const { data: paymentMethods, error } = await supabase
    .from('payment_methods')
    .select('id, name, code, coa_account_id, bank_account_id')
    .in('id', paymentMethodIds)
    .eq('is_active', true)

  if (error) {
    logError('Failed to lookup payment methods with COA', { error, count: paymentMethodIds.length })
    return result
  }

  // Build map dengan COA
  for (const pm of paymentMethods || []) {
    result.set(pm.id, {
      coaAccountId: pm.coa_account_id || '',
      name: pm.name,
      code: pm.code,
      bankAccountId: pm.bank_account_id || undefined
    })
  }

  return result
}

/**
 * Batch lookup bank accounts untuk COA fallback
 */
async function lookupBankAccountsWithCoa(
  bankAccountIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  if (bankAccountIds.length === 0) return result

  const { data: bankAccounts, error } = await supabase
    .from('bank_accounts')
    .select('id, coa_account_id')
    .in('id', bankAccountIds)
    .not('coa_account_id', 'is', null)

  if (error) {
    logError('Failed to lookup bank accounts with COA', { error, count: bankAccountIds.length })
    return result
  }

  for (const ba of bankAccounts || []) {
    result.set(ba.id, ba.coa_account_id)
  }

  return result
}

/**
 * Find branch by name dengan caching
 */
async function findBranchByName(branchName: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .ilike('branch_name', branchName.trim())
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Get sales COA (SAL-INV) dengan caching
 */
let salesCoaCache: string | null = null

async function getSalesCoaAccountId(): Promise<string | null> {
  if (salesCoaCache) return salesCoaCache

  // Find SAL-INV purpose
  const { data: salesPurpose } = await supabase
    .from('accounting_purposes')
    .select('id')
    .eq('purpose_code', 'SAL-INV')
    .eq('is_active', true)
    .maybeSingle()

  if (!salesPurpose) return null

  // Get CREDIT side account for SAL-INV
  const { data: salesAccounts } = await supabase
    .from('accounting_purpose_accounts')
    .select('account_id')
    .eq('purpose_id', salesPurpose.id)
    .eq('side', 'CREDIT')
    .eq('is_active', true)
    .eq('is_auto', true)
    .order('priority', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (salesAccounts) {
    salesCoaCache = salesAccounts.account_id
    return salesCoaCache
  }

  return null
}

/**
 * Check if journal lines already exist untuk idempotency
 */
async function checkJournalLinesExist(journalHeaderId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('journal_lines')
    .select('id', { count: 'exact', head: true })
    .eq('journal_header_id', journalHeaderId)
    .limit(1)

  if (error) {
    logError('Failed to check journal lines existence', { journalHeaderId, error })
    return false
  }

  return (data?.length || 0) > 0
}

/**
 * Update aggregated transactions dengan journal ID
 */
async function updateTransactionsJournalId(
  transactionIds: string[],
  journalId: string
): Promise<void> {
  const { error } = await supabase
    .from('aggregated_transactions')
    .update({
      journal_id: journalId,
      status: 'PROCESSING' as const,
      updated_at: new Date().toISOString()
    })
    .in('id', transactionIds)

  if (error) {
    logError('Failed to update transactions journal_id', { transactionIds, journalId, error })
    throw error
  }
}

/**
 * Rollback journal header jika insert lines gagal
 */
async function rollbackJournalHeader(journalHeaderId: string): Promise<void> {
  try {
    await supabase
      .from('journal_headers')
      .delete()
      .eq('id', journalHeaderId)
    
    logInfo('Rolled back journal header', { journalHeaderId })
  } catch (error) {
    logError('Failed to rollback journal header', { journalHeaderId, error })
    // Don't throw - rollback failure shouldn't block the process
  }
}

// ==============================
// JOURNAL CREATION WITH RETRY
// ==============================

/**
 * Create journal header dengan retry mechanism
 */
async function createJournalHeaderWithRetry(
  params: {
    companyId: string
    branchId: string | null
    journalNumber: string
    journalDate: string
    period: string
    description: string
    totalAmount: number
  },
  retryCount: number = 0
): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabase
      .rpc('create_journal_header_atomic', {
        p_company_id: params.companyId,
        p_branch_id: params.branchId,
        p_journal_number: params.journalNumber,
        p_journal_type: 'CASH',
        p_journal_date: params.journalDate,
        p_period: params.period,
        p_description: params.description,
        p_total_amount: params.totalAmount,
        p_source_module: 'POS_AGGREGATES'
      })

    if (error) {
      throw new Error(error.message)
    }

    return (data as any)?.id ? { id: (data as any).id } : null
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if retryable
    const isRetryable = retryCount < MAX_RETRIES && (
      errorMsg.includes('connection') ||
      errorMsg.includes('timeout') ||
      errorMsg.includes('rate limit') ||
      errorMsg.includes('too many requests')
    )

    if (isRetryable) {
      const delay = getRetryDelay(retryCount + 1)
      logWarn('Retrying journal header creation', { 
        journalNumber: params.journalNumber,
        attempt: retryCount + 1,
        maxAttempts: MAX_RETRIES,
        delayMs: delay,
        error: errorMsg
      })
      
      await sleep(delay)
      return createJournalHeaderWithRetry(params, retryCount + 1)
    }

    throw error
  }
}

/**
 * Insert journal lines dengan retry dan chunked insert
 */
async function insertJournalLinesWithRetry(
  journalHeaderId: string,
  lines: any[],
  retryCount: number = 0
): Promise<void> {
  if (lines.length === 0) return

  const errors: string[] = []

  // Chunked insert
  for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
    const chunk = lines.slice(i, i + CHUNK_SIZE)
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1
    const totalChunks = Math.ceil(lines.length / CHUNK_SIZE)

    try {
      const { error } = await supabase
        .from('journal_lines')
        .insert(chunk)

      if (error) {
        throw new Error(error.message)
      }

      logInfo('Journal lines chunk inserted', { 
        journalHeaderId, 
        chunkIndex, 
        totalChunks,
        linesInChunk: chunk.length 
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      
      // Check if retryable
      const isRetryable = retryCount < MAX_RETRIES && (
        errorMsg.includes('connection') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('rate limit') ||
        errorMsg.includes('too many requests')
      )

      if (isRetryable) {
        const delay = getRetryDelay(retryCount + 1)
        logWarn('Retrying journal lines chunk', { 
          journalHeaderId, 
          chunkIndex, 
          totalChunks,
          attempt: retryCount + 1,
          maxAttempts: MAX_RETRIES,
          delayMs: delay,
          error: errorMsg
        })
        
        await sleep(delay)
        
        // Retry the entire line insert operation
        await insertJournalLinesWithRetry(journalHeaderId, lines, retryCount + 1)
        return
      } else {
        // Non-retryable error, collect and continue
        errors.push(`Chunk ${chunkIndex}: ${errorMsg}`)
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '))
  }
}

// ==============================
// MAIN PROCESSOR
// ==============================

/**
 * Generate journals dari aggregated transactions
 * 
 * Features:
 * - Progress tracking dengan callback
 * - Batch payment method + COA lookup
 * - Chunked journal lines insert
 * - Error handling per group
 * - Retry mechanism dengan exponential backoff
 * - Transaction rollback capability
 * 
 * @param transactions - Array of aggregated transactions
 * @param companyId - Company ID untuk journal creation
 * @param onProgress - Optional progress callback
 * @returns GenerateJournalsResult
 */
export async function generateJournalsOptimized(
  transactions: AggregatedTransaction[],
  companyId: string,
  onProgress?: ProgressCallback
): Promise<GenerateJournalsResult> {
  const startTime = Date.now()

  try {
    // Validasi input
    if (transactions.length === 0) {
      return { 
        success: [], 
        failed: [], 
        total_transactions: 0, 
        total_journals: 0,
        duration_ms: 0
      }
    }

    logInfo('Starting optimized journal generation', {
      transaction_count: transactions.length,
      company_id: companyId
    })

    // ==============================
    // PHASE 1: Grouping (5-15%)
    // ==============================
    onProgress?.({ current: 5, total: 100, phase: 'grouping', message: 'Grouping transactions by date and branch...' })

    const txByDateBranch = new Map<string, AggregatedTransaction[]>()
    
    for (const tx of transactions) {
      const branchName = tx.branch_name || 'Unknown'
      const key = `${tx.transaction_date}|${branchName}`
      if (!txByDateBranch.has(key)) {
        txByDateBranch.set(key, [])
      }
      txByDateBranch.get(key)!.push(tx)
    }

    const dateBranchGroups = Array.from(txByDateBranch.entries())
    const totalGroups = dateBranchGroups.length

    logInfo('Transaction groups created', { total_groups: totalGroups })

    // ==============================
    // PHASE 2: Payment Method + COA Lookup (15-25%)
    // ==============================
    onProgress?.({ current: 15, total: 100, phase: 'lookup', message: 'Resolving payment methods and COA accounts...' })

    // Get unique payment method IDs
    const uniquePaymentMethodIds = Array.from(
      new Set(transactions.map(t => t.payment_method_id))
    )

    // Batch lookup payment methods + COA
    const paymentMethodCoaMap = await lookupPaymentMethodsWithCoa(uniquePaymentMethodIds)

    // Check for missing COA and try bank accounts fallback
    const missingCoaPaymentMethodIds = uniquePaymentMethodIds.filter(id => {
      const pm = paymentMethodCoaMap.get(id)
      return !pm || !pm.coaAccountId
    })

    if (missingCoaPaymentMethodIds.length > 0) {
      logWarn('Some payment methods missing COA, trying bank accounts fallback', { 
        count: missingCoaPaymentMethodIds.length 
      })

      // Get payment methods dengan bank_account_id
      const { data: pmWithBank } = await supabase
        .from('payment_methods')
        .select('id, bank_account_id')
        .in('id', missingCoaPaymentMethodIds)
        .not('bank_account_id', 'is', null)

      if (pmWithBank && pmWithBank.length > 0) {
        const bankIds = pmWithBank.map(pm => pm.bank_account_id!)
        const bankCoaMap = await lookupBankAccountsWithCoa(bankIds)
        
        // Update payment method map dengan bank COA fallback
        for (const pm of pmWithBank) {
          const coaId = bankCoaMap.get(pm.bank_account_id!)
          if (coaId) {
            const existing = paymentMethodCoaMap.get(pm.id)
            if (existing) {
              existing.coaAccountId = coaId
            } else {
              paymentMethodCoaMap.set(pm.id, {
                coaAccountId: coaId,
                name: '',
                code: ''
              })
            }
          }
        }
      }
    }

    // ==============================
    // PHASE 3: Get Sales COA (25-30%)
    // ==============================
    onProgress?.({ current: 25, total: 100, phase: 'config', message: 'Loading accounting configuration...' })

    const salesCoaAccountId = await getSalesCoaAccountId()

    if (!salesCoaAccountId) {
      throw new Error('Sales COA (SAL-INV) belum dikonfigurasi')
    }

    logInfo('Sales COA resolved', { salesCoaAccountId })
    onProgress?.({ current: 30, total: 100, phase: 'config', message: 'Configuration loaded...' })

    // ==============================
    // PHASE 4: Process Groups (30-90%)
    // ==============================
    onProgress?.({ current: 30, total: 100, phase: 'processing', message: 'Generating journal entries...' })

    const successResults: GenerateJournalResult[] = []
    const failedResults: Array<{ date: string; branch: string; error: string }> = []

    // Branch cache untuk avoid repeated lookups
    const branchCache = new Map<string, string | null>()

    for (let groupIndex = 0; groupIndex < dateBranchGroups.length; groupIndex++) {
      const [key, groupTransactions] = dateBranchGroups[groupIndex]
      const [date, branchName] = key.split('|')

      // Progress update dengan granular updates
      const progress = 30 + Math.min(60, Math.floor((groupIndex / totalGroups) * 60))
      onProgress?.({ 
        current: progress, 
        total: 100, 
        phase: 'processing', 
        message: `Processing ${branchName} - ${date} (${groupIndex + 1}/${totalGroups})...` 
      })

      try {
        // ==============================
        // Step 4.1: Resolve Branch ID
        // ==============================
        let resolvedBranchId: string | null = null
        if (!branchCache.has(branchName)) {
          const branch = await findBranchByName(branchName)
          branchCache.set(branchName, branch?.id || null)
        }
        resolvedBranchId = branchCache.get(branchName)!

        // ==============================
        // Step 4.2: Calculate Totals
        // ==============================
        const totalAmount = groupTransactions.reduce((sum, tx) => sum + Number(tx.net_amount), 0)
        const transactionIds = groupTransactions.map(tx => tx.id)

        // ==============================
        // Step 4.3: Group by Payment Method COA
        // ==============================
        const coaGroups = new Map<string, { amount: number; paymentMethodName?: string }>()
        
        for (const tx of groupTransactions) {
          const pm = paymentMethodCoaMap.get(tx.payment_method_id)
          const coaId = pm?.coaAccountId

          if (!coaId) {
            logWarn('Skipping transaction - no COA', { 
              transaction_id: tx.id, 
              payment_method_id: tx.payment_method_id 
            })
            continue
          }

          if (!coaGroups.has(coaId)) {
            coaGroups.set(coaId, { amount: 0, paymentMethodName: pm?.name })
          }
          coaGroups.get(coaId)!.amount += Number(tx.net_amount)
        }

        if (coaGroups.size === 0) {
          failedResults.push({
            date,
            branch: branchName,
            error: 'No valid COA accounts found for payment methods'
          })
          continue
        }

        // ==============================
        // Step 4.4: Create Journal Header
        // ==============================
        const period = date.substring(0, 7)
        const branchNameNormalized = branchName.replace(/\s+/g, '-').toUpperCase()
        const journalNumber = `RCP-${branchNameNormalized}-${date}`

        const journalHeader = await createJournalHeaderWithRetry({
          companyId,
          branchId: resolvedBranchId,
          journalNumber,
          journalDate: date,
          period,
          description: `POS Sales ${date} - ${branchName}`,
          totalAmount
        })

        if (!journalHeader) {
          throw new Error('Failed to create journal header')
        }

        // ==============================
        // Step 4.5: Check for existing lines (idempotency)
        // ==============================
        const linesExist = await checkJournalLinesExist(journalHeader.id)

        if (linesExist) {
          logInfo('Journal lines already exist, skipping', { journalId: journalHeader.id })
          
          await updateTransactionsJournalId(transactionIds, journalHeader.id)

          successResults.push({
            date,
            branch_name: branchName,
            transaction_ids: transactionIds,
            journal_id: journalHeader.id,
            total_amount: totalAmount,
            journal_number: journalNumber
          })
          continue
        }

        // ==============================
        // Step 4.6: Create Journal Lines
        // ==============================
        const journalLines: any[] = []
        let lineNumber = 1

        // Debit lines (one per COA group)
        Array.from(coaGroups.entries()).forEach(([coaAccountId, group]) => {
          journalLines.push({
            journal_header_id: journalHeader.id,
            line_number: lineNumber++,
            account_id: coaAccountId,
            description: `POS Sales - ${group.paymentMethodName || 'Payment'}`,
            debit_amount: group.amount,
            credit_amount: 0,
            currency: 'IDR',
            exchange_rate: 1,
            base_debit_amount: group.amount,
            base_credit_amount: 0,
            created_at: new Date().toISOString()
          })
        })

        // Credit line (Sales Revenue)
        journalLines.push({
          journal_header_id: journalHeader.id,
          line_number: lineNumber++,
          account_id: salesCoaAccountId,
          description: 'POS Sales Revenue',
          debit_amount: 0,
          credit_amount: totalAmount,
          currency: 'IDR',
          exchange_rate: 1,
          base_debit_amount: 0,
          base_credit_amount: totalAmount,
          created_at: new Date().toISOString()
        })

        // ==============================
        // Step 4.7: Insert Lines with Retry + Chunking
        // ==============================
        try {
          await insertJournalLinesWithRetry(journalHeader.id, journalLines)
        } catch (insertError) {
          // Rollback journal header if lines insert fails
          await rollbackJournalHeader(journalHeader.id)
          throw insertError
        }

        // ==============================
        // Step 4.8: Update Transactions
        // ==============================
        await updateTransactionsJournalId(transactionIds, journalHeader.id)

        successResults.push({
          date,
          branch_name: branchName,
          transaction_ids: transactionIds,
          journal_id: journalHeader.id,
          total_amount: totalAmount,
          journal_number: journalNumber
        })

      } catch (error) {
        logError('Failed to generate journal for group', { date, branch: branchName, error })
        
        failedResults.push({
          date,
          branch: branchName,
          error: error instanceof Error ? error.message : 'Unknown error'
        })

        // Continue with next group - atomic per group
      }
    }

    const duration = Date.now() - startTime

    // ==============================
    // PHASE 5: Finalization (95-100%)
    // ==============================
    onProgress?.({ current: 95, total: 100, phase: 'finalizing', message: 'Completing...' })

    onProgress?.({ 
      current: 100, 
      total: 100, 
      phase: 'complete', 
      message: `Done! ${successResults.length} journals created, ${failedResults.length} failed` 
    })

    logInfo('Optimized journal generation complete', {
      transactions: transactions.length,
      journals_created: successResults.length,
      journals_failed: failedResults.length,
      duration_ms: duration
    })

    return {
      success: successResults,
      failed: failedResults,
      total_transactions: transactions.length,
      total_journals: successResults.length,
      duration_ms: duration
    }

  } catch (error) {
    logError('generateJournalsOptimized failed', { error })
    throw error
  }
}

/**
 * Simple version tanpa progress callback
 */
export async function generateJournals(
  transactions: AggregatedTransaction[],
  companyId: string
): Promise<GenerateJournalsResult> {
  return generateJournalsOptimized(transactions, companyId)
}

/**
 * Clear sales COA cache (useful for testing)
 */
export function clearSalesCoaCache(): void {
  salesCoaCache = null
}

