/**
 * Bank Statement Import Job Processor
 * Handles background processing of bank statement imports via jobs system
 */

import { logInfo, logError } from '@/config/logger'
import { jobsService, jobsRepository } from '@/modules/jobs'
import { JobProcessor } from '../jobs.worker'
import type { BankStatementImportJobMetadata } from '../../reconciliation/bank-statement-import/bank-statement-import.types'
import { BankStatementImportService, bankStatementImportService } from '../../reconciliation/bank-statement-import/bank-statement-import.service'
import { BankStatementImportRepository } from '../../reconciliation/bank-statement-import/bank-statement-import.repository'

// ==============================
// CONFIGURATION
// ==============================
const BATCH_SIZE = 500
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000
const DELAY_BETWEEN_BATCHES_MS = 200

// ==============================
// MAIN PROCESSOR
// ==============================

export const processBankStatementImport: JobProcessor<BankStatementImportJobMetadata> = async (
  jobId: string,
  userId: string,
  metadata: BankStatementImportJobMetadata
) => {
  // Track results
  const results = {
    total: 0,
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[]
  }

  let importCompanyId: string | null = null

  try {
    logInfo('Starting bank statement import', { 
      job_id: jobId, 
      user_id: userId,
      metadata
    })

    // ==============================
    // PHASE 1: Validation & Setup (10%)
    // ==============================
    await jobsService.updateProgress(jobId, 5, userId)

    // Validate metadata
    if (!metadata || !metadata.importId) {
      throw new Error('Invalid metadata: importId is required')
    }

    const { importId, bankAccountId, companyId, skipDuplicates, totalRows } = metadata
    
    await jobsService.updateProgress(jobId, 10, userId)

    // Get company_id from the job record if not in metadata
    const job = await jobsRepository.findById(jobId, userId)
    if (!job) {
      throw new Error('Job not found')
    }
    importCompanyId = companyId || job.company_id

    // Initialize service with repository
    const repository = new BankStatementImportRepository()
    const service = new BankStatementImportService(repository)

    // Process the import - convert string jobId to number
    const jobIdNum = parseInt(jobId, 10)
    const processResult = await service.processImport(
      jobIdNum,
      importId,
      importCompanyId,
      skipDuplicates || false
    )

    results.total = totalRows || 0
    results.processed = processResult.processed_count
    results.created = processResult.processed_count

    // ==============================
    // PHASE 2: Finalization (100%)
    // ==============================
    await jobsService.updateProgress(jobId, 100, userId)

    logInfo('Bank statement import completed', {
      job_id: jobId,
      import_id: importId,
      total: results.total,
      processed: results.processed,
      created: results.created,
      skipped: results.skipped,
      failed: results.failed
    })

    return {
      filePath: '',
      fileName: '',
      importResults: {
        ...results,
        importId,
        bankAccountId
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = error instanceof Error ? { 
      name: error.name, 
      message: error.message,
      stack: error.stack
    } : String(error)
    
    logError('Bank statement import failed', { 
      job_id: jobId, 
      error_message: errorMessage,
      error_details: errorDetails
    })

    throw error
  }
}

