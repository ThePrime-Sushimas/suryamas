/**
 * Chart of Accounts Export Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { chartOfAccountsRepository } from '@/modules/accounting/chart-of-accounts/chart-of-accounts.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'

export const processChartOfAccountsExport: JobProcessor = async (
  jobId: string,
  userId: string,
  metadata: any
) => {
  try {
    logInfo('Processing chart of accounts export', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Export all COA with company filter
    const companyId = metadata?.companyId || ''
    const data = await chartOfAccountsRepository.exportData(companyId)

    await jobsService.updateProgress(jobId, 50, userId)

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Prepare data for Excel
    const excelData = data.map(coa => ({
      'Account Code': coa.account_code,
      'Account Name': coa.account_name,
      'Account Type': coa.account_type,
      'Account Subtype': coa.account_subtype || '',
      'Parent Account ID': coa.parent_account_id || '',
      'Level': coa.level,
      'Is Header': coa.is_header ? 'Yes' : 'No',
      'Is Postable': coa.is_postable ? 'Yes' : 'No',
      'Normal Balance': coa.normal_balance,
      'Currency': coa.currency_code,
      'Sort Order': coa.sort_order || '',
      'Status': coa.is_active ? 'Active' : 'Inactive',
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chart of Accounts')

    await jobsService.updateProgress(jobId, 80, userId)

    // Generate file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `ChartOfAccounts_${timestamp}.xlsx`
    const tempDir = path.join(process.cwd(), 'temp')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, fileName)
    XLSX.writeFile(workbook, filePath)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Chart of accounts export completed', { job_id: jobId, row_count: data.length })

    return { filePath, fileName }
  } catch (error) {
    logError('Chart of accounts export failed', { job_id: jobId, error })
    throw error
  }
}

