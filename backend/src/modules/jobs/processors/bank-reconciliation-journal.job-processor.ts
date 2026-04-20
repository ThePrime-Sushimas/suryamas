/**
 * Bank Reconciliation Journal Job Processor
 * Wrapper untuk mengintegrasikan generateBankRecJournals dengan sistem job
 *
 * Metadata structure:
 * {
 *   type: 'import',
 *   module: 'bank_rec_journals',
 *   companyId: string,
 *   // Option A: spesifik statement IDs
 *   statementIds?: string[],
 *   // Option B: dari import ID
 *   bankStatementImportId?: number,
 *   // Option C: filter by date + bank account
 *   bank_account_id?: number,
 *   date_from?: string,
 *   date_to?: string,
 * }
 */

import { supabase } from '@/config/supabase'
import { logInfo, logError } from '@/config/logger'
import { jobsService, jobsRepository } from '@/modules/jobs'
import { generateBankRecJournals } from './bank-reconciliation-journal.processor'
import { PermissionService } from '@/services/permission.service'
import type { JobProcessor } from '../jobs.worker'

// Auto-register bank_rec_journals module
PermissionService.registerModule('bank_rec_journals', 'Bank Reconciliation Journals').catch(() => {})

// ============================================================
// METADATA INTERFACE
// ============================================================

export interface BankRecJournalsJobMetadata {
  type: 'import'
  module: 'bank_rec_journals'
  companyId: string
  branchId?: string
  // Option A: direct statement IDs
  statementIds?: string[]
  // Option B: from bank statement import
  bankStatementImportId?: number
  // Option C: filter-based
  bank_account_id?: number
  date_from?: string
  date_to?: string
}

// ============================================================
// PROCESSOR
// ============================================================

export const processBankRecJournals: JobProcessor<BankRecJournalsJobMetadata> = async (
  jobId: string,
  userId: string,
  metadata: BankRecJournalsJobMetadata
) => {
  try {
    logInfo('Processing bank reconciliation journals job', {
      job_id:   jobId,
      user_id:  userId,
      metadata,
    })

    await jobsService.updateProgress(jobId, 5, userId)

    // ── Validate companyId ──────────────────────────────────────────────
    if (!metadata.companyId) {
      const job = await jobsRepository.findById(jobId, userId)
      if (!job) throw new Error('Job not found')
      metadata.companyId = job.company_id
    }

    let statementIds: string[] = []

    // ── Option A: Direct statement IDs ───────────────────────────────
    if (metadata.statementIds && metadata.statementIds.length > 0) {
      statementIds = metadata.statementIds
      logInfo('Using provided statement IDs', { count: statementIds.length })

    // ── Option B: From bank statement import ─────────────────────────
    } else if (metadata.bankStatementImportId) {
      await jobsService.updateProgress(jobId, 10, userId)

      const { data, error } = await supabase
        .from('bank_statements')
        .select('id')
        .eq('import_id', metadata.bankStatementImportId)
        .eq('company_id', metadata.companyId)
        .eq('is_reconciled', true)
        .eq('is_pending', false)
        .is('journal_id', null)
        .is('deleted_at', null)

      if (error) throw error
      statementIds = (data ?? []).map((s: { id: string }) => s.id)
      logInfo('Fetched statements from import', {
        import_id: metadata.bankStatementImportId,
        count:     statementIds.length,
      })

    // ── Option C: Filter-based ────────────────────────────────────────
    } else {
      await jobsService.updateProgress(jobId, 10, userId)

      let query = supabase
        .from('bank_statements')
        .select('id')
        .eq('company_id', metadata.companyId)
        .eq('is_reconciled', true)
        .eq('is_pending', false)
        .is('journal_id', null)
        .is('deleted_at', null)

      if (metadata.bank_account_id) {
        query = query.eq('bank_account_id', metadata.bank_account_id)
      }
      if (metadata.date_from) {
        query = query.gte('transaction_date', metadata.date_from)
      }
      if (metadata.date_to) {
        query = query.lte('transaction_date', metadata.date_to)
      }

      const { data, error } = await query
      if (error) throw error
      statementIds = (data ?? []).map((s: { id: string }) => s.id)
      logInfo('Fetched statements via filter', { count: statementIds.length })
    }

    if (statementIds.length === 0) {
      logInfo('No eligible statements found for journal generation', { job_id: jobId })
      return {
        filePath: '',
        fileName: '',
        importResults: {
          success:          [],
          failed:           [],
          total_statements: 0,
          total_journals:   0,
          type:             'bank_rec_journals',
        },
      }
    }

    await jobsService.updateProgress(jobId, 20, userId)
    logInfo('Found eligible statements', { job_id: jobId, count: statementIds.length })

    // ── Progress callback ───────────────────────────────────────────────
    const progressCallback = (progress: {
      current: number
      total: number
      phase: string
      message: string
    }) => {
      const mapped = 20 + Math.round((progress.current / progress.total) * 75)
      jobsService.updateProgress(jobId, mapped, userId)
    }

    // ── Execute journal generation ──────────────────────────────────────
    const result = await generateBankRecJournals(
      statementIds,
      metadata.companyId,
      progressCallback,
      metadata.branchId
    )

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Bank reconciliation journals job completed', {
      job_id:           jobId,
      total_statements: result.total_statements,
      journals_created: result.total_journals,
      journals_failed:  result.failed.length,
    })

    return {
      filePath: '',
      fileName: '',
      importResults: {
        success:          result.success,
        failed:           result.failed,
        total_statements: result.total_statements,
        total_journals:   result.total_journals,
        duration_ms:      result.duration_ms,
        type:             'bank_rec_journals',
      },
    }
  } catch (error) {
    logError('Bank reconciliation journals job failed', { job_id: jobId, error })
    throw error
  }
}
