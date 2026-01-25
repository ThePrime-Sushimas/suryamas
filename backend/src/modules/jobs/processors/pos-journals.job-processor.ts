/**
 * POS Journals Job Processor
 * Wrapper untuk mengintegrasikan generateJournals dengan sistem job
 * 
 * Metadata structure:
 * {
 *   type: 'import',
 *   module: 'pos_journals',
 *   posImportId?: string,        // Jika ingin generate dari import
 *   transactionIds?: string[],   // Atau langsung specify transactions
 *   companyId: string,
 *   status?: 'READY' | 'PROCESSING' | 'MAPPED'  // Filter transactions by status
 * }
 */

import { supabase } from '@/config/supabase'
import { logInfo, logError } from '@/config/logger'
import { jobsService, jobsRepository } from '@/modules/jobs'
import { generateJournalsOptimized } from './pos-journals.processor'
import { JobProcessor } from '../jobs.worker'

export interface PosJournalsJobMetadata {
  type: 'import'
  module: 'pos_journals'
  posImportId?: string
  transactionIds?: string[]
  companyId: string
  status?: 'READY' | 'PROCESSING' | 'MAPPED' | 'POSTED' | 'FAILED'
  // Filter-based generation (when neither posImportId nor transactionIds provided)
  transaction_date_from?: string
  transaction_date_to?: string
  branch_name?: string
  payment_method_id?: number
  include_unreconciled_only?: boolean
}

export const processPosJournals: JobProcessor<PosJournalsJobMetadata> = async (
  jobId: string,
  userId: string,
  metadata: PosJournalsJobMetadata
) => {
  try {
    logInfo('Processing POS journals job', { 
      job_id: jobId, 
      user_id: userId,
      pos_import_id: metadata.posImportId
    })

    await jobsService.updateProgress(jobId, 5, userId)

    // Validate and get company_id
    if (!metadata.companyId) {
      const job = await jobsRepository.findById(jobId, userId)
      if (!job) throw new Error('Job not found')
      metadata.companyId = job.company_id
    }

    let transactions: any[] = []

    if (metadata.transactionIds && metadata.transactionIds.length > 0) {
      // Direct transaction IDs provided
      await jobsService.updateProgress(jobId, 10, userId)
      
      const { data, error } = await supabase
        .from('aggregated_transactions')
        .select('*')
        .in('id', metadata.transactionIds)
        .is('deleted_at', null)

      if (error) throw error
      transactions = data || []

    } else if (metadata.posImportId) {
      // Get transactions from posImport
      await jobsService.updateProgress(jobId, 10, userId)

      let query = supabase
        .from('aggregated_transactions')
        .select('*')
        .eq('source_id', metadata.posImportId)
        .eq('source_type', 'POS')
        .is('deleted_at', null)

      // Filter by status if specified
      if (metadata.status) {
        query = query.eq('status', metadata.status)
      } else {
        // Default to READY and PROCESSING
        query = query.in('status', ['READY', 'PROCESSING'])
      }

      const { data, error } = await query

      if (error) throw error
      transactions = data || []

    } else {
      // Filter-based generation: query transactions based on filter criteria
      await jobsService.updateProgress(jobId, 10, userId)

      // Build query for transactions based on filters
      let query = supabase
        .from('aggregated_transactions')
        .select('*')
        .is('deleted_at', null)

      // Apply status filter
      if (metadata.status) {
        query = query.eq('status', metadata.status)
      } else {
        // Default to READY and PROCESSING
        query = query.in('status', ['READY', 'PROCESSING'])
      }

      // Apply date filters
      if (metadata.transaction_date_from) {
        query = query.gte('transaction_date', metadata.transaction_date_from)
      }
      if (metadata.transaction_date_to) {
        query = query.lte('transaction_date', metadata.transaction_date_to)
      }

      // Apply branch filter
      if (metadata.branch_name) {
        query = query.eq('branch_name', metadata.branch_name)
      }

      // Apply payment method filter
      if (metadata.payment_method_id) {
        query = query.eq('payment_method_id', metadata.payment_method_id)
      }

      // Apply unreconciled only filter
      if (metadata.include_unreconciled_only) {
        query = query.eq('is_reconciled', false)
      }

      const { data, error } = await query

      if (error) throw error
      transactions = data || []
    }

    if (transactions.length === 0) {
      logInfo('No transactions found for journal generation', { job_id: jobId })
      return {
        filePath: '',
        fileName: '',
        importResults: {
          success: [],
          failed: [],
          total_transactions: 0,
          total_journals: 0,
          type: 'pos_journals'
        }
      }
    }

    await jobsService.updateProgress(jobId, 20, userId)

    logInfo('Found transactions for journal generation', { 
      job_id: jobId,
      transaction_count: transactions.length 
    })

    // Progress callback
    const progressCallback = (progress: { current: number; total: number; phase: string; message: string }) => {
      // Map 0-100 progress ke 20-95 range
      const mappedProgress = 20 + Math.round((progress.current / progress.total) * 75)
      jobsService.updateProgress(jobId, mappedProgress, userId)
    }

    // Execute journal generation
    const result = await generateJournalsOptimized(
      transactions,
      metadata.companyId,
      progressCallback
    )

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('POS journals job completed', {
      job_id: jobId,
      total_transactions: result.total_transactions,
      journals_created: result.total_journals,
      journals_failed: result.failed.length
    })

    return {
      filePath: '',
      fileName: '',
      importResults: {
        success: result.success,
        failed: result.failed,
        total_transactions: result.total_transactions,
        total_journals: result.total_journals,
        duration_ms: result.duration_ms,
        type: 'pos_journals'
      }
    }

  } catch (error) {
    logError('POS journals job failed', { job_id: jobId, error })
    throw error
  }
}

