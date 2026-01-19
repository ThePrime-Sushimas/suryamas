/**
 * Fiscal Periods Export Processor
 */
//TODO: BLM BUAT EXPORT FISCAL PERIODS

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { fiscalPeriodsRepository } from '@/modules/accounting/fiscal-periods/fiscal-periods.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'

export const processFiscalPeriodsExport: JobProcessor = async (
  jobId: string,
  userId: string,
  metadata: any
) => {
  try {
    logInfo('Processing fiscal periods export', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Export all fiscal periods (companyId comes from context or metadata)
    const companyId = metadata?.companyId || ''
    const data = await fiscalPeriodsRepository.exportData(companyId, metadata?.filter)

    await jobsService.updateProgress(jobId, 50, userId)

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Prepare data for Excel
    const excelData = data.map(fp => ({
      'Period': fp.period,
      'Fiscal Year': fp.fiscal_year,
      'Start Date': fp.period_start,
      'End Date': fp.period_end,
      'Is Open': fp.is_open ? 'Yes' : 'No',
      'Adjustment Allowed': fp.is_adjustment_allowed ? 'Yes' : 'No',
      'Is Year End': fp.is_year_end ? 'Yes' : 'No',
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fiscal Periods')

    await jobsService.updateProgress(jobId, 80, userId)

    // Generate file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `FiscalPeriods_${timestamp}.xlsx`
    const tempDir = path.join(process.cwd(), 'temp')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, fileName)
    XLSX.writeFile(workbook, filePath)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Fiscal periods export completed', { job_id: jobId, row_count: data.length })

    return { filePath, fileName }
  } catch (error) {
    logError('Fiscal periods export failed', { job_id: jobId, error })
    throw error
  }
}

