/**
 * Jobs Service
 * Business logic for background job queue
 */

import { supabase } from '@/config/supabase'
import { logInfo, logError } from '@/config/logger'
import { Job, CreateJobDto, UpdateJobDto } from './jobs.types'
import { JobErrors } from './jobs.errors'
import { jobsRepository } from './jobs.repository'
import { STORAGE_BUCKET, JOB_QUEUE_CONFIG } from './jobs.constants'
import * as fs from 'fs'
import * as path from 'path'

export class JobsService {
  /**
   * Get user's recent jobs (last 3)
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
    return jobsRepository.create(dto)
  }

  /**
   * Upload file to Supabase Storage with validation
   */
  async uploadResultFile(
    jobId: string,
    userId: string,
    filePath: string,
    fileName: string
  ): Promise<{ url: string; path: string; size: number }> {
    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found')
      }

      // Get file size and validate
      const fileSize = fs.statSync(filePath).size
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (fileSize > maxSize) {
        throw JobErrors.FILE_UPLOAD_FAILED(`File size ${fileSize} exceeds maximum ${maxSize}`)
      }

      // Read file
      const fileBuffer = fs.readFileSync(filePath)

      // Generate storage path: {userId}/{jobId}/{fileName}
      const storagePath = `${userId}/${jobId}/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        })

      if (error) throw error

      // Get signed URL (expires same time as job)
      const expiresIn = Math.floor(JOB_QUEUE_CONFIG.resultExpiration / 1000)
      const { data: urlData } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresIn)

      if (!urlData?.signedUrl) throw new Error('Failed to generate signed URL')

      logInfo('Service uploadResultFile success', { job_id: jobId, path: storagePath, size: fileSize })

      return {
        url: urlData.signedUrl,
        path: storagePath,
        size: fileSize,
      }
    } catch (error) {
      logError('Service uploadResultFile error', { job_id: jobId, error })
      throw JobErrors.FILE_UPLOAD_FAILED(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Complete job with result file (with rollback on failure)
   */
  async completeJob(
    jobId: string,
    userId: string,
    resultFilePath: string,
    resultFileName: string
  ): Promise<Job> {
    let uploadedFilePath: string | null = null
    
    try {
      // Upload file to storage
      const { url, path: storagePath, size } = await this.uploadResultFile(
        jobId,
        userId,
        resultFilePath,
        resultFileName
      )
      uploadedFilePath = storagePath

      // Mark job as completed (atomic)
      const job = await jobsRepository.markAsCompleted(jobId, userId, url, storagePath, size)

      // Clean up local file
      this.cleanupLocalFile(resultFilePath)

      logInfo('Service completeJob success', { job_id: jobId })
      return job
    } catch (error) {
      logError('Service completeJob error', { job_id: jobId, error })
      
      // Rollback: Delete uploaded file if job update failed
      if (uploadedFilePath) {
        try {
          await supabase.storage.from(STORAGE_BUCKET).remove([uploadedFilePath])
          logInfo('Rolled back uploaded file', { job_id: jobId, path: uploadedFilePath })
        } catch (rollbackError) {
          logError('Failed to rollback uploaded file', { job_id: jobId, error: rollbackError })
        }
      }
      
      // Clean up local file
      this.cleanupLocalFile(resultFilePath)
      
      throw error
    }
  }

  /**
   * Clean up local file with error handling
   */
  private cleanupLocalFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        logInfo('Local file cleaned up', { path: filePath })
      }
    } catch (error) {
      logError('Failed to delete local file', { path: filePath, error })
      // Schedule for retry
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
        } catch (retryError) {
          logError('Failed to delete local file on retry', { path: filePath, error: retryError })
        }
      }, 60000) // Retry after 1 minute
    }
  }

  /**
   * Fail job with error message
   */
  async failJob(jobId: string, userId: string, errorMessage: string): Promise<Job> {
    return jobsRepository.markAsFailed(jobId, userId, errorMessage)
  }

  /**
   * Update job progress
   */
  async updateProgress(jobId: string, progress: number, _userId?: string): Promise<void> {
    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100')
    }
    return jobsRepository.updateProgress(jobId, progress)
  }

  /**
   * Cleanup expired jobs
   */
  async cleanupExpiredJobs(): Promise<void> {
    try {
      const expiredJobs = await jobsRepository.findExpiredJobs()

      for (const job of expiredJobs) {
        try {
          // Delete file from storage
          if (job.file_path) {
            const { error } = await supabase.storage
              .from(STORAGE_BUCKET)
              .remove([job.file_path])

            if (error) {
              logError('Failed to delete file from storage', { job_id: job.id, path: job.file_path, error })
            }
          }

          // Delete job record
          await jobsRepository.delete(job.id, job.user_id)

          logInfo('Cleaned up expired job', { job_id: job.id })
        } catch (error) {
          logError('Failed to cleanup job', { job_id: job.id, error })
        }
      }

      logInfo('Cleanup expired jobs completed', { count: expiredJobs.length })
    } catch (error) {
      logError('Cleanup expired jobs error', { error })
      throw error
    }
  }

  /**
   * Cancel job
   */
  async cancelJob(id: string, userId: string): Promise<Job> {
    const job = await this.getJobById(id, userId)

    if (job.status === 'completed' || job.status === 'failed') {
      throw new Error('Cannot cancel completed or failed job')
    }

    return jobsRepository.update(id, userId, { status: 'cancelled' })
  }
}

export const jobsService = new JobsService()
