/**
 * POS Imports Export Processor
 * Exports selected POS imports to Excel files
 * Supports batch export of multiple imports in a single file
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { posImportsService } from '@/modules/pos-imports/pos-imports/pos-imports.service'
import { posImportLinesRepository } from '@/modules/pos-imports/pos-import-lines/pos-import-lines.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'

interface PosImportsExportMetadata {
  type: 'export'
  module: 'pos_imports'
  companyId: string
  importIds: string[]
}

export const processPosImportsExport: JobProcessor<PosImportsExportMetadata> = async (
  jobId: string,
  userId: string,
  metadata: PosImportsExportMetadata
) => {
  try {
    logInfo('Processing POS imports export', { job_id: jobId, user_id: userId, import_count: metadata.importIds?.length || 0 })

    await jobsService.updateProgress(jobId, 10, userId)

    // Validate metadata
    if (!metadata || metadata.module !== 'pos_imports') {
      throw new Error('Invalid pos_imports export metadata')
    }

    const importIds = metadata.importIds || []
    if (importIds.length === 0) {
      throw new Error('No import IDs provided for export')
    }

    // Fetch all imports data
    const companyId = metadata.companyId
    const imports = []
    for (let i = 0; i < importIds.length; i++) {
      const importId = importIds[i]
      try {
        const posImport = await posImportsService.getById(importId, companyId)
        const lines = await posImportLinesRepository.findByImportId(importId, 1, 10000)
        imports.push({
          import: posImport,
          lines: lines.data
        })
        
        // Update progress based on fetch progress
        const progress = 10 + Math.floor((i / importIds.length) * 30)
        await jobsService.updateProgress(jobId, progress, userId)
      } catch (err) {
        logError('Failed to fetch import for export', { job_id: jobId, import_id: importId, error: err })
        // Continue with other imports
      }
    }

    await jobsService.updateProgress(jobId, 40, userId)

    // Create workbook with multiple sheets
    const workbook = XLSX.utils.book_new()

    // Create summary sheet
    const summaryData = imports.map(imp => {
      const totalAmount = imp.lines.reduce((sum, line) => sum + (line.total || 0), 0)
      const totalTax = imp.lines.reduce((sum, line) => sum + (line.tax || 0), 0)
      const totalDiscount = imp.lines.reduce((sum, line) => sum + (line.discount || 0), 0)
      
      return {
        'File Name': imp.import.file_name,
        'Status': imp.import.status,
        'Import Date': imp.import.import_date,
        'Total Rows': imp.import.total_rows,
        'Total Amount': totalAmount,
        'Total Tax': totalTax,
        'Total Discount': totalDiscount,
      }
    })

    const summarySheet = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

    await jobsService.updateProgress(jobId, 60, userId)

    // Create detail sheets for each import
    for (const imp of imports) {
      const safeFileName = imp.import.file_name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
      
      const linesData = imp.lines.map(line => ({
        'Row Number': line.row_number,
        'Sales Number': line.sales_number,
        'Bill Number': line.bill_number,
        'Sales Date': line.sales_date,
        'Menu': line.menu,
        'Menu Category': line.menu_category,
        'Quantity': line.qty,
        'Price': line.price,
        'Sub Total': line.subtotal,
        'Tax': line.tax,
        'Discount': line.discount,
        'Total': line.total,
        'Payment Method': line.payment_method,
        'Branch': line.branch,
      }))

      const detailSheet = XLSX.utils.json_to_sheet(linesData)
      XLSX.utils.book_append_sheet(workbook, detailSheet, safeFileName)
    }

    await jobsService.updateProgress(jobId, 80, userId)

    // Generate file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `POS_Imports_Export_${timestamp}.xlsx`
    const tempDir = path.join(process.cwd(), 'temp')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, fileName)
    XLSX.writeFile(workbook, filePath)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('POS imports export completed', { 
      job_id: jobId, 
      import_count: imports.length,
      file_path: filePath 
    })

    return { filePath, fileName }
  } catch (error) {
    logError('POS imports export failed', { job_id: jobId, error })
    throw error
  }
}

