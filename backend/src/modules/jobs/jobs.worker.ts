/**
 * Job Worker
 * Background job processor
 */

import { supabase } from '@/config/supabase'
import { logInfo, logError } from '@/config/logger'
import { jobsRepository } from './jobs.repository'
import { jobsService } from './jobs.service'
import { JOB_QUEUE_CONFIG } from './jobs.constants'

export type JobProcessor = (jobId: string, userId: string, metadata: Record<string, any>) => Promise<{
  filePath: string
  fileName: string
}>

class JobWorker {
  private processors: Map<string, JobProcessor> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null
  private activeJobs = new Set<string>()
  private isShuttingDown = false

  /**
   * Register job processor
   */
  registerProcessor(type: string, processor: JobProcessor): void {
    this.processors.set(type, processor)
    logInfo('Job processor registered', { type })
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
    
    try {
      // Mark as processing
      const job = await jobsRepository.markAsProcessing(jobId)
      logInfo('Job processing started', { job_id: jobId, type: job.type })

      // Store user_id for error handling
      jobUserId = job.user_id
      jobType = job.type

      // Get processor
      const processor = this.processors.get(job.type)
      if (!processor) {
        throw new Error(`No processor registered for job type: ${job.type}`)
      }

      // Execute processor with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), JOB_QUEUE_CONFIG.jobTimeout)
      })

      const result = await Promise.race([
        processor(jobId, job.user_id, job.metadata || {}),
        timeoutPromise,
      ])

      // Complete job
      await jobsService.completeJob(jobId, job.user_id, result.filePath, result.fileName)
      logInfo('Job processing completed', { job_id: jobId })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logError('Job processing failed', { job_id: jobId, error })

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
