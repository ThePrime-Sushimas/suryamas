/**
 * Accounting Purposes Export Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { accountingPurposesRepository } from '@/modules/accounting/accounting-purposes/accounting-purposes.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'

export const processAccountingPurposesExport: JobProcessor = async (
  jobId: string,
  userId: string,
  metadata: any
) => {
  try {
    logInfo('Processing accounting purposes export', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Export all accounting purposes with company filter
    const companyId = metadata?.companyId || ''
    const data = await accountingPurposesRepository.exportData(companyId)

    await jobsService.updateProgress(jobId, 50, userId)

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Prepare data for Excel
    const excelData = data.map(ap => ({
      'Purpose Code': ap.purpose_code,
      'Purpose Name': ap.purpose_name,
      'Applied To': ap.applied_to,
      'Description': ap.description || '',
      'Status': ap.is_active ? 'Active' : 'Inactive',
      'Is System': ap.is_system ? 'Yes' : 'No',
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounting Purposes')

    await jobsService.updateProgress(jobId, 80, userId)

    // Generate file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `AccountingPurposes_${timestamp}.xlsx`
    const tempDir = path.join(process.cwd(), 'temp')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, fileName)
    XLSX.writeFile(workbook, filePath)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Accounting purposes export completed', { job_id: jobId, row_count: data.length })

    return { filePath, fileName }
  } catch (error) {
    logError('Accounting purposes export failed', { job_id: jobId, error })
    throw error
  }
}

