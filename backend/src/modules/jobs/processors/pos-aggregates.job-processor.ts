/**
 * POS Aggregates Job Processor
 * Wrapper untuk mengintegrasikan generateAggregatedTransactions dengan sistem job
 * 
 * Metadata structure:
 * {
 *   type: 'import',
 *   module: 'pos_aggregates',
 *   posImportId: string,
 *   branchName?: string,
 *   companyId: string
 * }
 */

import { logInfo, logError } from '@/config/logger'
import { jobsService, jobsRepository } from '@/modules/jobs'
import { generateAggregatedTransactionsOptimized } from './pos-aggregates.processor'
import { JobProcessor } from '../jobs.worker'

export interface PosAggregatesJobMetadata {
  type: 'import'
  module: 'pos_aggregates'
  posImportId: string
  branchName?: string
  companyId: string
}

export const processPosAggregates: JobProcessor<PosAggregatesJobMetadata> = async (
  jobId: string,
  userId: string,
  metadata: PosAggregatesJobMetadata
) => {
  try {
    logInfo('Processing POS aggregates job', { 
      job_id: jobId, 
      user_id: userId,
      pos_import_id: metadata.posImportId
    })

    await jobsService.updateProgress(jobId, 5, userId)

    // Validate metadata
    if (!metadata.posImportId) {
      throw new Error('posImportId is required in metadata')
    }

    if (!metadata.companyId) {
      // Try to get company_id from job record
      const job = await jobsRepository.findById(jobId, userId)
      if (!job) throw new Error('Job not found')
      metadata.companyId = job.company_id
    }

    // Progress callback
    const progressCallback = (progress: { current: number; total: number; phase: string; message: string }) => {
      // Map 0-100 progress ke 5-95 range
      const mappedProgress = 5 + Math.round((progress.current / progress.total) * 90)
      jobsService.updateProgress(jobId, mappedProgress, userId)
    }

    // Execute the aggregation
    const result = await generateAggregatedTransactionsOptimized(
      metadata.posImportId,
      metadata.branchName,
      metadata.companyId,
      progressCallback
    )

    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('POS aggregates job completed', {
      job_id: jobId,
      pos_import_id: metadata.posImportId,
      created: result.created,
      skipped: result.skipped,
      failed: result.failed,
      total_groups: result.total_groups
    })

    return {
      filePath: '',
      fileName: '',
      importResults: {
        created: result.created,
        skipped: result.skipped,
        failed: result.failed,
        errors: result.errors,
        totalGroups: result.total_groups,
        type: 'pos_aggregates'
      }
    }

  } catch (error) {
    logError('POS aggregates job failed', { job_id: jobId, error })
    throw error
  }
}

