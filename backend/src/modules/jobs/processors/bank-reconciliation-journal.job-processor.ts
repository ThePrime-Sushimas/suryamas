/**
 * Bank Reconciliation Journal Job Processor
 * Wrapper untuk mengintegrasikan generateBankRecJournals dengan sistem job
 */

import { pool } from '@/config/db'
import { logInfo, logError } from '@/config/logger'
import { jobsService, jobsRepository } from '@/modules/jobs'
import { generateBankRecJournals } from './bank-reconciliation-journal.processor'
import { PermissionService } from '@/services/permission.service'
import type { JobProcessor } from '../jobs.worker'

PermissionService.registerModule('bank_rec_journals', 'Bank Reconciliation Journals').catch(() => {})

export interface BankRecJournalsJobMetadata {
  type: 'import'
  module: 'bank_rec_journals'
  companyId: string
  branchId?: string
  statementIds?: string[]
  bankStatementImportId?: number
  bank_account_id?: number
  date_from?: string
  date_to?: string
}

export const processBankRecJournals: JobProcessor<BankRecJournalsJobMetadata> = async (
  jobId: string, userId: string, metadata: BankRecJournalsJobMetadata
) => {
  try {
    logInfo('Processing bank reconciliation journals job', { job_id: jobId, user_id: userId, metadata })
    await jobsService.updateProgress(jobId, 5, userId)

    if (!metadata.companyId) {
      const job = await jobsRepository.findById(jobId, userId)
      if (!job) throw new Error('Job not found')
      metadata.companyId = job.company_id
    }

    let statementIds: string[] = []

    if (metadata.statementIds && metadata.statementIds.length > 0) {
      statementIds = metadata.statementIds

    } else if (metadata.bankStatementImportId) {
      await jobsService.updateProgress(jobId, 10, userId)
      const { rows } = await pool.query(
        `SELECT id FROM bank_statements
         WHERE import_id = $1 AND company_id = $2
           AND is_reconciled = true AND is_pending = false
           AND journal_id IS NULL AND deleted_at IS NULL`,
        [metadata.bankStatementImportId, metadata.companyId]
      )
      statementIds = rows.map(s => s.id)

    } else {
      await jobsService.updateProgress(jobId, 10, userId)
      const conditions = [
        'company_id = $1', 'is_reconciled = true', 'is_pending = false',
        'journal_id IS NULL', 'deleted_at IS NULL',
      ]
      const values: unknown[] = [metadata.companyId]
      let idx = 2

      if (metadata.bank_account_id) { conditions.push(`bank_account_id = $${idx++}`); values.push(metadata.bank_account_id) }
      if (metadata.date_from) { conditions.push(`transaction_date >= $${idx++}`); values.push(metadata.date_from) }
      if (metadata.date_to) { conditions.push(`transaction_date <= $${idx++}`); values.push(metadata.date_to) }

      const { rows } = await pool.query(
        `SELECT id FROM bank_statements WHERE ${conditions.join(' AND ')}`,
        values
      )
      statementIds = rows.map(s => s.id)
    }

    if (statementIds.length === 0) {
      logInfo('No eligible statements found for journal generation', { job_id: jobId })
      return {
        filePath: '', fileName: '',
        importResults: { success: [], failed: [], total_statements: 0, total_journals: 0, type: 'bank_rec_journals' },
      }
    }

    await jobsService.updateProgress(jobId, 20, userId)

    const progressCallback = (progress: { current: number; total: number; phase: string; message: string }) => {
      const mapped = 20 + Math.round((progress.current / progress.total) * 75)
      jobsService.updateProgress(jobId, mapped, userId)
    }

    const result = await generateBankRecJournals(statementIds, metadata.companyId, progressCallback, metadata.branchId)
    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Bank reconciliation journals job completed', {
      job_id: jobId, total_statements: result.total_statements,
      journals_created: result.total_journals, journals_failed: result.failed.length,
    })

    return {
      filePath: '', fileName: '',
      importResults: {
        success: result.success, failed: result.failed,
        total_statements: result.total_statements, total_journals: result.total_journals,
        duration_ms: result.duration_ms, type: 'bank_rec_journals',
      },
    }
  } catch (error) {
    logError('Bank reconciliation journals job failed', { job_id: jobId, error })
    throw error
  }
}
