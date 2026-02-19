/**
 * Jobs Service
 * Business logic for background job queue
 * Fully type-safe with repository integration
 * FINAL: 100% mengikuti JobsRepository
 */

import { supabase } from '@/config/supabase'
import { logInfo, logError } from '@/config/logger'
import { Job, CreateJobDto } from './jobs.types'
import { JobErrors } from './jobs.errors'
import { jobsRepository } from './jobs.repository'
import { STORAGE_BUCKET, JOB_QUEUE_CONFIG } from './jobs.constants'
import { AuditService } from '../monitoring/monitoring.service'
import * as fs from 'fs'

export class JobsService {
  /**
   * Get user's recent jobs (last 10)
   */
  async getUserRecentJobs(userId: string): Promise<Job[]> {
    return jobsRepository.findUserRecentJobs(userId)
  }

  /**
   * Get job by ID
   */
  async getJobById(id: string, userId: string): Promise<Job> {
    const job = await jobsRepository.findById(id, userId)
    if (!job) throw JobErrors.NOT_FOUND()
    return job
  }

  /**
   * Create new job
   */
  async createJob(dto: CreateJobDto): Promise<Job> {
    const job = await jobsRepository.create(dto)

    if (dto.user_id) {
      await AuditService.log('CREATE', 'job', job.id, dto.user_id, undefined, {
        type: job.type,
        module: job.module,
        name: job.name,
        status: job.status
      })
    }

    return job
  }

  /**
   * Upload result file to Supabase and return signed URL
   */
  async uploadResultFile(
    jobId: string,
    userId: string,
    filePath: string,
    fileName: string
  ): Promise<{ url: string; path: string; size: number }> {
    if (!fs.existsSync(filePath)) throw new Error('File not found')

    const fileSize = fs.statSync(filePath).size
    const maxSize = 50 * 1024 * 1024
    if (fileSize > maxSize) throw JobErrors.FILE_UPLOAD_FAILED(`File size ${fileSize} exceeds max ${maxSize}`)

    const fileBuffer = fs.readFileSync(filePath)
    const storagePath = `${userId}/${jobId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upsert: false })
    if (uploadError) throw uploadError

    const expiresIn = Math.floor(JOB_QUEUE_CONFIG.resultExpiration / 1000)
    const { data: urlData } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, expiresIn)
    if (!urlData?.signedUrl) throw new Error('Failed to generate signed URL')

    logInfo('Service uploadResultFile success', { job_id: jobId, path: storagePath, size: fileSize })
    return { url: urlData.signedUrl, path: storagePath, size: fileSize }
  }

  /**
   * Complete job without result file (import job)
   */
  async completeJobWithoutFile(
    jobId: string,
    userId: string,
    importResults?: Record<string, unknown>
  ): Promise<Job> {
    const existingJob = await jobsRepository.findById(jobId, userId)
    const job = await jobsRepository.markAsCompleted(jobId, userId, '', '', 0)

    if (importResults) {
      if (existingJob) {
        await jobsRepository.update(jobId, userId, {
          metadata: {
            ...(existingJob.metadata as Record<string, unknown>),
            importResults
          }
        })
      }
    }

    await AuditService.log('UPDATE', 'job', jobId, userId, existingJob, {
      status: 'completed',
      type: job.type,
      module: job.module
    })

    logInfo('Service completeJobWithoutFile success', { job_id: jobId })
    return job
  }

  /**
   * Complete job with result file
   */
  async completeJob(
    jobId: string,
    userId: string,
    resultFilePath?: string,
    resultFileName?: string,
    importResults?: Record<string, unknown>
  ): Promise<Job> {
    if (!resultFilePath || !resultFileName) {
      return this.completeJobWithoutFile(jobId, userId, importResults)
    }

    let uploadedFilePath: string | null = null

    try {
      const { url, path: storagePath, size } = await this.uploadResultFile(jobId, userId, resultFilePath, resultFileName)
      uploadedFilePath = storagePath

      const job = await jobsRepository.markAsCompleted(jobId, userId, url, storagePath, size)
      this.cleanupLocalFile(resultFilePath)

      logInfo('Service completeJob success', { job_id: jobId })
      return job
    } catch (error) {
      logError('Service completeJob error', { job_id: jobId, error })

      if (uploadedFilePath) {
        try {
          await supabase.storage.from(STORAGE_BUCKET).remove([uploadedFilePath])
          logInfo('Rolled back uploaded file', { job_id: jobId, path: uploadedFilePath })
        } catch (rollbackError) {
          logError('Failed rollback uploaded file', { job_id: jobId, error: rollbackError })
        }
      }

      this.cleanupLocalFile(resultFilePath)
      throw error
    }
  }

  /**
   * Fail job
   */
  async failJob(jobId: string, userId: string, errorMessage: string): Promise<Job> {
    const existingJob = await jobsRepository.findById(jobId, userId)
    const job = await jobsRepository.markAsFailed(jobId, userId, errorMessage)

    await AuditService.log('UPDATE', 'job', jobId, userId, existingJob, {
      status: 'failed',
      error: errorMessage
    })

    return job
  }

  /**
   * Update job progress
   */
  async updateProgress(jobId: string, progress: number, userId: string): Promise<void> {
    if (progress < 0 || progress > 100) throw new Error('Progress must be 0–100')
    return jobsRepository.updateProgress(jobId, progress, userId)
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string, userId: string): Promise<Job> {
    const existingJob = await this.getJobById(jobId, userId)
    if (existingJob.status === 'completed' || existingJob.status === 'failed') {
      throw new Error('Cannot cancel completed or failed job')
    }
    
    const job = await jobsRepository.update(jobId, userId, { status: 'cancelled' })

    await AuditService.log('UPDATE', 'job', jobId, userId, existingJob, {
      status: 'cancelled'
    })

    return job
  }

  /**
   * Clear all completed/failed/cancelled jobs for a user in a company
   */
  async clearAllJobs(userId: string, companyId: string): Promise<number> {
    const jobs = await jobsRepository.findUserRecentJobs(userId)
    const completedJobs = jobs.filter(
      j => j.company_id === companyId && ['completed', 'failed', 'cancelled'].includes(j.status)
    )

    const jobIds: string[] = []
    for (const job of completedJobs) {
      await jobsRepository.delete(job.id, userId)
      jobIds.push(job.id)
    }

    if (userId && jobIds.length > 0) {
      await AuditService.log('BULK_DELETE', 'job', jobIds.join(','), userId, undefined, {
        company_id: companyId,
        count: jobIds.length
      })
    }

    logInfo('Service clearAllJobs success', { user_id: userId, deleted_count: completedJobs.length })
    return completedJobs.length
  }

  /**
   * Cleanup expired jobs and storage
   */
  async cleanupExpiredJobs(): Promise<void> {
    const expiredJobs = await jobsRepository.findExpiredJobs()
    for (const job of expiredJobs) {
      try {
        if (job.file_path) {
          const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([job.file_path])
          if (error) logError('Failed to delete file from storage', { job_id: job.id, path: job.file_path, error })
        }
        await jobsRepository.delete(job.id, job.user_id)
        logInfo('Cleaned up expired job', { job_id: job.id })
      } catch (error) {
        logError('Failed to cleanup job', { job_id: job.id, error })
      }
    }
    logInfo('Cleanup expired jobs completed', { count: expiredJobs.length })
  }

  /**
   * Safely delete local file
   */
  private cleanupLocalFile(filePath?: string): void {
    if (!filePath) return
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      logInfo('Local file cleaned up', { path: filePath })
    } catch (error) {
      logError('Failed to delete local file', { path: filePath, error })
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        } catch (retryError) {
          logError('Retry failed for local file delete', { path: filePath, error: retryError })
        }
      }, 60000)
    }
  }
}

export const jobsService = new JobsService()
