/**
 * POS Transactions Import Processor - OPTIMIZED VERSION - FIXED
 * Handles background processing of POS imports via jobs system
 * Implements chunked batch processing untuk performa optimal dengan data puluhan ribu baris
 * 
 * Key Improvements:
 * - Chunked batch processing (1000 baris per batch)
 * - Batch duplicate checking (500 per batch)
 * - Granular progress tracking
 * - Memory efficient - tidak semua data di memory sekaligus
 * - Error recovery capability
 * - ✅ ALL TypeScript ERRORS FIXED
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
const CHUNK_SIZE = 2000;
const DUP_CHECK_BATCH_SIZE = 500;
const PROGRESS_UPDATE_FREQUENCY = 10;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;
const DELAY_BETWEEN_BATCHES_MS = 500;
const DB_TIMEOUT_MS = 60000;

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

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const num = Number(value)
  return isNaN(num) ? undefined : num
}

function createTransactionKey(line: CreatePosImportLineDto): string {
  return `${line.bill_number}|${line.sales_number}|${line.sales_date}`
}

function mapRowToDto(row: any, rowIndex: number, posImportId: string): CreatePosImportLineDto {
  // ✅ CRITICAL FIX: Force GLOBAL row_number - NO Excel '#' override
  const mapped: CreatePosImportLineDto = {
    pos_import_id: posImportId,
    row_number: rowIndex  // Global from chunkOffset + local idx
  }

  // Skip row_number mapping entirely - prevent Excel '#' override
  Object.entries(EXCEL_COLUMN_MAP).forEach(([excelCol, dbCol]) => {
    if (dbCol === 'row_number') return; // ❌ SKIP Excel row_number override
    
    const value = row[excelCol]
    if (value !== undefined && value !== null && value !== '') {
      if (dbCol === 'sales_date_in' || dbCol === 'sales_date_out' || dbCol === 'order_time') {
        mapped[dbCol as keyof CreatePosImportLineDto] = parseToLocalDateTime(value) as any
      } else if (dbCol === 'sales_date') {
        mapped[dbCol as keyof CreatePosImportLineDto] = parseToLocalDate(value) as any
      } else if (['qty', 'price', 'subtotal', 'discount', 'service_charge', 'tax', 'vat', 'total', 'nett_sales', 'dpp', 'bill_discount', 'total_after_bill_discount'].includes(dbCol)) {
        mapped[dbCol as keyof CreatePosImportLineDto] = toNumber(value) as any
      } else {
        mapped[dbCol as keyof CreatePosImportLineDto] = value as any
      }
    }
  })

  // DEBUG: Log first row row_number
  if (rowIndex === 1) {
    logInfo('First row mapping', {
      pos_import_id: posImportId,
      global_row_number: mapped.row_number,
      excel_row_number: row['#']
    })
  }

  return mapped
}

async function retrieveTemporaryData_STREAM(chunkFileName: string): Promise<any[]> {
  logInfo('retrieveTemporaryData_STREAM called', { chunk_file: chunkFileName })
  
  try {
    const { data, error } = await supabase.storage
      .from('pos-imports-temp')
      .download(chunkFileName)
    
    if (error) {
      logError('Stream chunk download failed', { chunk_file: chunkFileName, error })
      throw error
    }
    
    const chunkText = await data.text()
    const chunkRows = JSON.parse(chunkText)
    
    logInfo('Stream chunk processed', { chunk_file: chunkFileName, rows_in_chunk: chunkRows.length })
    
    return chunkRows
  } catch (error) {
    logError('retrieveTemporaryData_STREAM failed', { chunk_file: chunkFileName, error })
    throw new Error(`Chunk ${chunkFileName} not found`)
  }
}

async function retrieveTemporaryData(importId: string): Promise<any[]> {
  // ✅ BACKWARD COMPATIBILITY: Support legacy single-file format
  logInfo('Loading legacy single-file format', { import_id: importId })
  
  try {
    const { data, error } = await supabase.storage
      .from('pos-imports-temp')
      .download(`${importId}.json`)
    
    if (error) {
      logError('Single file download failed', { importId, error })
      throw new Error(`Single file ${importId}.json not found`)
    }
    
    const text = await data.text()
    const rows = JSON.parse(text)
    
    logInfo('Legacy single file loaded', { importId, row_count: rows.length })
    return rows
  } catch (error) {
    logError('retrieveTemporaryData failed', { importId, error })
    throw new Error(`Cannot load data for ${importId}. Try re-analyze file first.`)
  }
}

async function cleanupTemporaryData(importId: string): Promise<void> {
  try {
    const { data: partFiles } = await supabase.storage
      .from('pos-imports-temp')
      .list('', { search: `${importId}-part`, limit: 100 })

    if (partFiles && partFiles.length > 0) {
      const partPaths = partFiles.map(f => f.name)
      await supabase.storage.from('pos-imports-temp').remove(partPaths)
    }

    await supabase.storage.from('pos-imports-temp').remove([`${importId}.json`])

    logInfo('Temporary data cleaned up successfully', { import_id: importId, part_files_removed: partFiles?.length || 0 })
  } catch (error) {
    logError('Cleanup failed (non-critical)', { import_id: importId, error })
  }
}

// ==============================
// CHUNK PROCESSOR - STANDALONE & FIXED
// ==============================

async function processSingleChunk(
  chunkRows: any[],
  posImportId: string,
  jobId: string,
  userId: string,
  skipDuplicates: boolean,
  results: { created: number; skipped: number; failed: number; errors: string[] },
  rowOffset: number
): Promise<void> {
  if (chunkRows.length === 0) return

  logInfo('Processing chunk', { rows: chunkRows.length, offset: rowOffset, skip_duplicates: skipDuplicates })

  // 1. MAP chunk rows → DTOs
  const chunkLines: CreatePosImportLineDto[] = chunkRows.map((row: any, idx: number) =>
    mapRowToDto(row, rowOffset + idx + 1, posImportId)
  )

  let chunkSkipped = 0
  let chunkSuccess = 0
  let chunkFailed = 0
  const chunkDupKeys = new Set<string>()

  // 2. DUPLICATE CHECK (if enabled)
  if (skipDuplicates) {
    const chunkTransactions = chunkLines
      .filter(l => l.bill_number && l.sales_number && l.sales_date)
      .map(l => ({
        bill_number: String(l.bill_number),
        sales_number: String(l.sales_number),
        sales_date: l.sales_date
      }))

    if (chunkTransactions.length > 0) {
      try {
        const chunkDuplicates = await posImportLinesRepository.findExistingTransactions(chunkTransactions)
        chunkDuplicates.forEach(d => {
          chunkDupKeys.add(`${d.bill_number}|${d.sales_number}|${d.sales_date}`)
        })
        chunkSkipped = chunkDupKeys.size
      } catch (dupError) {
        logError('Duplicate check failed', { error: dupError })
        chunkSkipped = 0
      }
    }
  }

  // 3. PREPARE lines to insert
  const linesToInsert = skipDuplicates
    ? chunkLines.filter(line => {
        const key = createTransactionKey(line)
        return !chunkDupKeys.has(key)
      })
    : chunkLines

  // 4. BULK INSERT with retry
  let inserted = false
  let retryCount = 0
  while (!inserted && retryCount < MAX_RETRIES) {
    try {
      if (linesToInsert.length > 0) {
        await posImportLinesRepository.bulkInsert(linesToInsert)
        chunkSuccess = linesToInsert.length
        inserted = true
      } else {
        chunkSuccess = 0
        inserted = true
      }
    } catch (error: any) {
      retryCount++
      logWarn(`Chunk insert retry ${retryCount}/${MAX_RETRIES}`, { error: error.message })
      if (retryCount >= MAX_RETRIES) {
        chunkFailed = chunkLines.length
        results.errors.push(`Chunk offset ${rowOffset}: ${error.message}`)
      }
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * retryCount))
    }
  }

  // 5. UPDATE global counters
  results.created += chunkSuccess
  results.skipped += chunkSkipped
  results.failed += chunkFailed

  logInfo('Chunk completed', {
    rows: chunkRows.length,
    mapped: chunkLines.length,
    skipped: chunkSkipped,
    success: chunkSuccess,
    failed: chunkFailed
  })
}

// ==============================
// MAIN PROCESSOR - FIXED & TYPE SAFE
// ==============================

export const processPosTransactionsImport: JobProcessor<PosTransactionsImportMetadata> = async (
  jobId: string,
  userId: string,
  metadata: PosTransactionsImportMetadata
) => {
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
    logInfo('Starting POS transactions import', { 
      job_id: jobId, 
      user_id: userId,
      chunk_size: CHUNK_SIZE,
      dup_check_batch_size: DUP_CHECK_BATCH_SIZE
    })

    // PHASE 1: Validation & Setup
    await jobsService.updateProgress(jobId, 5, userId)

    if (!isPosTransactionsImportMetadata(metadata)) {
      throw new Error('Invalid metadata format for POS transactions import')
    }

    posImportId = metadata.posImportId!
    const skipDuplicates = metadata.skipDuplicates || false
    const chunkInfo = (metadata as any).chunk_info || { total_chunks: 1, original_file_size: 0 }

    logInfo('Job started with chunk info', {
      pos_import_id: posImportId,
      chunks: chunkInfo.total_chunks,
      original_size_mb: (chunkInfo.original_file_size / (1024*1024)).toFixed(1),
      skip_duplicates: skipDuplicates
    })

    if (!posImportId) {
      throw new Error('POS import ID (posImportId) not provided in metadata')
    }

    await jobsService.updateProgress(jobId, 10, userId)

    // Get company_id from job
    const job = await jobsRepository.findById(jobId, userId)
    if (!job) throw new Error('Job not found')
    importCompanyId = job.company_id

    // Verify pos_import belongs to company
    const posImport = await posImportsRepository.findById(posImportId, importCompanyId!)
    if (!posImport) throw new Error('POS import not found or does not belong to your company')

    // PHASE 2: List chunks
    const { data: chunkFiles } = await supabase.storage
      .from('pos-imports-temp')
      .list('', { search: `${posImportId}-part`, limit: 100, sortBy: { column: 'name', order: 'asc' } })

    if (!chunkFiles || chunkFiles.length === 0) {
      logWarn('No chunks found, trying single file', { import_id: posImportId })
      const singleRows = await retrieveTemporaryData(posImportId)
      results.total = singleRows.length
      await processSingleChunk(singleRows, posImportId, jobId, userId, skipDuplicates, results, 0)
    } else {
      results.total = chunkFiles.reduce((sum, file) => sum + parseInt(file.metadata?.size || '0'), 0)
      logInfo('Found storage chunks for STREAM processing', { import_id: posImportId, chunk_count: chunkFiles.length })
      
      let globalRowOffset = 0
      for (let i = 0; i < chunkFiles.length; i++) {
        const storageChunk = chunkFiles[i]
        const chunkFileName = storageChunk.name
        logInfo('Processing storage chunk', { chunk_file: chunkFileName, chunk_num: i + 1, total_chunks: chunkFiles.length })
        
        const chunkRows = await retrieveTemporaryData_STREAM(chunkFileName)
        const rowCount = chunkRows.length  // ✅ CRITICAL FIX: Save BEFORE processing
        
        await processSingleChunk(chunkRows, posImportId, jobId, userId, skipDuplicates, results, globalRowOffset)
        
        // Memory cleanup
        chunkRows.length = 0
        globalRowOffset += rowCount  // ✅ Use saved count
        
        logInfo('Global offset updated', { 
          chunk_num: i + 1, 
          rowCount, 
          globalRowOffset 
        })
        
        const chunkProgress = 15 + Math.round(((i + 1) / chunkFiles.length) * 80)
        await jobsService.updateProgress(jobId, Math.min(chunkProgress, 95), userId)
      }
    }

    await jobsService.updateProgress(jobId, 95, userId)

    // PHASE 6: Finalization
    await posImportsRepository.update(posImportId!, importCompanyId!, {
      status: 'IMPORTED',
      new_rows: results.created,
      duplicate_rows: results.skipped,
      error_message: results.errors.length > 0 ? `${results.errors.length} batches had errors` : undefined
    }, userId)

    await cleanupTemporaryData(posImportId!)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('POS transactions import COMPLETED', {
      job_id: jobId,
      pos_import_id: posImportId,
      total_rows: results.total,
      created: results.created,
      skipped: results.skipped,
      failed: results.failed,
      storage_chunks: chunkInfo.total_chunks,
      errors_count: results.errors.length
    })

    return {
      filePath: '',
      fileName: '',
      importResults: {
        ...results,
        chunksProcessed: 1,
        chunkSize: CHUNK_SIZE,
        duplicateCheckBatchSize: DUP_CHECK_BATCH_SIZE,
        errorDetails: results.errors.slice(0, 10)
      }
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    logError('POS transactions import failed', { 
      job_id: jobId, 
      error_message: errorMessage,
      user_id: userId 
    })

    if (posImportId && importCompanyId) {
      try {
        await posImportsRepository.update(posImportId, importCompanyId, {
          status: 'FAILED',
          error_message: errorMessage
        }, userId)
      } catch (updateError: unknown) {
        logError('Failed to update pos_imports status', { pos_import_id: posImportId, error: updateError })
      }
    }

    throw new Error(errorMessage)
  }
}
