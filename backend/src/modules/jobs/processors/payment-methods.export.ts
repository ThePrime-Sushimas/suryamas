/**
 * Payment Methods Export Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { paymentMethodsRepository } from '@/modules/payment-methods/payment-methods.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'

export const processPaymentMethodsExport: JobProcessor = async (
  jobId: string,
  userId: string,
  metadata: any
) => {
  try {
    logInfo('Processing payment methods export', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Fetch all payment methods with company filter
    const companyId = metadata?.companyId || ''
    const result = await paymentMethodsRepository.findAll(
      companyId,
      { limit: 10000, offset: 0 }
    )

    await jobsService.updateProgress(jobId, 50, userId)

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Prepare data for Excel
    const excelData = result.data.map(pm => ({
      'Code': pm.code,
      'Name': pm.name,
      'Type': pm.payment_type,
      'Description': pm.description || '',
      'Status': pm.is_active ? 'Active' : 'Inactive',
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Methods')

    await jobsService.updateProgress(jobId, 80, userId)

    // Generate file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `PaymentMethods_${timestamp}.xlsx`
    const tempDir = path.join(process.cwd(), 'temp')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, fileName)
    XLSX.writeFile(workbook, filePath)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Payment methods export completed', { job_id: jobId, row_count: result.data.length })

    return { filePath, fileName }
  } catch (error) {
    logError('Payment methods export failed', { job_id: jobId, error })
    throw error
  }
}

