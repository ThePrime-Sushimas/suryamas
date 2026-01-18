/**
 * Products Import Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { productsRepository } from '@/modules/products/products.repository'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { deleteTempFile } from '../jobs.util'
import { JobProcessor } from '../jobs.worker'
import type { ProductsImportMetadata } from '../jobs.types'
import { isProductsImportMetadata } from '../jobs.types'

export const processProductsImport: JobProcessor<ProductsImportMetadata> = async (
  jobId: string,
  userId: string,
  metadata: ProductsImportMetadata
) => {
  let filePath: string | null = null

  try {
    logInfo('Processing products import', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Validate metadata structure
    if (!isProductsImportMetadata(metadata)) {
      throw new Error('Invalid metadata format for products import')
    }

    // Get file path from metadata
    const rawFilePath = metadata.filePath
    if (!rawFilePath || typeof rawFilePath !== 'string') {
      throw new Error('File path not provided in metadata')
    }
    filePath = rawFilePath

    // Read Excel file
    const workbook = XLSX.readFile(filePath)
    const sheetName = metadata.sheetName || workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Parse data
    const data = XLSX.utils.sheet_to_json(worksheet)

    await jobsService.updateProgress(jobId, 40, userId)

    // Process import - create or update products
    const companyId = (metadata as Record<string, unknown>).companyId as string || ''
    const skipDuplicates = metadata.skipDuplicates || false

    const results = {
      total: data.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[]
    }

    await jobsService.updateProgress(jobId, 50, userId)

    // Process in batches
    const batchSize = 100
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)

      for (const [index, row] of batch.entries()) {
        try {
          const rowNum = i + index + 2 // +2 for header row and 0-index
          const rowData = row as Record<string, unknown>

          // Type-safe field extraction
          const productCode = rowData['Code'] || rowData['product_code']
          const productName = rowData['Name'] || rowData['product_name']
          const categoryId = rowData['Category ID'] || rowData['category_id']
          const subCategoryId = rowData['Sub Category ID'] || rowData['sub_category_id'] || ''
          const productType = rowData['Type'] || rowData['product_type'] || 'finished_goods'
          const statusRaw = rowData['Status'] || rowData['status']

          // Parse average_cost safely
          const costPrice = rowData['Cost Price']
          const avgCost = rowData['average_cost']
          const costValue = costPrice || avgCost || '0'
          const averageCost = typeof costValue === 'number' 
            ? costValue 
            : parseFloat(String(costValue)) || 0

          // Parse status safely
          let status: string = 'ACTIVE'
          if (typeof statusRaw === 'string') {
            status = statusRaw.toLowerCase() === 'inactive' ? 'INACTIVE' : 'ACTIVE'
          } else if (typeof statusRaw === 'boolean') {
            status = statusRaw ? 'ACTIVE' : 'INACTIVE'
          }

          // Validate required fields
          if (!productCode || !productName) {
            results.failed++
            results.errors.push(`Row ${rowNum}: Missing required fields (product_code, product_name)`)
            continue
          }

          const productData = {
            product_code: String(productCode),
            product_name: String(productName),
            category_id: categoryId ? String(categoryId) : undefined,
            sub_category_id: subCategoryId ? String(subCategoryId) : undefined,
            product_type: String(productType),
            average_cost: averageCost,
            status,
          }

          // Check if product exists
          const existing = await productsRepository.findByProductCode(productData.product_code)

          if (existing) {
            if (skipDuplicates) {
              results.skipped++
            } else {
              await productsRepository.updateById(existing.id, productData as any)
              results.updated++
            }
          } else {
            const createData = {
              ...productData,
              company_id: companyId,
              created_by: userId
            }
            await productsRepository.create(createData as any)
            results.created++
          }
        } catch (err) {
          results.failed++
          results.errors.push(`Row ${i + index + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }

      // Update progress
      const progress = 50 + Math.min(40, (i / data.length) * 40)
      await jobsService.updateProgress(jobId, progress, userId)
    }

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Products import completed', {
      job_id: jobId,
      total: results.total,
      created: results.created,
      updated: results.updated,
      skipped: results.skipped,
      failed: results.failed
    })

    // Clean up temp file
    if (filePath) {
      await deleteTempFile(filePath)
    }

    return {
      filePath: '',
      fileName: '',
      importResults: results
    }
  } catch (error) {
    logError('Products import failed', { job_id: jobId, error })
    
    // Clean up temp file on error
    if (filePath) {
      await deleteTempFile(filePath).catch(cleanupErr => {
        logError('Failed to cleanup temp file after error', { file_path: filePath, error: cleanupErr })
      })
    }
    
    throw error
  }
}

