/**
 * POS Journals Job Processor
 * Wrapper untuk mengintegrasikan generateJournals dengan sistem job
 *
 * Mandatory filters (applied to ALL query paths):
 *   - is_reconciled = true
 *   - superseded_by IS NULL
 *   - deleted_at IS NULL
 */

import { pool } from '@/config/db'
import { logInfo, logError, logWarn } from '@/config/logger'
import { jobsService, jobsRepository } from '@/modules/jobs'
import { generateJournalsOptimized } from './pos-journals.processor'
import { JobProcessor } from '../jobs.worker'

function escapeSearch(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&')
}

export interface PosJournalsJobMetadata {
  type: 'import'
  module: 'pos_journals'
  posImportId?: string
  transactionIds?: string[]
  companyId: string
  status?: 'READY' | 'PROCESSING' | 'MAPPED' | 'POSTED' | 'FAILED'
  transaction_date_from?: string
  transaction_date_to?: string
  branch_name?: string
  payment_method_id?: number
}

const MANDATORY_CONDITIONS = [
  'is_reconciled = true',
  'superseded_by IS NULL',
  'deleted_at IS NULL',
]

export const processPosJournals: JobProcessor<PosJournalsJobMetadata> = async (
  jobId: string, userId: string, metadata: PosJournalsJobMetadata
) => {
  try {
    logInfo('Processing POS journals job', { job_id: jobId, user_id: userId, pos_import_id: metadata.posImportId })
    await jobsService.updateProgress(jobId, 5, userId)

    if (!metadata.companyId) {
      const job = await jobsRepository.findById(jobId, userId)
      if (!job) throw new Error('Job not found')
      metadata.companyId = job.company_id
    }

    let transactions: any[] = []

    if (metadata.transactionIds && metadata.transactionIds.length > 0) {
      await jobsService.updateProgress(jobId, 10, userId)
      const { rows } = await pool.query(
        `SELECT * FROM aggregated_transactions
         WHERE id = ANY($1::uuid[]) AND ${MANDATORY_CONDITIONS.join(' AND ')}`,
        [metadata.transactionIds]
      )
      transactions = rows

      const skipped = metadata.transactionIds.length - transactions.length
      if (skipped > 0) {
        logWarn('Transactions skipped — not reconciled or superseded', {
          job_id: jobId, requested: metadata.transactionIds.length, eligible: transactions.length, skipped,
        })
      }

    } else if (metadata.posImportId) {
      await jobsService.updateProgress(jobId, 10, userId)
      const conditions = [...MANDATORY_CONDITIONS, "source_id = $1", "source_type = 'POS'"]
      const values: unknown[] = [metadata.posImportId]
      let idx = 2

      if (metadata.status) {
        conditions.push(`status = $${idx++}`); values.push(metadata.status)
      } else {
        conditions.push(`status IN ('READY', 'PROCESSING')`)
      }

      const { rows } = await pool.query(
        `SELECT * FROM aggregated_transactions WHERE ${conditions.join(' AND ')}`,
        values
      )
      transactions = rows

    } else {
      await jobsService.updateProgress(jobId, 10, userId)
      const conditions = [...MANDATORY_CONDITIONS]
      const values: unknown[] = []
      let idx = 1

      if (metadata.status) {
        conditions.push(`status = $${idx++}`); values.push(metadata.status)
      } else {
        conditions.push(`status IN ('READY', 'PROCESSING')`)
      }
      if (metadata.transaction_date_from) { conditions.push(`transaction_date >= $${idx++}`); values.push(metadata.transaction_date_from) }
      if (metadata.transaction_date_to) { conditions.push(`transaction_date <= $${idx++}`); values.push(metadata.transaction_date_to) }
      if (metadata.branch_name) { conditions.push(`branch_name ILIKE $${idx++}`); values.push(`%${escapeSearch(metadata.branch_name)}%`) }
      if (metadata.payment_method_id) { conditions.push(`payment_method_id = $${idx++}`); values.push(metadata.payment_method_id) }

      const { rows } = await pool.query(
        `SELECT * FROM aggregated_transactions WHERE ${conditions.join(' AND ')}`,
        values
      )
      transactions = rows
    }

    if (transactions.length === 0) {
      logInfo('No transactions found for journal generation', { job_id: jobId })
      return {
        filePath: '', fileName: '',
        importResults: { success: [], failed: [], total_transactions: 0, total_journals: 0, type: 'pos_journals' },
      }
    }

    await jobsService.updateProgress(jobId, 20, userId)
    logInfo('Found transactions for journal generation', { job_id: jobId, transaction_count: transactions.length })

    const progressCallback = (progress: { current: number; total: number; phase: string; message: string }) => {
      const mappedProgress = 20 + Math.round((progress.current / progress.total) * 75)
      jobsService.updateProgress(jobId, mappedProgress, userId)
    }

    const result = await generateJournalsOptimized(transactions, metadata.companyId, progressCallback)
    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('POS journals job completed', {
      job_id: jobId, total_transactions: result.total_transactions,
      journals_created: result.total_journals, journals_failed: result.failed.length,
    })

    return {
      filePath: '', fileName: '',
      importResults: {
        success: result.success, failed: result.failed,
        total_transactions: result.total_transactions, total_journals: result.total_journals,
        duration_ms: result.duration_ms, type: 'pos_journals',
      },
    }
  } catch (error) {
    logError('POS journals job failed', { job_id: jobId, error })
    throw error
  }
}
