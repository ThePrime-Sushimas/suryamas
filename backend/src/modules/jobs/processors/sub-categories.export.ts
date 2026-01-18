/**
 * Sub Categories Export Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { subCategoriesRepository } from '@/modules/sub-categories/sub-categories.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'

export const processSubCategoriesExport: JobProcessor = async (
  jobId: string,
  userId: string,
  _metadata: any
) => {
  try {
    logInfo('Processing sub categories export', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Fetch all sub categories
    const result = await subCategoriesRepository.findAll({ limit: 10000, offset: 0 })

    await jobsService.updateProgress(jobId, 50, userId)

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Prepare data for Excel
    const excelData = result.data.map(sc => ({
      'Sub Category Code': sc.sub_category_code,
      'Sub Category Name': sc.sub_category_name,
      'Category': (sc as any).category_name || '',
      'Description': sc.description || '',
      'Status': (sc as any).is_active ? 'Active' : 'Inactive',
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sub Categories')

    await jobsService.updateProgress(jobId, 80, userId)

    // Generate file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `SubCategories_${timestamp}.xlsx`
    const tempDir = path.join(process.cwd(), 'temp')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, fileName)
    XLSX.writeFile(workbook, filePath)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Sub categories export completed', { job_id: jobId, row_count: result.data.length })

    return { filePath, fileName }
  } catch (error) {
    logError('Sub categories export failed', { job_id: jobId, error })
    throw error
  }
}

