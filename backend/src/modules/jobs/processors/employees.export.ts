/**
 * Employees Export Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { employeesRepository } from '@/modules/employees/employees.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'
import type { EmployeesExportMetadata } from '../jobs.types'
import { isEmployeesExportMetadata } from '../jobs.types'

export const processEmployeesExport: JobProcessor<EmployeesExportMetadata> = async (
  jobId: string,
  userId: string,
  metadata: EmployeesExportMetadata
) => {
  try {
    logInfo('Processing employees export', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Validate metadata structure
    if (!isEmployeesExportMetadata(metadata)) {
      throw new Error('Invalid metadata format for employees export')
    }

    // Fetch data with filter
    const data = await employeesRepository.exportData(metadata.filter)

    await jobsService.updateProgress(jobId, 50, userId)

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Prepare data for Excel (flat keys with desired headers)
    const excelData = data.map((e: any) => ({
      'Employee ID': e.employee_id,
      'Full Name': e.full_name,
      'Email': e.email,
      'Phone': e.phone,
      'Job Position': e.job_position,
      'Branch': (e as any).branch_name,
      'Join Date': e.join_date,
      'Status': e.status,
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees')

    await jobsService.updateProgress(jobId, 80, userId)

    // Generate file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `Employees_${timestamp}.xlsx`
    const tempDir = path.join(process.cwd(), 'temp')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, fileName)
    XLSX.writeFile(workbook, filePath)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Employees export completed', { job_id: jobId, row_count: data.length })

    return { filePath, fileName }
  } catch (error) {
    logError('Employees export failed', { job_id: jobId, error })
    throw error
  }
}

