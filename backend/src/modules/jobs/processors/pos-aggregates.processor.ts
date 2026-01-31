/**
 * POS Aggregated Transactions Optimized Processor
 * 
 * Improvements:
 * 1. Batch payment method lookup (ambil semua sekaligus)
 * 2. Progress tracking dengan callback
 * 3. Chunked processing untuk data besar
 * 4. Failed transactions disimpan dengan status FAILED, TIDAK fallback ke CASH
 */

import { supabase } from '@/config/supabase'
import { posAggregatesRepository } from '../../pos-imports/pos-aggregates/pos-aggregates.repository'
import { posImportLinesRepository } from '../../pos-imports/pos-import-lines/pos-import-lines.repository'
import type { AggregatedTransaction, AggregatedTransactionSourceType, AggregatedTransactionStatus } from '../../pos-imports/pos-aggregates/pos-aggregates.types'
import { logInfo, logError, logWarn } from '@/config/logger'

// ==============================
// CONFIGURATION
// ==============================
const BATCH_SIZE = 100           // Insert batch size
const CHECK_BATCH_SIZE = 500     // Duplicate check batch size

interface ProgressCallback {
  (progress: { current: number; total: number; phase: string; message: string }): void
}

interface GenerateAggregatedResult {
  created: number
  skipped: number
  failed: number
  errors: Array<{ source_ref: string; error: string }>
  total_groups: number
}

// Interface untuk failed transaction dengan error details
interface FailedTransactionRecord {
  data: Omit<AggregatedTransaction, 'id' | 'created_at' | 'updated_at' | 'version'>
  error: string
}

/**
 * Normalize payment method name for matching
 * Handles: "qris mandiri - cv" -> "qris mandiri - cv"
 *         "QRIS MANDIRI - CV" -> "qris mandiri - cv"
 *         "qris mandiri  - cv" -> "qris mandiri - cv" (double space normalized)
 */
function normalizePaymentMethodName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Optimized batch payment method lookup (GLOBAL - tidak per company)
 * Mengambil semua payment methods yang needed dalam 1 query
 * TIDAK fallback ke CASH - jika tidak ditemukan, akan ditandai sebagai failed
 * Note: companyId parameter kept for future use but lookup is global
 * 
 * 🔥 ALSO FETCHES FEE CONFIGURATION for automatic fee calculation
 */
async function resolvePaymentMethodsBatch(
  paymentMethodNames: string[],
  _companyId?: string // Not used - lookup is global
): Promise<Map<string, { id: number; isFallback: boolean; name: string; fee_percentage: number; fee_fixed_amount: number; fee_fixed_per_transaction: boolean }>> {
  const result = new Map<string, { id: number; isFallback: boolean; name: string; fee_percentage: number; fee_fixed_amount: number; fee_fixed_per_transaction: boolean }>()
  
  if (paymentMethodNames.length === 0) return result

  // Normalize names for matching
  const uniqueNames = [...new Set(paymentMethodNames.map(n => normalizePaymentMethodName(n)))]
  
  // Batch query - cari semua payment methods yang needed (global, tidak per company)
  // Payment method lookup dibuat global untuk menghindari mismatch nama
  // 🔥 INCLUDE FEE COLUMNS untuk fee calculation
  const { data: allPaymentMethods, error } = await supabase
    .from('payment_methods')
    .select('id, name, code, is_active, coa_account_id, company_id, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction')
    .eq('is_active', true)

  if (error) {
    logError('Batch payment method lookup failed', { error })
    throw new Error(`Failed to lookup payment methods: ${error.message}`)
  }

  // Create normalized map from all payment methods
  interface PaymentMethodRow { 
    id: number; 
    name: string; 
    code: string; 
    is_active: boolean; 
    coa_account_id: string; 
    company_id: string;
    fee_percentage: number;
    fee_fixed_amount: number;
    fee_fixed_per_transaction: boolean;
  }
  const foundMap = new Map<string, PaymentMethodRow>()
  for (const pm of allPaymentMethods || []) {
    const key = normalizePaymentMethodName(pm.name)
    foundMap.set(key, pm)
  }

  // Log found payment methods for debugging
  logInfo('Payment methods lookup result', {
    requested: uniqueNames,
    found: [...foundMap.keys()],
    not_found: uniqueNames.filter(name => !foundMap.has(name))
  })

  // Assign results - ONLY found payment methods
  // NO FALLBACK - if not found, it will be marked as failed
  for (const name of uniqueNames) {
    const pm = foundMap.get(name)
    if (pm) {
      result.set(name, { 
        id: pm.id, 
        isFallback: false, 
        name: pm.name,
        fee_percentage: pm.fee_percentage || 0,
        fee_fixed_amount: pm.fee_fixed_amount || 0,
        fee_fixed_per_transaction: pm.fee_fixed_per_transaction || false,
      })
    } else {
      // DO NOT fallback - mark as not found
      result.set(name, { id: 0, isFallback: false, name: name, fee_percentage: 0, fee_fixed_amount: 0, fee_fixed_per_transaction: false })
      logWarn('Payment method not found - will be marked as failed', { name })
    }
  }

  return result
}

/**
 * Group lines by transaction key (date|branch|payment_method)
 * Payment method name is normalized for consistent grouping
 */
function groupLinesByTransaction(
  lines: any[]
): Map<string, any[]> {
  const groups = new Map<string, any[]>()

  for (const line of lines) {
    const salesDate = line.sales_date || 'unknown'
    const branch = line.branch || 'unknown'
    const paymentMethod = normalizePaymentMethodName(line.payment_method || 'unknown')
    
    const key = `${salesDate}|${branch}|${paymentMethod}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(line)
  }

  return groups
}

/**
 * Store failed transactions with FAILED status
 */
async function storeFailedTransactions(
  failedRecords: FailedTransactionRecord[]
): Promise<number> {
  if (failedRecords.length === 0) return 0

  logInfo('Storing failed transactions', { count: failedRecords.length })

  try {
    const result = await posAggregatesRepository.createFailedBatch(failedRecords)
    logInfo('Failed transactions stored', {
      created: result.created,
      failed: result.failed
    })
    return result.created
  } catch (error) {
    logError('Failed to store failed transactions', { error })
    return 0
  }
}

/**
 * Optimized: Generate aggregated transactions dari POS import lines
 * 
 * @param posImportId - ID dari import
 * @param branchName - Optional branch filter
 * @param companyId - Company ID untuk lookup
 * @param onProgress - Progress callback
 */
export async function generateAggregatedTransactionsOptimized(
  posImportId: string,
  branchName: string | undefined,
  companyId: string,
  onProgress?: ProgressCallback
): Promise<GenerateAggregatedResult> {
  const startTime = Date.now()

  try {
    onProgress?.({ current: 0, total: 100, phase: 'loading', message: 'Loading import lines...' })

    // PHASE 1: Load all lines dari import
    const lines = await posImportLinesRepository.findAllByImportId(posImportId)
    
    if (lines.length === 0) {
      return { created: 0, skipped: 0, failed: 0, errors: [], total_groups: 0 }
    }

    logInfo('Starting optimized aggregated transaction generation', {
      pos_import_id: posImportId,
      total_lines: lines.length
    })

    onProgress?.({ current: 10, total: 100, phase: 'grouping', message: 'Grouping transactions...' })

    // PHASE 2: Group lines by transaction key
    const transactionGroups = groupLinesByTransaction(lines)
    const groupArray = Array.from(transactionGroups.entries())
    const totalGroups = groupArray.length

    logInfo('Transaction groups created', { total_groups: totalGroups })

    // PHASE 3: Batch payment method lookup
    onProgress?.({ current: 20, total: 100, phase: 'lookup', message: 'Resolving payment methods...' })

    // Extract unique payment method names dari groups
    const paymentMethodNames = [...new Set(
      groupArray.map(([key]) => {
        const [, , pm] = key.split('|')
        return pm
      })
    )]

    const pmLookupResult = await resolvePaymentMethodsBatch(paymentMethodNames, companyId)

    const foundCount = [...pmLookupResult.values()].filter(r => r.id > 0).length
    const notFoundCount = [...pmLookupResult.values()].filter(r => r.id === 0).length

    logInfo('Payment methods resolved', { 
      total: paymentMethodNames.length,
      found: foundCount,
      not_found: notFoundCount
    })

    if (notFoundCount > 0) {
      logWarn('Some payment methods not found - will be marked as FAILED', {
        not_found: [...pmLookupResult.entries()]
          .filter(([_, v]) => v.id === 0)
          .map(([k, v]) => ({ name: k, original_name: v.name }))
      })
    }

    // PHASE 4: Check existing sources (batch)
    onProgress?.({ current: 30, total: 100, phase: 'checking', message: 'Checking duplicates...' })

    // Build list of source_refs untuk check existence
    const sourceRefsToCheck = groupArray.map(([key]) => {
      return {
        source_type: 'POS' as AggregatedTransactionSourceType,
        source_id: posImportId,
        source_ref: key.replace(/\|/g, '-')
      }
    })

    // Batch check existence - split into chunks untuk avoid large queries
    const existingSources = new Set<string>()
    
    for (let i = 0; i < sourceRefsToCheck.length; i += CHECK_BATCH_SIZE) {
      const batch = sourceRefsToCheck.slice(i, i + CHECK_BATCH_SIZE)
      
      // Check each dalam batch
      for (const { source_type, source_id, source_ref } of batch) {
        const exists = await posAggregatesRepository.sourceExists(source_type, source_id, source_ref)
        if (exists) {
          existingSources.add(source_ref)
        }
      }

      // Progress update
      const progress = 30 + Math.min(20, Math.floor((i / sourceRefsToCheck.length) * 20))
      onProgress?.({ current: progress, total: 100, phase: 'checking', message: `Checking duplicates ${Math.min(i + batch.length, totalGroups)}/${totalGroups}...` })
    }

    logInfo('Duplicate check complete', { existing_count: existingSources.size })

    // PHASE 5: Prepare insert data - SEPARATE valid and invalid
    onProgress?.({ current: 50, total: 100, phase: 'preparing', message: 'Preparing transaction data...' })

    const insertDataArray: Array<{
      data: Omit<AggregatedTransaction, 'id' | 'created_at' | 'updated_at' | 'version'>
      sourceRef: string
    }> = []
    const skippedGroups: string[] = []
    const failedRecords: FailedTransactionRecord[] = []

    for (let i = 0; i < groupArray.length; i++) {
      const [groupKey, groupLines] = groupArray[i]
      const sourceRef = groupKey.replace(/\|/g, '-')

      // Skip jika sudah ada
      if (existingSources.has(sourceRef)) {
        skippedGroups.push(sourceRef)
        continue
      }

      try {
        const firstLine = groupLines[0]
        
        // Get payment method ID dari lookup result
        // Use normalized key to match with lookup result
        const pmKey = normalizePaymentMethodName(firstLine.payment_method || 'unknown')
        const pmResult = pmLookupResult.get(pmKey)

        if (!pmResult || pmResult.id === 0) {
          // Payment method NOT FOUND - mark as FAILED
          const errorMsg = `Payment method "${firstLine.payment_method}" tidak ditemukan di database`
          
const failedData = {
            branch_name: firstLine.branch?.trim() || null,
            source_type: 'POS' as AggregatedTransactionSourceType,
            source_id: posImportId,
            source_ref: sourceRef,
            transaction_date: firstLine.sales_date || new Date().toISOString().split('T')[0],
            payment_method_id: 20, // Temporary, will be fixed during retry
            gross_amount: 0,
            discount_amount: 0,
            tax_amount: 0,
            service_charge_amount: 0,
            bill_after_discount: 0,
            percentage_fee_amount: 0,
            fixed_fee_amount: 0,
            total_fee_amount: 0,
            nett_amount: 0,
            currency: 'IDR',
            journal_id: null,
            is_reconciled: false,
            status: 'FAILED' as AggregatedTransactionStatus,
            deleted_at: null,
            deleted_by: null,
            failed_at: new Date().toISOString(),
            failed_reason: errorMsg,
          }

          failedRecords.push({
            data: failedData,
            error: errorMsg
          })
          
          continue
        }

        // Calculate aggregated amounts
        const grossAmount = groupLines.reduce((sum: number, line: any) => sum + Number(line.subtotal || 0), 0)
        const discountAmount = groupLines.reduce((sum: number, line: any) => sum + Number(line.discount || 0), 0)
        const billDiscountAmount = groupLines.reduce((sum: number, line: any) => sum + Number(line.bill_discount || 0), 0)
        const taxAmount = groupLines.reduce((sum: number, line: any) => sum + Number(line.tax || 0), 0)
        
        // Bill after discount = gross + tax - discount
        const billAfterDiscount = grossAmount + taxAmount - (discountAmount + billDiscountAmount)
        
        // 🔥 CALCULATE FEE from payment method configuration
        // percentage_fee = bill_after_discount × fee_percentage / 100
        const percentageFeeAmount = pmResult.fee_percentage > 0
          ? billAfterDiscount * (pmResult.fee_percentage / 100)
          : 0
        
        // fixed_fee = fee_fixed_amount (per transaction)
        const fixedFeeAmount = pmResult.fee_fixed_amount || 0
        
        // total_fee = percentage + fixed
        const totalFeeAmount = percentageFeeAmount + fixedFeeAmount
        
// Nett amount = bill after discount - total fee
        const nettAmount = billAfterDiscount - totalFeeAmount

        logInfo('Fee calculated for transaction', {
          source_ref: sourceRef,
          gross_amount: grossAmount,
          discount_amount: discountAmount + billDiscountAmount,
          tax_amount: taxAmount,
          bill_after_discount: billAfterDiscount,
          fee_percentage: pmResult.fee_percentage,
          percentage_fee: percentageFeeAmount,
          fixed_fee: fixedFeeAmount,
          total_fee: totalFeeAmount,
          nett_amount: nettAmount
        })

        // Prepare insert data
        const insertData = {
          branch_name: firstLine.branch?.trim() || null,
          source_type: 'POS' as AggregatedTransactionSourceType,
          source_id: posImportId,
          source_ref: sourceRef,
          transaction_date: firstLine.sales_date || new Date().toISOString().split('T')[0],
          payment_method_id: pmResult.id,
          gross_amount: grossAmount,
          discount_amount: discountAmount + billDiscountAmount,
          tax_amount: taxAmount,
          service_charge_amount: 0,
          bill_after_discount: billAfterDiscount,
          percentage_fee_amount: percentageFeeAmount,
          fixed_fee_amount: fixedFeeAmount,
          total_fee_amount: totalFeeAmount,
          nett_amount: nettAmount,
          currency: 'IDR',
          journal_id: null,
          is_reconciled: false,
          status: 'READY' as AggregatedTransactionStatus,
          deleted_at: null,
          deleted_by: null,
          failed_at: null,
          failed_reason: null,
        }

        insertDataArray.push({ data: insertData, sourceRef })

} catch (error) {
        logError('Failed to prepare transaction', { source_ref: sourceRef, error })
        failedRecords.push({
          data: {
            branch_name: null,
            source_type: 'POS',
            source_id: posImportId,
            source_ref: sourceRef,
            transaction_date: new Date().toISOString().split('T')[0],
            payment_method_id: 20,
            gross_amount: 0,
            discount_amount: 0,
            tax_amount: 0,
            service_charge_amount: 0,
            bill_after_discount: 0,
            percentage_fee_amount: 0,
            fixed_fee_amount: 0,
            total_fee_amount: 0,
            nett_amount: 0,
            currency: 'IDR',
            journal_id: null,
            is_reconciled: false,
            status: 'FAILED',
            deleted_at: null,
            deleted_by: null,
            failed_at: new Date().toISOString(),
            failed_reason: error instanceof Error ? error.message : 'Unknown error',
          },
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Progress update every 500 groups
      if (i % 500 === 0) {
        const progress = 50 + Math.min(20, Math.floor((i / groupArray.length) * 20))
        onProgress?.({ current: progress, total: 100, phase: 'preparing', message: `Preparing ${i}/${totalGroups}...` })
      }
    }

    // PHASE 6: Bulk insert dengan chunked processing
    onProgress?.({ current: 70, total: 100, phase: 'inserting', message: 'Inserting transactions...' })

    let createdCount = 0
    const insertErrors: Array<{ source_ref: string; error: string }> = []

    // Split insert data into batches
    for (let i = 0; i < insertDataArray.length; i += BATCH_SIZE) {
      const batch = insertDataArray.slice(i, i + BATCH_SIZE)
      const batchData = batch.map(b => b.data)

      try {
        const result = await posAggregatesRepository.createBatchBulk(
          batchData,
          (current, total) => {
            // Progress dalam batch
          }
        )

        createdCount += result.success.length
        insertErrors.push(...result.failed.map(f => ({ source_ref: f.source_ref, error: f.error })))

      } catch (error) {
        logError('Batch insert failed', { batch_start: i, error })
        // Fallback: try one by one
        for (const item of batch) {
          try {
            await posAggregatesRepository.create(item.data)
            createdCount++
          } catch (err) {
            insertErrors.push({
              source_ref: item.sourceRef,
              error: err instanceof Error ? err.message : 'Unknown error'
            })
          }
        }
      }

      // Progress update
      const progress = 70 + Math.min(25, Math.floor((i / insertDataArray.length) * 25))
      onProgress?.({ current: progress, total: 100, phase: 'inserting', message: `Inserting ${Math.min(i + BATCH_SIZE, insertDataArray.length)}/${insertDataArray.length}...` })
    }

    // PHASE 6b: Store failed transactions
    let failedStoredCount = 0
    if (failedRecords.length > 0) {
      onProgress?.({ current: 85, total: 100, phase: 'storing_failed', message: 'Storing failed transactions...' })
      failedStoredCount = await storeFailedTransactions(failedRecords)
    }

    // Combine all errors
    const allErrors = [
      ...insertErrors,
      ...failedRecords.map(f => ({ source_ref: f.data.source_ref, error: f.error }))
    ]

    // PHASE 7: Finalization
    onProgress?.({ current: 95, total: 100, phase: 'finalizing', message: 'Updating import status...' })

    // Update pos_import status ke MAPPED
    if (createdCount > 0 || skippedGroups.length > 0) {
      try {
        await supabase
          .from('pos_imports')
          .update({
            status: 'MAPPED',
            updated_at: new Date().toISOString()
          })
          .eq('id', posImportId)
      } catch (statusError) {
        logError('Failed to update pos_import status', { pos_import_id: posImportId, error: statusError })
      }
    }

    // Update pos_import status ke FAILED jika semua gagal
    if (createdCount === 0 && skippedGroups.length === 0 && failedStoredCount > 0) {
      try {
        await supabase
          .from('pos_imports')
          .update({
            status: 'FAILED',
            error_message: `${failedStoredCount} transactions failed - check /pos-aggregates/failed-transactions`,
            updated_at: new Date().toISOString()
          })
          .eq('id', posImportId)
      } catch (statusError) {
        logError('Failed to update pos_import status to FAILED', { pos_import_id: posImportId, error: statusError })
      }
    }

    const duration = Date.now() - startTime

    onProgress?.({ current: 100, total: 100, phase: 'complete', message: 'Done!' })

    logInfo('Optimized aggregated transaction generation complete', {
      pos_import_id: posImportId,
      total_groups: totalGroups,
      created: createdCount,
      skipped: skippedGroups.length,
      failed: failedStoredCount,
      total_failed: allErrors.length,
      duration_ms: duration
    })

    return {
      created: createdCount,
      skipped: skippedGroups.length,
      failed: failedStoredCount,
      errors: allErrors,
      total_groups: totalGroups
    }

  } catch (error) {
    logError('generateAggregatedTransactionsOptimized failed', { pos_import_id: posImportId, error })
    throw error
  }
}

/**
 * Simple version tanpa progress callback
 */
export async function generateAggregatedTransactions(
  posImportId: string,
  branchName: string | undefined,
  companyId: string
): Promise<GenerateAggregatedResult> {
  return generateAggregatedTransactionsOptimized(posImportId, branchName, companyId)
}
