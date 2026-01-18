/**
 * Categories Export Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { categoriesRepository } from '@/modules/categories/categories.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'

export const processCategoriesExport: JobProcessor = async (
  jobId: string,
  userId: string,
  _metadata: any
) => {
  try {
    logInfo('Processing categories export', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Fetch all categories
    const result = await categoriesRepository.findAll({ limit: 10000, offset: 0 })

    await jobsService.updateProgress(jobId, 50, userId)

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Prepare data for Excel
    const excelData = result.data.map(c => ({
      'Category Code': c.category_code,
      'Category Name': c.category_name,
      'Description': c.description || '',
      'Status': c.is_active ? 'Active' : 'Inactive',
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Categories')

    await jobsService.updateProgress(jobId, 80, userId)

    // Generate file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `Categories_${timestamp}.xlsx`
    const tempDir = path.join(process.cwd(), 'temp')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, fileName)
    XLSX.writeFile(workbook, filePath)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Categories export completed', { job_id: jobId, row_count: result.data.length })

    return { filePath, fileName }
  } catch (error) {
    logError('Categories export failed', { job_id: jobId, error })
    throw error
  }
}

