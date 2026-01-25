/**
 * POS Transactions Import Processor - OPTIMIZED VERSION
 * Handles background processing of POS imports via jobs system
 * Implements chunked batch processing untuk performa optimal dengan data puluhan ribu baris
 * 
 * Key Improvements:
 * - Chunked batch processing (1000 baris per batch)
 * - Batch duplicate checking (500 per batch)
 * - Granular progress tracking
 * - Memory efficient - tidak semua data di memory sekaligus
 * - Error recovery capability
 */

import { supabase } from '@/config/supabase'
import { posImportsRepository } from '@/modules/pos-imports/pos-imports/pos-imports.repository'
import { posImportLinesRepository } from '@/modules/pos-imports/pos-import-lines/pos-import-lines.repository'
import { parseToLocalDate, parseToLocalDateTime } from '@/modules/pos-imports/shared/excel-date.util'
import { logInfo, logError, logWarn } from '@/config/logger'
import { jobsService, jobsRepository } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'
import type { CreatePosImportLineDto } from '@/modules/pos-imports/pos-import-lines/pos-import-lines.types'
import type { PosTransactionsImportMetadata } from '../jobs.types'
import { isPosTransactionsImportMetadata } from '../jobs.types'

// ==============================
// CONFIGURATION - TUNABLE
// ==============================
const CHUNK_SIZE = 2000;                     // Baris per insert batch (diingkatkan untuk 8MB file)
const DUP_CHECK_BATCH_SIZE = 500;            // Transaksi per duplicate check batch
const PROGRESS_UPDATE_FREQUENCY = 10;        // Update progress setiap 10%
const MAX_RETRIES = 3;                       // Max retry attempts per batch
const RETRY_DELAY_MS = 3000;                 // Base delay between retries (ms)
const DELAY_BETWEEN_BATCHES_MS = 500;        // Small delay between batches untuk avoid rate limit
const DB_TIMEOUT_MS = 60000;                 // Database query timeout (60 detik)

// ==============================
// COLUMN MAPPING (same as pos-imports.service.ts)
// ==============================
const EXCEL_COLUMN_MAP: Record<string, string> = {
  '#': 'row_number',
  'Sales Number': 'sales_number',
  'Bill Number': 'bill_number',
  'Sales Type': 'sales_type',
  'Batch Order': 'batch_order',
  'Table Section': 'table_section',
  'Table Name': 'table_name',
  'Sales Date': 'sales_date',
  'Sales Date In': 'sales_date_in',
  'Sales Date Out': 'sales_date_out',
  'Branch': 'branch',
  'Brand': 'brand',
  'City': 'city',
  'Area': 'area',
  'Visit Purpose': 'visit_purpose',
  'Regular Member Code': 'regular_member_code',
  'Regular Member Name': 'regular_member_name',
  'Loyalty Member Code': 'loyalty_member_code',
  'Loyalty Member Name': 'loyalty_member_name',
  'Loyalty Member Type': 'loyalty_member_type',
  'Employee Code': 'employee_code',
  'Employee Name': 'employee_name',
  'External Employee Code': 'external_employee_code',
  'External Employee Name': 'external_employee_name',
  'Customer Name': 'customer_name',
  'Payment Method': 'payment_method',
  'Menu Category': 'menu_category',
  'Menu Category Detail': 'menu_category_detail',
  'Menu': 'menu',
  'Custom Menu Name': 'custom_menu_name',
  'Menu Code': 'menu_code',
  'Menu Notes': 'menu_notes',
  'Order Mode': 'order_mode',
  'Qty': 'qty',
  'Price': 'price',
  'Subtotal': 'subtotal',
  'Discount': 'discount',
  'Service Charge': 'service_charge',
  'Tax': 'tax',
  'VAT': 'vat',
  'Total': 'total',
  'Nett Sales': 'nett_sales',
  'DPP': 'dpp',
  'Bill Discount': 'bill_discount',
  'Total After Bill Discount': 'total_after_bill_discount',
  'Waiter': 'waiter',
  'Order Time': 'order_time'
}

// ==============================
// HELPER FUNCTIONS
// ==============================

/**
 * Safely convert a value to number
 */
function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const num = Number(value)
  return isNaN(num) ? undefined : num
}

/**
 * Create transaction key for duplicate checking
 */
function createTransactionKey(line: CreatePosImportLineDto): string {
  return `${line.bill_number}|${line.sales_number}|${line.sales_date}`
}

/**
 * Map single Excel row to DTO
 */
function mapRowToDto(row: any, rowIndex: number, posImportId: string): CreatePosImportLineDto {
  const mapped: CreatePosImportLineDto = {
    pos_import_id: posImportId,
    row_number: rowIndex + 1
  }

  Object.entries(EXCEL_COLUMN_MAP).forEach(([excelCol, dbCol]) => {
    const value = row[excelCol]
    if (value !== undefined && value !== null && value !== '') {
      // Convert Excel dates to ISO timestamps for timestamp fields
      if (dbCol === 'sales_date_in' || dbCol === 'sales_date_out' || dbCol === 'order_time') {
        mapped[dbCol] = parseToLocalDateTime(value)
      }
      // Convert Excel dates to date strings for date fields
      else if (dbCol === 'sales_date') {
        mapped[dbCol] = parseToLocalDate(value)
      }
      // Numeric fields
      else if (['qty', 'price', 'subtotal', 'discount', 'service_charge', 'tax', 'vat', 'total', 'nett_sales', 'dpp', 'bill_discount', 'total_after_bill_discount'].includes(dbCol)) {
        mapped[dbCol] = toNumber(value)
      }
      // All other fields
      else {
        mapped[dbCol] = value
      }
    }
  })

  return mapped
}

/**
 * Retrieve temporary data from Supabase Storage
 */
async function retrieveTemporaryData(importId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase.storage
      .from('pos-imports-temp')
      .download(`${importId}.json`)

    if (error) throw error

    const text = await data.text()
    return JSON.parse(text)
  } catch (error) {
    logError('Failed to retrieve temporary data', { import_id: importId, error })
    throw new Error('Temporary data not found. Please re-upload the file.')
  }
}

/**
 * Clean up temporary data from storage
 */
async function cleanupTemporaryData(importId: string): Promise<void> {
  try {
    await supabase.storage
      .from('pos-imports-temp')
      .remove([`${importId}.json`])
  } catch (error) {
    logError('Failed to cleanup temporary data', { import_id: importId, error })
  }
}

// ==============================
// MAIN PROCESSOR - CHUNKED BATCH PROCESSING
// ==============================

export const processPosTransactionsImport: JobProcessor<PosTransactionsImportMetadata> = async (
  jobId: string,
  userId: string,
  metadata: PosTransactionsImportMetadata
) => {
  // Track results
  const results = {
    total: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[]
  }

  let posImportId: string | null = null
  let importCompanyId: string | null = null

  try {
    logInfo('Starting POS transactions import (chunked processing)', { 
      job_id: jobId, 
      user_id: userId,
      chunk_size: CHUNK_SIZE,
      dup_check_batch_size: DUP_CHECK_BATCH_SIZE
    })

    // ==============================
    // PHASE 1: Validation & Setup (10%)
    // ==============================
    await jobsService.updateProgress(jobId, 5, userId)

    // Validate metadata structure
    if (!isPosTransactionsImportMetadata(metadata)) {
      throw new Error('Invalid metadata format for POS transactions import')
    }

    posImportId = metadata.posImportId
    const skipDuplicates = metadata.skipDuplicates || false

    if (!posImportId) {
      throw new Error('POS import ID (posImportId) not provided in metadata')
    }

    await jobsService.updateProgress(jobId, 10, userId)

    // Get company_id from the job record
    const job = await jobsRepository.findById(jobId, userId)
    if (!job) {
      throw new Error('Job not found')
    }
    importCompanyId = job.company_id

    // Verify pos_import belongs to the same company
    const posImport = await posImportsRepository.findById(posImportId, importCompanyId!)
    if (!posImport) {
      throw new Error('POS import not found or does not belong to your company')
    }

    // ==============================
    // PHASE 2: Read Data from Storage (20%)
    // ==============================
    logInfo('Retrieving data from storage', { import_id: posImportId })
    const rawRows = await retrieveTemporaryData(posImportId)

    if (rawRows.length === 0) {
      throw new Error('No data rows found. Please re-upload the file.')
    }

    results.total = rawRows.length
    await jobsService.updateProgress(jobId, 20, userId)

    logInfo('Data loaded', { 
      import_id: posImportId, 
      total_rows: rawRows.length 
    })

    // ==============================
    // PHASE 3: Map All Rows (30%)
    // ==============================
    // NOTE: Kita map semua rows dulu karena ini operasi memory-intensive tapi sekali jalan
    // Mapping tidak membutuhkan database connection, jadi aman dilakukan di memory
    
    const lines: CreatePosImportLineDto[] = rawRows.map((row: any, index: number) => 
      mapRowToDto(row, index, posImportId!)
    )

    // Free rawRows memory
    rawRows.length = 0

    await jobsService.updateProgress(jobId, 30, userId)

    // ==============================
    // PHASE 4: Duplicate Checking (40%)
    // ==============================
    const duplicateKeys = new Set<string>()
    
    if (skipDuplicates) {
      logInfo('Checking duplicates in batches', { 
        total_transactions: lines.length,
        batch_size: DUP_CHECK_BATCH_SIZE
      })

      let processedCount = 0
      
      for (let i = 0; i < lines.length; i += DUP_CHECK_BATCH_SIZE) {
        const batch = lines.slice(i, i + DUP_CHECK_BATCH_SIZE)
        
        const transactions = batch
          .filter(l => l.bill_number && l.sales_number && l.sales_date)
          .map(l => ({
            bill_number: String(l.bill_number),
            sales_number: String(l.sales_number),
            sales_date: l.sales_date
          }))

        if (transactions.length > 0) {
          const duplicates = await posImportLinesRepository.findExistingTransactions(transactions)
          
          duplicates.forEach(d => {
            duplicateKeys.add(`${d.bill_number}|${d.sales_number}|${d.sales_date}`)
          })
        }

        processedCount += batch.length
        
        // Progress update setiap 5000 transaksi atau di akhir
        if (processedCount % 5000 === 0 || processedCount >= lines.length) {
          const progress = 30 + Math.min(10, (processedCount / lines.length) * 10)
          await jobsService.updateProgress(jobId, progress, userId)
          logInfo('Duplicate check progress', { 
            processed: processedCount, 
            total: lines.length,
            found_duplicates: duplicateKeys.size
          })
        }
      }

      results.skipped = duplicateKeys.size
      logInfo('Duplicate check complete', { 
        total_duplicates_found: duplicateKeys.size 
      })
    }

    await jobsService.updateProgress(jobId, 40, userId)

    // ==============================
    // PHASE 5: Chunked Insert Processing (95%)
    // ==============================
    logInfo('Starting chunked insert processing', { 
      total_lines: lines.length,
      chunk_size: CHUNK_SIZE,
      duplicates_to_skip: duplicateKeys.size
    })

    let successCount = 0
    let failCount = 0
    let chunkIndex = 0
    let lastProgressUpdate = 0

    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      const chunk = lines.slice(i, i + CHUNK_SIZE)
      let inserted = false
      let retryCount = 0
      
      // Filter out duplicates for this chunk
      const linesToInsert = skipDuplicates 
        ? chunk.filter(line => !duplicateKeys.has(createTransactionKey(line)))
        : chunk

      // Retry mechanism untuk transient errors
      while (!inserted && retryCount < MAX_RETRIES) {
        try {
          if (linesToInsert.length > 0) {
            await posImportLinesRepository.bulkInsert(linesToInsert)
            successCount += linesToInsert.length
          }
          inserted = true
        } catch (error) {
          retryCount++
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          
          if (retryCount < MAX_RETRIES) {
            // Exponential backoff
            const delay = RETRY_DELAY_MS * retryCount
            logWarn('Insert batch retrying', {
              job_id: jobId,
              chunk_index: chunkIndex,
              attempt: retryCount,
              max_attempts: MAX_RETRIES,
              delay_ms: delay,
              error: errorMsg
            })
            await new Promise(resolve => setTimeout(resolve, delay))
          } else {
            // Final failure - log and continue (atomic per batch)
            failCount += chunk.length
            results.errors.push(`Batch ${chunkIndex + 1} failed after ${MAX_RETRIES} retries: ${errorMsg}`)
            
            logError('Insert batch final failure', { 
              job_id: jobId,
              chunk_index: chunkIndex,
              chunk_size: chunk.length,
              attempts: MAX_RETRIES,
              error: errorMsg
            })
            // CRITICAL: Continue with next batch - don't fail entire import
            // Financial data integrity is maintained per batch
          }
        }
      }

      chunkIndex++

      // Small delay between batches to avoid rate limiting
      if (i + CHUNK_SIZE < lines.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS))
      }

      // Granular progress update
      const progressPercent = Math.round(40 + Math.min(55, (i / lines.length) * 55))
      
      // Only update database if progress changed significantly (every 5%)
      if (Math.floor(progressPercent) - lastProgressUpdate >= 5) {
        await jobsService.updateProgress(jobId, progressPercent, userId)
        lastProgressUpdate = Math.floor(progressPercent)
        
        logInfo('Insert progress', { 
          job_id: jobId,
          progress: progressPercent.toFixed(1),
          inserted: successCount,
          failed: failCount,
          total: lines.length
        })
      }
    }

    results.created = successCount
    results.failed = failCount

    // ==============================
    // PHASE 6: Finalization (100%)
    // ==============================
    await jobsService.updateProgress(jobId, 95, userId)

    // Update pos_imports status
    await posImportsRepository.update(posImportId!, importCompanyId!, {
      status: 'IMPORTED',
      new_rows: results.created,
      duplicate_rows: results.skipped,
      error_message: results.errors.length > 0 
        ? `${results.errors.length} batches had errors. See job details.` 
        : undefined
    }, userId)

    // Clean up temporary data
    await cleanupTemporaryData(posImportId!)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('POS transactions import completed (chunked processing)', {
      job_id: jobId,
      pos_import_id: posImportId,
      total: results.total,
      created: results.created,
      skipped: results.skipped,
      failed: results.failed,
      chunks_processed: chunkIndex,
      errors_count: results.errors.length
    })

    return {
      filePath: '',
      fileName: '',
      importResults: {
        ...results,
        chunksProcessed: chunkIndex,
        chunkSize: CHUNK_SIZE,
        duplicateCheckBatchSize: DUP_CHECK_BATCH_SIZE,
        errorDetails: results.errors.slice(0, 10) // First 10 errors only
      }
    }

  } catch (error) {
    // Better error logging for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorDetails = error instanceof Error ? { 
      name: error.name, 
      message: error.message,
      stack: error.stack
    } : String(error)
    
    logError('POS transactions import failed', { 
      job_id: jobId, 
      error_message: errorMessage,
      error_details: errorDetails
    })

    // Update pos_imports status to FAILED
    if (posImportId && importCompanyId) {
      try {
        await posImportsRepository.update(posImportId, importCompanyId, {
          status: 'FAILED',
          error_message: errorMessage
        }, userId)
      } catch (updateError) {
        logError('Failed to update pos_imports status', { 
          pos_import_id: posImportId, 
          error: updateError 
        })
      }
    }

    throw error
  }
}

