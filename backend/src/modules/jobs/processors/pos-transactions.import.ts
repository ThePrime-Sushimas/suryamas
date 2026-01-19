/**
 * POS Transactions Import Processor
 * Handles background processing of POS imports via jobs system
 * Reads data from Supabase Storage (stored during analyzeFile)
 */

import { supabase } from '@/config/supabase'
import { posImportsRepository } from '@/modules/pos-imports/pos-imports/pos-imports.repository'
import { posImportLinesRepository } from '@/modules/pos-imports/pos-import-lines/pos-import-lines.repository'
import { parseToLocalDate, parseToLocalDateTime } from '@/modules/pos-imports/shared/excel-date.util'
import { logInfo, logError } from '@/config/logger'
import { jobsService, jobsRepository } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'
import type { PosTransactionsImportMetadata } from '../jobs.types'
import { isPosTransactionsImportMetadata } from '../jobs.types'
import type { CreatePosImportLineDto } from '@/modules/pos-imports/pos-import-lines/pos-import-lines.types'

// Column mapping for Excel (same as pos-imports.service.ts)
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

/**
 * Safely convert a value to number
 */
function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const num = Number(value)
  return isNaN(num) ? undefined : num
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

export const processPosTransactionsImport: JobProcessor<PosTransactionsImportMetadata> = async (
  jobId: string,
  userId: string,
  metadata: PosTransactionsImportMetadata
) => {
  try {
    logInfo('Processing POS transactions import', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Validate metadata structure
    if (!isPosTransactionsImportMetadata(metadata)) {
      throw new Error('Invalid metadata format for POS transactions import')
    }

    // Get posImportId from metadata
    const posImportId = metadata.posImportId
    const skipDuplicates = metadata.skipDuplicates || false

    if (!posImportId) {
      throw new Error('POS import ID (posImportId) not provided in metadata')
    }

    await jobsService.updateProgress(jobId, 20, userId)

    // Get company_id from the job record (jobs have company_id field)
    const job = await jobsRepository.findById(jobId, userId)
    if (!job) {
      throw new Error('Job not found')
    }
    const importCompanyId = job.company_id

    // Verify pos_import belongs to the same company
    const posImport = await posImportsRepository.findById(posImportId, importCompanyId)
    if (!posImport) {
      throw new Error('POS import not found or does not belong to your company')
    }

    // Read rows from Supabase Storage (stored during analyzeFile)
    const rows = await retrieveTemporaryData(posImportId)

    if (rows.length === 0) {
      throw new Error('No data rows found. Please re-upload the file.')
    }

    await jobsService.updateProgress(jobId, 40, userId)

    // Process import results
    const results = {
      total: rows.length,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Map Excel rows to database format
    const lines: CreatePosImportLineDto[] = rows.map((row: any, index: number) => {
      const mapped: any = {
        pos_import_id: posImportId,
        row_number: index + 1
      }

      // Map all columns with type conversion
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
    })

    await jobsService.updateProgress(jobId, 60, userId)

    // Filter duplicates if requested
    let linesToInsert = lines
    if (skipDuplicates) {
      const transactions = lines
        .filter(l => l.bill_number && l.sales_number && l.sales_date)
        .map(l => ({
          bill_number: String(l.bill_number),
          sales_number: String(l.sales_number),
          sales_date: l.sales_date
        }))

      const duplicates = await posImportLinesRepository.findExistingTransactions(transactions)
      const duplicateKeys = new Set(
        duplicates.map(d => `${d.bill_number}-${d.sales_number}-${d.sales_date}`)
      )

      linesToInsert = lines.filter(line => {
        const key = `${line.bill_number}-${line.sales_number}-${line.sales_date}`
        return !duplicateKeys.has(key)
      })

      results.skipped = lines.length - linesToInsert.length
    }

    await jobsService.updateProgress(jobId, 80, userId)

    // Bulk insert lines
    if (linesToInsert.length > 0) {
      await posImportLinesRepository.bulkInsert(linesToInsert)
      results.created = linesToInsert.length
    }

    await jobsService.updateProgress(jobId, 95, userId)

    // Update pos_imports status
    await posImportsRepository.update(posImportId, importCompanyId, {
      status: 'IMPORTED',
      new_rows: results.created,
      duplicate_rows: results.skipped
    }, userId)

    // Clean up temporary data
    await cleanupTemporaryData(posImportId)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('POS transactions import completed', {
      job_id: jobId,
      pos_import_id: posImportId,
      total: results.total,
      created: results.created,
      skipped: results.skipped,
      failed: results.failed
    })

    return {
      filePath: '',
      fileName: '',
      importResults: results
    }
  } catch (error) {
    logError('POS transactions import failed', { job_id: jobId, error })

    // Update pos_imports status to FAILED if we have the ID
    const posImportId = metadata?.pos_import_id
    if (posImportId) {
      try {
        // Get company_id from the job record (jobs have company_id field)
        const failedJob = await jobsRepository.findById(jobId, userId)
        if (failedJob) {
          await posImportsRepository.update(posImportId, failedJob.company_id, {
            status: 'FAILED',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          }, userId)
        }
      } catch (updateError) {
        logError('Failed to update pos_imports status', { pos_import_id: posImportId, error: updateError })
      }
    }

    throw error
  }
}

