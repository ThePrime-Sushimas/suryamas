/**
 * Companies Import Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { companiesRepository } from '@/modules/companies/companies.repository'
import type { CreateCompanyDTO, UpdateCompanyDTO } from '@/modules/companies/companies.types'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { deleteTempFile } from '../jobs.util'
import { JobProcessor } from '../jobs.worker'

/**
 * Safely convert a value to string
 */
function toString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/**
 * Safely convert a value to string or null
 */
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str || null
}

/**
 * Safely parse status value
 */
function parseStatus(value: unknown): string {
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'active') return 'active'
    if (lower === 'inactive') return 'inactive'
  }
  return 'active'
}

export const processCompaniesImport: JobProcessor = async (
  jobId: string,
  userId: string,
  metadata: any
) => {
  let filePath: string | null = null

  try {
    logInfo('Processing companies import', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Get file path from metadata with type checking
    const rawFilePath = metadata?.filePath
    if (!rawFilePath || typeof rawFilePath !== 'string') {
      throw new Error('File path not provided in metadata')
    }
    filePath = rawFilePath

    // Read Excel file
    const workbook = XLSX.readFile(filePath)
    const sheetName = metadata?.sheetName || workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Parse data
    const data = XLSX.utils.sheet_to_json(worksheet)

    await jobsService.updateProgress(jobId, 40, userId)

    // Process import - create or update companies
    const skipDuplicates = metadata?.skipDuplicates || false

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
    const batchSize = 50
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)

      for (const [index, row] of batch.entries()) {
        try {
          const rowNum = i + index + 2 // +2 for header row and 0-index
          const rowData = row as Record<string, unknown>
          
          // Type-safe field extraction using helper functions
          const companyCode = toString(rowData['Code'] || rowData['company_code'])
          const companyName = toString(rowData['Company Name'] || rowData['company_name'])
          
          const companyData: CreateCompanyDTO = {
            company_code: companyCode,
            company_name: companyName,
            company_type: (toString(rowData['Type'] || rowData['company_type'] || 'PT') as CreateCompanyDTO['company_type']),
            npwp: toStringOrNull(rowData['NPWP'] || rowData['npwp']),
            website: toStringOrNull(rowData['Website'] || rowData['website']),
            email: toStringOrNull(rowData['Email'] || rowData['email']),
            phone: toStringOrNull(rowData['Phone'] || rowData['phone']),
            status: (parseStatus(rowData['Status'] || rowData['status']) as CreateCompanyDTO['status']),
          }

          if (!companyData.company_code || !companyData.company_name) {
            results.failed++
            results.errors.push(`Row ${rowNum}: Missing required fields (company_code, company_name)`)
            continue
          }

          // Check if company exists by code
          const existing = await companiesRepository.findByCode(companyData.company_code)

          if (existing) {
            if (skipDuplicates) {
              results.skipped++
            } else {
              const updateData: UpdateCompanyDTO = {
                company_name: companyData.company_name,
                company_type: companyData.company_type,
                npwp: companyData.npwp,
                website: companyData.website,
                email: companyData.email,
                phone: companyData.phone,
                status: companyData.status,
              }
              await companiesRepository.update(existing.id, updateData)
              results.updated++
            }
          } else {
            await companiesRepository.create(companyData)
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

    logInfo('Companies import completed', {
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
    logError('Companies import failed', { job_id: jobId, error })
    
    // Clean up temp file on error
    if (filePath) {
      await deleteTempFile(filePath).catch(cleanupErr => {
        logError('Failed to cleanup temp file after error', { file_path: filePath, error: cleanupErr })
      })
    }
    
    throw error
  }
}

