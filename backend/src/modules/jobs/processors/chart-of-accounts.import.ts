/**
 * Chart of Accounts Import Processor
 */

import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'
import { chartOfAccountsRepository } from '@/modules/accounting/chart-of-accounts/chart-of-accounts.repository'
import type { CreateChartOfAccountDTO, UpdateChartOfAccountDTO } from '@/modules/accounting/chart-of-accounts/chart-of-accounts.types'
import { logInfo, logError } from '@/config/logger'
import { jobsService } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'

export const processChartOfAccountsImport: JobProcessor = async (
  jobId: string,
  userId: string,
  metadata: any
) => {
  try {
    logInfo('Processing chart of accounts import', { job_id: jobId, user_id: userId })

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

    // Process import - create or update chart of accounts
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

    // Build parent account lookup map for resolving parent_account_id
    const accountCodeToId = new Map<string, string>()
    
    // First pass: collect existing accounts to build the lookup map
    const existingAccounts = await chartOfAccountsRepository.exportData(companyId)
    for (const acc of existingAccounts) {
      accountCodeToId.set(acc.account_code, acc.id)
    }

    // Process in batches
    const batchSize = 50
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)

      for (const [index, row] of batch.entries()) {
        try {
          const rowNum = i + index + 2 // +2 for header row and 0-index
          
          const accountCode = (row as any)['Account Code'] || (row as any)['account_code'] || ''
          const parentAccountCode = (row as any)['Parent Account Code'] || (row as any)['parent_account_code'] || ''
          
          const coaData: CreateChartOfAccountDTO = {
            company_id: companyId,
            account_code: accountCode,
            account_name: (row as any)['Account Name'] || (row as any)['account_name'] || '',
            account_type: (row as any)['Account Type'] || (row as any)['account_type'] || 'EXPENSE',
            account_subtype: (row as any)['Account Subtype'] || (row as any)['account_subtype'] || null,
            parent_account_id: parentAccountCode ? accountCodeToId.get(parentAccountCode) || null : null,
            is_header: (row as any)['Is Header']?.toLowerCase() === 'yes' || (row as any)['is_header'] === true,
            is_postable: (row as any)['Is Postable']?.toLowerCase() === 'yes' || (row as any)['is_postable'] === true,
            normal_balance: (row as any)['Normal Balance'] || (row as any)['normal_balance'] || 'DEBIT',
            currency_code: (row as any)['Currency'] || (row as any)['currency_code'] || 'IDR',
            sort_order: parseInt((row as any)['Sort Order'] || (row as any)['sort_order'] || '0'),
          }

          if (!coaData.account_code || !coaData.account_name || !coaData.account_type) {
            results.failed++
            results.errors.push(`Row ${rowNum}: Missing required fields (account_code, account_name, account_type)`)
            continue
          }

          // Check if account exists by code
          const existing = await chartOfAccountsRepository.findByCode(companyId, coaData.account_code)

          if (existing) {
            if (skipDuplicates) {
              results.skipped++
            } else {
              const updateData: UpdateChartOfAccountDTO = {
                account_name: coaData.account_name,
                account_subtype: coaData.account_subtype,
                parent_account_id: coaData.parent_account_id,
                is_header: coaData.is_header,
                is_postable: coaData.is_postable,
                currency_code: coaData.currency_code,
                sort_order: coaData.sort_order,
              }
              await chartOfAccountsRepository.update(existing.id, updateData)
              results.updated++
            }
          } else {
            await chartOfAccountsRepository.create(coaData, userId)
            results.created++
            
            // Add to lookup map for subsequent rows
            const newAccount = await chartOfAccountsRepository.findByCode(companyId, coaData.account_code)
            if (newAccount) {
              accountCodeToId.set(coaData.account_code, newAccount.id)
            }
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

    logInfo('Chart of accounts import completed', {
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
    logError('Chart of accounts import failed', { job_id: jobId, error })
    throw error
  }
}

