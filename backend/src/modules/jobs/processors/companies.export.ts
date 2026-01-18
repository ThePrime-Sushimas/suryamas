/**
 * Companies Export Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { companiesRepository } from '@/modules/companies/companies.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'
import { JobType } from '../jobs.types'

export const processCompaniesExport: JobProcessor = async (
  jobId: string,
  userId: string,
  _metadata: any
) => {
  try {
    logInfo('Processing companies export', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Fetch all companies
    const result = await companiesRepository.findAll({ limit: 10000, offset: 0 })

    await jobsService.updateProgress(jobId, 50, userId)

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Prepare data for Excel
    const excelData = result.data.map(c => ({
      'Company Name': c.company_name,
      'Code': c.company_code,
      'Type': c.company_type,
      'Email': (c as any).email || '',
      'Phone': (c as any).phone || '',
      'Address': (c as any).address || '',
      'City': (c as any).city || '',
      'Status': (c as any).is_active ? 'Active' : 'Inactive',
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Companies')

    await jobsService.updateProgress(jobId, 80, userId)

    // Generate file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `Companies_${timestamp}.xlsx`
    const tempDir = path.join(process.cwd(), 'temp')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, fileName)
    XLSX.writeFile(workbook, filePath)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Companies export completed', { job_id: jobId, row_count: result.data.length })

    return { filePath, fileName }
  } catch (error) {
    logError('Companies export failed', { job_id: jobId, error })
    throw error
  }
}

