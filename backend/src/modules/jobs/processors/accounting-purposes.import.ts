/**
 * Accounting Purposes Import Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { accountingPurposesRepository } from '@/modules/accounting/accounting-purposes/accounting-purposes.repository'
import type { CreateAccountingPurposeDTO, UpdateAccountingPurposeDTO } from '@/modules/accounting/accounting-purposes/accounting-purposes.types'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'

export const processAccountingPurposesImport: JobProcessor = async (
  jobId: string,
  userId: string,
  metadata: any
) => {
  try {
    logInfo('Processing accounting purposes import', { job_id: jobId, user_id: userId })

    await jobsService.updateProgress(jobId, 10, userId)

    // Get file path from metadata
    const filePath = metadata?.filePath
    if (!filePath) {
      throw new Error('File path not provided in metadata')
    }

    // Get company ID from metadata
    const companyId = metadata?.companyId
    if (!companyId) {
      throw new Error('Company ID not provided in metadata')
    }

    // Read Excel file
    const workbook = XLSX.readFile(filePath)
    const sheetName = metadata?.sheetName || workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Parse data
    const data = XLSX.utils.sheet_to_json(worksheet)

    await jobsService.updateProgress(jobId, 40, userId)

    // Process import - create or update accounting purposes
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
          
          const apData: CreateAccountingPurposeDTO = {
            company_id: companyId,
            purpose_code: (row as any)['Purpose Code'] || (row as any)['purpose_code'] || '',
            purpose_name: (row as any)['Purpose Name'] || (row as any)['purpose_name'] || '',
            applied_to: (row as any)['Applied To'] || (row as any)['applied_to'] || 'all',
            description: (row as any)['Description'] || (row as any)['description'] || null,
          }

          if (!apData.purpose_code || !apData.purpose_name) {
            results.failed++
            results.errors.push(`Row ${rowNum}: Missing required fields (purpose_code, purpose_name)`)
            continue
          }

          // Check if purpose exists by code
          const existing = await accountingPurposesRepository.findByCode(companyId, apData.purpose_code)

          if (existing) {
            if (skipDuplicates) {
              results.skipped++
            } else {
              const updateData: UpdateAccountingPurposeDTO & { updated_by: string } = {
                purpose_name: apData.purpose_name,
                applied_to: apData.applied_to,
                description: apData.description,
                updated_by: userId,
              }
              await accountingPurposesRepository.update(existing.id, companyId, updateData)
              results.updated++
            }
          } else {
            await accountingPurposesRepository.create(apData, userId)
            results.created++
          }
        } catch (err) {
          results.failed++
          results.errors.push(`Row ${i + index + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }

      // Update progress (use Math.round to convert float to integer)
      const progress = Math.round(50 + Math.min(40, (i / data.length) * 40))
      await jobsService.updateProgress(jobId, progress, userId)
    }

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Accounting purposes import completed', {
      job_id: jobId,
      total: results.total,
      created: results.created,
      updated: results.updated,
      skipped: results.skipped,
      failed: results.failed
    })

    return {
      filePath: '',
      fileName: '',
      importResults: results
    }
  } catch (error) {
    logError('Accounting purposes import failed', { job_id: jobId, error })
    throw error
  }
}

