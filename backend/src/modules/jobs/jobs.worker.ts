/**
 * Job Worker
 * Background job processor
 */

import { supabase } from '@/config/supabase'
import { logInfo, logError } from '@/config/logger'
import { jobsRepository } from './jobs.repository'
import { jobsService } from './jobs.service'
import { JOB_QUEUE_CONFIG } from './jobs.constants'

// Generic JobProcessor type that accepts typed metadata
export type JobProcessor<M extends Record<string, any> = Record<string, any>> = (
  jobId: string,
  userId: string,
  metadata: M
) => Promise<{
  filePath: string
  fileName: string
  importResults?: Record<string, unknown>
}>

class JobWorker {
  private processors: Map<string, JobProcessor> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null
  private pollingInterval: NodeJS.Timeout | null = null
  private activeJobs = new Set<string>()
  private isShuttingDown = false

  /**
   * Register job processor with type-safe metadata
   */
  registerProcessor<M extends Record<string, any>>(type: string, processor: JobProcessor<M>): void {
    // Cast to JobProcessor for internal storage
    this.processors.set(type, processor as JobProcessor)
    logInfo('Job processor registered', { type })
  }

  /**
   * Start polling for pending jobs
   */
  startPolling(): void {
    if (this.pollingInterval) return

    const pollInterval = 5000 // Poll every 5 seconds
    this.pollingInterval = setInterval(async () => {
      await this.pollAndProcessPendingJobs()
    }, pollInterval)

    logInfo('Job polling started', { interval: pollInterval })

    // Also run immediately on start
    this.pollAndProcessPendingJobs().catch(error => {
      logError('Initial polling failed', { error })
    })
  }

  /**
   * Stop polling for pending jobs
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
      logInfo('Job polling stopped')
    }
  }

  /**
   * Poll and process pending jobs
   */
  private async pollAndProcessPendingJobs(): Promise<void> {
    try {
      // Fetch pending jobs (limit by max concurrent jobs)
      const { data: pendingJobs, error } = await supabase
        .from('jobs')
        .select('id, user_id, type, module')
        .eq('status', 'pending')
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(JOB_QUEUE_CONFIG.maxConcurrentJobs * 2)

      if (error) {
        logError('Failed to fetch pending jobs', { error })
        return
      }

      if (!pendingJobs || pendingJobs.length === 0) {
        return
      }

      // Process each pending job (skip if already processing)
      for (const job of pendingJobs) {
        if (this.activeJobs.has(job.id)) {
          continue // Already processing
        }

        // Check if we're at max concurrent capacity
        if (this.activeJobs.size >= JOB_QUEUE_CONFIG.maxConcurrentJobs) {
          break
        }

        // Process job in background
        this.processJob(job.id).catch(error => {
          logError('Auto-processing job failed', { job_id: job.id, error })
        })
      }
    } catch (error) {
      logError('Polling error', { error })
    }
  }

  /**
   * Process job with timeout and cancellation support
   */
  async processJob(jobId: string): Promise<void> {
    if (this.isShuttingDown) {
      logError('Worker is shutting down, rejecting job', { job_id: jobId })
      throw new Error('Worker is shutting down')
    }

    this.activeJobs.add(jobId)
    
    let jobUserId: string | null = null
    let jobType = ''
    let jobModule = ''
    
    try {
      // Mark as processing
      const job = await jobsRepository.markAsProcessing(jobId)
      logInfo('Job processing started', { job_id: jobId, type: job.type, module: job.module })

      // Store user_id for error handling
      jobUserId = job.user_id
      jobType = job.type
      jobModule = job.module || ''

      // Build processor key from type and module
      const processorKey = jobModule ? `${jobType}:${jobModule}` : jobType
      
      // Get processor
      const processor = this.processors.get(processorKey)
      if (!processor) {
        throw new Error(`No processor registered for: ${processorKey}`)
      }

      // Execute processor with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), JOB_QUEUE_CONFIG.jobTimeout)
      })

      const result = await Promise.race([
        processor(jobId, job.user_id, job.metadata || {}),
        timeoutPromise,
      ])

      // Complete job (pass importResults for import jobs)
      await jobsService.completeJob(jobId, job.user_id, result.filePath, result.fileName, result.importResults)
      logInfo('Job processing completed', { job_id: jobId, type: processorKey })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logError('Job processing failed', { job_id: jobId, type: jobType, module: jobModule, error })

      try {
        // Use stored user_id or fetch it from repository
        const userId = jobUserId || await this.getUserIdByJobId(jobId)
        if (userId) {
          await jobsService.failJob(jobId, userId, errorMessage)
        }
      } catch (failError) {
        logError('Failed to mark job as failed', { job_id: jobId, error: failError })
      }
    } finally {
      this.activeJobs.delete(jobId)
    }
  }

  /**
   * Get user_id from job by job_id (for error handling)
   */
  private async getUserIdByJobId(jobId: string): Promise<string | null> {
    try {
      // Query directly by job_id without user filter for internal use
      const { data, error } = await supabase
        .from('jobs')
        .select('user_id')
        .eq('id', jobId)
        .single()

      if (error || !data) return null
      return data.user_id
    } catch {
      return null
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanup(): void {
    if (this.cleanupInterval) return

    this.cleanupInterval = setInterval(async () => {
      try {
        await jobsService.cleanupExpiredJobs()
      } catch (error) {
        logError('Cleanup interval error', { error })
      }
    }, JOB_QUEUE_CONFIG.cleanupInterval)

    logInfo('Job cleanup interval started', { interval: JOB_QUEUE_CONFIG.cleanupInterval })
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      logInfo('Job cleanup interval stopped')
    }
  }

  /**
   * Graceful shutdown - wait for active jobs to complete
   */
  async gracefulShutdown(timeoutMs = 30000): Promise<void> {
    this.isShuttingDown = true
    this.stopCleanup()
    this.stopPolling()
    
    logInfo('Starting graceful shutdown', { active_jobs: this.activeJobs.size })
    
    const startTime = Date.now()
    while (this.activeJobs.size > 0) {
      if (Date.now() - startTime > timeoutMs) {
        logError('Graceful shutdown timeout', { 
          remaining_jobs: Array.from(this.activeJobs),
          timeout_ms: timeoutMs
        })
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    logInfo('Worker shutdown complete', { 
      active_jobs: this.activeJobs.size,
      duration_ms: Date.now() - startTime
    })
  }
}

export const jobWorker = new JobWorker()
