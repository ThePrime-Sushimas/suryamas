/**
 * POS Transactions Export Processor
 * Background job processor for exporting POS transactions
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { posImportLinesRepository } from '@/modules/pos-imports/pos-import-lines/pos-import-lines.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'
import { isPosTransactionsExportMetadata } from '../jobs.types'
import type { PosTransactionsExportMetadata } from '../jobs.types'

export const processPosTransactionsExport: JobProcessor = async (
  jobId: string,
  userId: string,
  metadata: Record<string, unknown>
) => {
  try {
    logInfo('Processing POS transactions export', { job_id: jobId })

    // Validate metadata structure
    if (!isPosTransactionsExportMetadata(metadata)) {
      throw new Error('Invalid metadata format for POS transactions export')
    }

    // Update progress: 10%
    await jobsService.updateProgress(jobId, 10, userId)

    // Extract companyId and filters from metadata
    const companyId = metadata.companyId as string
    const filters = metadata.filters || {}

    if (!companyId) {
      throw new Error('Company ID is required in metadata')
    }

    // Fetch all data
    const result = await posImportLinesRepository.findAllWithFilters(
      companyId,
      filters,
      { page: 1, limit: 100000 }
    )

    // Update progress: 50%
    await jobsService.updateProgress(jobId, 50, userId)

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Prepare data for Excel
    const excelData = result.data.map(tx => ({
      'Bill Number': tx.bill_number,
      'Sales Number': tx.sales_number,
      'Sales Date': tx.sales_date,
      'Branch': tx.branch,
      'Area': tx.area,
      'Brand': tx.brand,
      'City': tx.city,
      'Menu': tx.menu,
      'Menu Category': tx.menu_category,
      'Payment Method': tx.payment_method,
      'Sales Type': tx.sales_type,
      'Customer Name': tx.customer_name,
      'Qty': tx.qty,
      'Price': tx.price,
      'Subtotal': tx.subtotal,
      'Discount': tx.discount,
      'Tax': tx.tax,
      'Total': tx.total,
    }))

    // Add summary row
    excelData.push({
      'Bill Number': '',
      'Sales Number': '',
      'Sales Date': '',
      'Branch': '',
      'Area': '',
      'Brand': '',
      'City': '',
      'Menu': '',
      'Menu Category': '',
      'Payment Method': '',
      'Sales Type': '',
      'Customer Name': 'TOTAL',
      'Qty': '' as any,
      'Price': '' as any,
      'Subtotal': result.summary.totalSubtotal,
      'Discount': result.summary.totalDiscount,
      'Tax': result.summary.totalTax,
      'Total': result.summary.totalAmount,
    })

    // Update progress: 70%
    await jobsService.updateProgress(jobId, 70, userId)

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions')

    // Generate file with shorter, safe name
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `POS_${timestamp}.xlsx`
    const tempDir = path.join(process.cwd(), 'temp')

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, fileName)
    XLSX.writeFile(workbook, filePath)

    // Update progress: 90%
    await jobsService.updateProgress(jobId, 90, userId)

    logInfo('POS transactions export completed', {
      job_id: jobId,
      file_path: filePath,
      row_count: result.data.length
    })

    return { filePath, fileName }
  } catch (error) {
    logError('POS transactions export failed', { job_id: jobId, error })
    throw error
  }
}

// Export type for reference
export type { PosTransactionsExportMetadata }

