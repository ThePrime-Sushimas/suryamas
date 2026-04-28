/**
 * POS Transactions Import Processor - OPTIMIZED VERSION - FIXED
 * Handles background processing of POS imports via jobs system
 * Implements chunked batch processing untuk performa optimal dengan data puluhan ribu baris
 */

import { storageService } from '@/services/storage.service'
import { posImportsRepository } from '../../../modules/pos-imports/pos-imports/pos-imports.repository'
import { posImportLinesRepository } from '../../../modules/pos-imports/pos-import-lines/pos-import-lines.repository'
import { parseToLocalDate, parseToLocalDateTime } from '@/modules/pos-imports/shared/excel-date.util'
import { logInfo, logError, logWarn } from '@/config/logger'
import { jobsService, jobsRepository } from '../../../modules/jobs'
import { JobProcessor } from '../jobs.worker'
import type { CreatePosImportLineDto } from '../../../modules/pos-imports/pos-import-lines/pos-import-lines.types'
import type { PosTransactionsImportMetadata } from '../jobs.types'
import { isPosTransactionsImportMetadata } from '../jobs.types'

// ==============================
// CONFIGURATION
// ==============================
const CHUNK_SIZE = 2000;
const DUP_CHECK_BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

// ==============================
// COLUMN MAPPING
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

function mapRowToDto(row: any, rowIndex: number, posImportId: string): CreatePosImportLineDto {
  const mapped: CreatePosImportLineDto = {
    pos_import_id: posImportId,
    row_number: rowIndex  // Global row number, tidak di-override Excel
  }

  Object.entries(EXCEL_COLUMN_MAP).forEach(([excelCol, dbCol]) => {
    if (dbCol === 'row_number') return; // Skip Excel row_number override

    const value = row[excelCol]
    if (value !== undefined && value !== null && value !== '') {
      if (dbCol === 'sales_date_in' || dbCol === 'sales_date_out' || dbCol === 'order_time') {
        mapped[dbCol as keyof CreatePosImportLineDto] = parseToLocalDateTime(value) as any
      } else if (dbCol === 'sales_date') {
        mapped[dbCol as keyof CreatePosImportLineDto] = parseToLocalDate(value) as any
      } else if (['qty', 'price', 'subtotal', 'discount', 'service_charge', 'tax', 'vat', 
                  'total', 'nett_sales', 'dpp', 'bill_discount', 'total_after_bill_discount'].includes(dbCol)) {
        mapped[dbCol as keyof CreatePosImportLineDto] = toNumber(value) as any
      } else {
        mapped[dbCol as keyof CreatePosImportLineDto] = value as any
      }
    }
  })

  return mapped
}

const TEMP_BUCKET = 'posimportstemp'

async function retrieveTemporaryData_STREAM(chunkFileName: string): Promise<any[]> {
  logInfo('retrieveTemporaryData_STREAM called', { chunk_file: chunkFileName })
  const chunkText = await storageService.download(chunkFileName, TEMP_BUCKET)
  const chunkRows = JSON.parse(chunkText)
  logInfo('Stream chunk processed', { chunk_file: chunkFileName, rows_in_chunk: chunkRows.length })
  return chunkRows
}

async function retrieveTemporaryData(importId: string): Promise<any[]> {
  logInfo('Loading legacy single-file format', { import_id: importId })
  const text = await storageService.download(`${importId}.json`, TEMP_BUCKET)
  const rows = JSON.parse(text)
  logInfo('Legacy single file loaded', { importId, row_count: rows.length })
  return rows
}

async function cleanupTemporaryData(importId: string): Promise<void> {
  try {
    const posImport = await posImportsRepository.findByIdOnly(importId)
    const chunkInfo = posImport?.chunk_info as { total_chunks: number } | null

    if (chunkInfo) {
      // Chunked format — remove all part files
      const partPaths = Array.from({ length: chunkInfo.total_chunks }, (_, i) => `${importId}-part${i + 1}.json`)
      await storageService.remove(partPaths, TEMP_BUCKET)
    }
    // Always try removing legacy single file as safety net
    try { await storageService.remove([`${importId}.json`], TEMP_BUCKET) } catch { /* ignore */ }

    logInfo('Temporary data cleaned up successfully', { import_id: importId })
  } catch (error) {
    logError('Cleanup failed (non-critical)', { import_id: importId, error })
  }
}

// ==============================
// CHUNK PROCESSOR
// ==============================

async function processSingleChunk(
  chunkRows: any[],
  posImportId: string,
  jobId: string,
  userId: string,
  skipDuplicates: boolean,
  results: { created: number; skipped: number; failed: number; errors: string[] },
  rowOffset: number,
  processedBillKeys: Set<string>,
  chunkIndex: number
): Promise<void> {
  if (chunkRows.length === 0) return

  logInfo('Processing chunk', { 
    rows: chunkRows.length, 
    offset: rowOffset, 
    skip_duplicates: skipDuplicates 
  })

  // 1. MAP rows → DTOs dengan global row_number
  const chunkLines: CreatePosImportLineDto[] = chunkRows.map((row: any, idx: number) =>
    mapRowToDto(row, rowOffset + idx + 1, posImportId)
  )

  let linesToInsert = chunkLines
  let chunkSkipped = 0

  // 2. DUPLICATE CHECK per bill (bukan per baris)
  if (skipDuplicates) {
    try {
      // Deduplicate bills dalam chunk ini
      const uniqueChunkBills = [
        ...new Map(
          chunkLines
            .filter(l => l.bill_number && l.sales_date)
            .map(l => [
              `${l.bill_number}|${l.sales_date}`,
              {
                bill_number: String(l.bill_number),
                sales_date: String(l.sales_date),
              }
            ])
        ).values()
      ]

      logInfo("Sample bill for dup check", {
        sample: uniqueChunkBills.slice(0, 3),
      });

      // Batch check ke DB
      const existingBillKeys = new Set<string>()
      for (let i = 0; i < uniqueChunkBills.length; i += DUP_CHECK_BATCH_SIZE) {
        const batch = uniqueChunkBills.slice(i, i + DUP_CHECK_BATCH_SIZE)
        const found = await posImportLinesRepository.findExistingBills(batch)
        found.forEach(k => existingBillKeys.add(k))
      }

      // Filter: skip semua baris dari bill yang sudah ada di DB ATAU sudah diproses di chunk sebelumnya
      linesToInsert = chunkLines.filter(line => {
        if (!line.bill_number || !line.sales_date) return false
        const key = `${line.bill_number}|${line.sales_date}`
        
        const inDb = existingBillKeys.has(key)
        const inMemory = processedBillKeys.has(key)
        
        if (inDb || inMemory) {
          logInfo('Duplicate source check', {
            bill: key,
            found_in_db: inDb,
            found_in_memory: inMemory,
            current_chunk: chunkIndex
          })
          return false
        }
        return true
      })

      chunkSkipped = chunkLines.length - linesToInsert.length

      logInfo('FINAL CHECK', {
        total: chunkLines.length,
        willInsert: linesToInsert.length,
        skipped: chunkSkipped,
      })

      if (chunkSkipped > 0) {
        logInfo('Chunk duplicate check result', {
          pos_import_id: posImportId,
          total_lines: chunkLines.length,
          existing_bills: existingBillKeys.size,
          skipped_lines: chunkSkipped,
          will_insert: linesToInsert.length,
        })

        const skippedBills = chunkLines
          .filter(line => {
            if (!line.bill_number || !line.sales_date) return false
            const key = `${line.bill_number}|${line.sales_date}`
            return existingBillKeys.has(key)
          })
          .map(line => ({ bill_number: line.bill_number, sales_date: line.sales_date }))

        const uniqueSkipped = [...new Map(skippedBills.map(b => [`${b.bill_number}|${b.sales_date}`, b])).values()]

        logInfo('Skipped bills detail', {
          pos_import_id: posImportId,
          skipped_bills: uniqueSkipped
        })
      }
    } catch (dupError: any) {
      logError("Duplicate check failed — inserting all", {
        import_id: posImportId,
        error_message: dupError?.message || String(dupError),
        error_name: dupError?.name,
        error_code: dupError?.code,
        is_error: dupError instanceof Error,
        typeof_error: typeof dupError,
      });
      linesToInsert = chunkLines;
      chunkSkipped = 0;
    }
  }

  // 3. BULK INSERT dengan retry
  let chunkSuccess = 0
  let chunkFailed = 0
  let inserted = false
  let retryCount = 0

  while (!inserted && retryCount < MAX_RETRIES) {
    try {
      if (linesToInsert.length > 0) {
        await posImportLinesRepository.bulkInsert(linesToInsert)
        chunkSuccess = linesToInsert.length
        
        // Track bills yang baru saja di-insert agar tidak dianggap duplikat di chunk berikutnya
        linesToInsert.forEach(l => {
          if (l.bill_number && l.sales_date) {
            processedBillKeys.add(`${l.bill_number}|${l.sales_date}`)
          }
        })
      }
      inserted = true
    } catch (error: any) {
      retryCount++
      logWarn(`Chunk insert retry ${retryCount}/${MAX_RETRIES}`, { error: error.message })
      if (retryCount >= MAX_RETRIES) {
        chunkFailed = linesToInsert.length
        results.errors.push(`Chunk offset ${rowOffset}: ${error.message}`)
      }
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * retryCount))
    }
  }

  // 4. Update global counters
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
// MAIN PROCESSOR
// ==============================

export const processPosTransactionsImport: JobProcessor<PosTransactionsImportMetadata> = async (
  jobId: string,
  userId: string,
  metadata: PosTransactionsImportMetadata
) => {
  const results = {
    total: 0,      // ✅ Di-accumulate dari rowCount per chunk, bukan dari bytes
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[]
  }

  // Track bills yang sudah diproses agar tidak duplikat antar chunk (Solusi 1)
  const processedBillKeys = new Set<string>()

  let posImportId: string | null = null
  let importCompanyId: string | null = null

  try {
    logInfo('Starting POS transactions import', {
      job_id: jobId,
      user_id: userId,
      chunk_size: CHUNK_SIZE,
      dup_check_batch_size: DUP_CHECK_BATCH_SIZE
    })

    await jobsService.updateProgress(jobId, 5, userId)

    if (!isPosTransactionsImportMetadata(metadata)) {
      throw new Error('Invalid metadata format for POS transactions import')
    }

    posImportId = metadata.posImportId!
    const skipDuplicates = metadata.skipDuplicates || false

    logInfo('Job started', {
      pos_import_id: posImportId,
      skip_duplicates: skipDuplicates
    })

    if (!posImportId) {
      throw new Error('POS import ID (posImportId) not provided in metadata')
    }

    await jobsService.updateProgress(jobId, 10, userId)

    const job = await jobsRepository.findById(jobId, userId)
    if (!job) throw new Error('Job not found')
    importCompanyId = job.company_id

    const posImport = await posImportsRepository.findById(posImportId, importCompanyId!)
    if (!posImport) throw new Error('POS import not found or does not belong to your company')

    // PHASE 2: List chunks — use chunk_info from DB instead of storage.list()
    const chunkInfo = (posImport.chunk_info ?? (metadata as unknown as Record<string, unknown>).chunk_info ?? null) as { total_chunks: number } | null
    const totalChunks = chunkInfo?.total_chunks ?? 1

    if (totalChunks <= 1) {
      // Legacy single file or single chunk
      const singleFileName = totalChunks === 1 && chunkInfo
        ? `${posImportId}-part1.json`
        : `${posImportId}.json`

      let singleRows: unknown[]
      try {
        singleRows = totalChunks === 1 && chunkInfo
          ? await retrieveTemporaryData_STREAM(singleFileName)
          : await retrieveTemporaryData(posImportId)
      } catch {
        singleRows = await retrieveTemporaryData(posImportId)
      }

      results.total = singleRows.length
      await processSingleChunk(
        singleRows, posImportId, jobId, userId, skipDuplicates, results, 0, processedBillKeys, 0
      )
    } else {
      logInfo('Found storage chunks for STREAM processing', {
        import_id: posImportId, chunk_count: totalChunks,
      })

      let globalRowOffset = 0

      for (let i = 0; i < totalChunks; i++) {
        const chunkFileName = `${posImportId}-part${i + 1}.json`

        logInfo('Processing storage chunk', {
          chunk_file: chunkFileName, chunk_num: i + 1, total_chunks: totalChunks,
        })

        const chunkRows = await retrieveTemporaryData_STREAM(chunkFileName)
        const rowCount = chunkRows.length  // Save sebelum diproses

        await processSingleChunk(
          chunkRows, posImportId, jobId, userId, skipDuplicates, results, globalRowOffset, processedBillKeys, i
        )

        // Memory cleanup
        chunkRows.length = 0

        // ✅ Accumulate total dari rowCount, bukan dari bytes
        results.total += rowCount
        globalRowOffset += rowCount

        logInfo('Global offset updated', {
          chunk_num: i + 1,
          rowCount,
          globalRowOffset,
          total_so_far: results.total,
        })

        const chunkProgress = 15 + Math.round(((i + 1) / totalChunks) * 80)
        await jobsService.updateProgress(jobId, Math.min(chunkProgress, 95), userId)
      }
    }

    await jobsService.updateProgress(jobId, 95, userId)

    // PHASE 3: Finalization
    await posImportsRepository.update(posImportId!, importCompanyId!, {
      status: 'IMPORTED',
      new_rows: results.created,
      duplicate_rows: results.skipped,
      error_message: results.errors.length > 0 
        ? `${results.errors.length} batches had errors` 
        : undefined
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
      storage_chunks: totalChunks,
      errors_count: results.errors.length
    })

    return {
      filePath: '',
      fileName: '',
      importResults: {
        ...results,
        chunksProcessed: totalChunks,
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
      } catch (updateError) {
        logError('Failed to update pos_imports status', { 
          pos_import_id: posImportId, 
          error: updateError 
        })
      }
    }

    throw new Error(errorMessage)
  }
}