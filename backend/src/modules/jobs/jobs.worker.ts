/**
 * Job Worker
 * Background job processor
 * Fully type-safe, integrated with JobsService & JobsRepository
 */

import { logInfo, logError } from '@/config/logger'
import { jobsRepository } from './jobs.repository'
import { jobsService } from './jobs.service'
import { JOB_QUEUE_CONFIG } from './jobs.constants'

// -----------------------------
// Type-safe Job Processor
// -----------------------------
export type JobProcessor<M extends Record<string, any> = Record<string, any>> = (
  jobId: string,
  userId: string,
  metadata: M
) => Promise<{
  filePath: string
  fileName: string
  importResults?: Record<string, unknown>
}>

// -----------------------------
// Worker class
// -----------------------------
class JobWorker {
  private processors: Map<string, JobProcessor> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null
  private pollingInterval: NodeJS.Timeout | null = null
  private activeJobs = new Set<string>()
  private isShuttingDown = false

  // -----------------------------
  // Register processor (type-safe)
  // -----------------------------
  registerProcessor<M extends Record<string, any>>(type: string, processor: JobProcessor<M>): void {
    this.processors.set(type, processor as JobProcessor)
    logInfo('Job processor registered', { type })
  }

  // -----------------------------
  // Start polling for pending jobs
  // -----------------------------
  startPolling(): void {
    if (this.pollingInterval) return
    const interval = 5000
    this.pollingInterval = setInterval(() => this.pollAndProcessPendingJobs(), interval)
    logInfo('Job polling started', { interval })

    // Run immediately
    this.pollAndProcessPendingJobs().catch(err => logError('Initial polling failed', { error: err }))
  }

  stopPolling(): void {
    if (this.pollingInterval) clearInterval(this.pollingInterval)
    this.pollingInterval = null
    logInfo('Job polling stopped')
  }

  private async pollAndProcessPendingJobs(): Promise<void> {
    try {
      const pendingJobs = await jobsRepository.findPendingJobs(JOB_QUEUE_CONFIG.maxConcurrentJobs * 2)
      for (const job of pendingJobs) {
        if (this.activeJobs.has(job.id)) continue
        if (this.activeJobs.size >= JOB_QUEUE_CONFIG.maxConcurrentJobs) break

        this.processJob(job.id).catch(error => logError('Auto-processing job failed', { job_id: job.id, error }))
      }
    } catch (error) {
      logError('Polling error', { error })
    }
  }

  // -----------------------------
  // Process single job
  // -----------------------------
  async processJob(jobId: string): Promise<void> {
    if (this.isShuttingDown) throw new Error('Worker is shutting down')

    this.activeJobs.add(jobId)
    let jobUserId: string | null = null
    let jobType = ''
    let jobModule = ''

    try {
      const job = await jobsRepository.markAsProcessing(jobId)
      logInfo('Job processing started', { job_id: jobId, type: job.type, module: job.module })

      jobUserId = job.user_id
      jobType = job.type
      jobModule = job.module || ''

      const processorKey = jobModule ? `${jobType}:${jobModule}` : jobType
      const processor = this.processors.get(processorKey)
      if (!processor) throw new Error(`No processor registered for ${processorKey}`)

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Job timeout')), JOB_QUEUE_CONFIG.jobTimeout)
      )

      const result = await Promise.race([
        processor(jobId, job.user_id, job.metadata || {}),
        timeoutPromise
      ])

      await jobsService.completeJob(jobId, job.user_id, result.filePath, result.fileName, result.importResults)
      logInfo('Job processing completed', { job_id: jobId, processorKey })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logError('Job processing failed', { job_id: jobId, type: jobType, module: jobModule, error })

      if (jobUserId) await jobsService.failJob(jobId, jobUserId, message)
    } finally {
      this.activeJobs.delete(jobId)
    }
  }

  // -----------------------------
  // Start / stop cleanup
  // -----------------------------
  startCleanup(): void {
    if (this.cleanupInterval) return
    this.cleanupInterval = setInterval(() => jobsService.cleanupExpiredJobs().catch(err => logError('Cleanup interval error', { error: err })), JOB_QUEUE_CONFIG.cleanupInterval)
    logInfo('Job cleanup interval started', { interval: JOB_QUEUE_CONFIG.cleanupInterval })
  }

  stopCleanup(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval)
    this.cleanupInterval = null
    logInfo('Job cleanup interval stopped')
  }

  // -----------------------------
  // Graceful shutdown
  // -----------------------------
  async gracefulShutdown(timeoutMs = 30000): Promise<void> {
    this.isShuttingDown = true
    this.stopCleanup()
    this.stopPolling()
    
    const start = Date.now()
    while (this.activeJobs.size > 0) {
      if (Date.now() - start > timeoutMs) {
        logError('Graceful shutdown timeout', { remaining_jobs: Array.from(this.activeJobs), timeout_ms: timeoutMs })
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    logInfo('Worker shutdown complete', { active_jobs: this.activeJobs.size, duration_ms: Date.now() - start })
  }
}

export const jobWorker = new JobWorker()
