/**
 * Products Export Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { productsRepository } from '@/modules/products/products.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'
import type { ProductsExportMetadata } from '../jobs.types'
import { isProductsExportMetadata } from '../jobs.types'

export const processProductsExport: JobProcessor<ProductsExportMetadata> = async (
  jobId: string,
  userId: string,
  metadata: ProductsExportMetadata
) => {
  try {
    logInfo('Processing products export', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Validate metadata structure
    if (!isProductsExportMetadata(metadata)) {
      throw new Error('Invalid metadata format for products export')
    }

    // Fetch all data with pagination
    const pageSize = 1000
    let page = 1
    let allData: any[] = []
    let totalCount = 0

    while (true) {
      const result = await productsRepository.findAll(
        { limit: pageSize, offset: (page - 1) * pageSize },
        undefined,
        metadata.filter
      )
      
      allData = allData.concat(result.data)
      totalCount = result.total
      
      if (result.data.length < pageSize) break
      page++
    }

    await jobsService.updateProgress(jobId, 50, userId)

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Prepare data for Excel
    const excelData = allData.map(p => ({
      'Code': p.product_code || p.code,
      'Name': p.product_name || p.name,
      'Category': (p as any).category_name || '',
      'Sub Category': (p as any).sub_category_name || '',
      'Price': p.average_cost || 0,
      'Status': p.status,
      'Is Active': p.status === 'ACTIVE' ? 'Yes' : 'No',
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products')

    await jobsService.updateProgress(jobId, 80, userId)

    // Generate file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `Products_${timestamp}.xlsx`
    const tempDir = path.join(process.cwd(), 'temp')

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.join(tempDir, fileName)
    XLSX.writeFile(workbook, filePath)

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Products export completed', { job_id: jobId, row_count: allData.length })

    return { filePath, fileName }
  } catch (error) {
    logError('Products export failed', { job_id: jobId, error })
    throw error
  }
}

