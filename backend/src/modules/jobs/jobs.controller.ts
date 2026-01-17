/**
 * Jobs Controller
 * HTTP request handlers for job queue
 */

import { Response, NextFunction } from 'express'
import { AuthRequest } from '@/types/common.types'
import { jobsService } from './jobs.service'
import { sendSuccess, sendError } from '@/utils/response.util'
import { logInfo, logError } from '@/config/logger'

export class JobsController {
  /**
   * Get user's recent jobs (last 3)
   * GET /api/v1/jobs/recent
   */
  async getRecentJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return next(new Error('Company context required'))
      }

      const jobs = await jobsService.getUserRecentJobs(userId)

      // Filter by company (additional security layer)
      const filteredJobs = jobs.filter(job => job.company_id === companyId)

      sendSuccess(res, filteredJobs, 'Recent jobs retrieved successfully')
    } catch (error) {
      logError('Controller getRecentJobs error', { error })
      next(error)
    }
  }

  /**
   * Get job by ID
   * GET /api/v1/jobs/:id
   */
  async getJobById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return next(new Error('Company context required'))
      }

      const job = await jobsService.getJobById(id, userId)

      // Verify company access
      if (job.company_id !== companyId) {
        return next(new Error('Access denied to this job'))
      }

      sendSuccess(res, job, 'Job retrieved successfully')
    } catch (error) {
      logError('Controller getJobById error', { error })
      next(error)
    }
  }

  /**
   * Trigger job processing
   * POST /api/v1/jobs/:id/process
   */
  async processJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return next(new Error('Company context required'))
      }

      // Verify job belongs to user and company
      const job = await jobsService.getJobById(id, userId)
      if (job.company_id !== companyId) {
        return next(new Error('Access denied to this job'))
      }

      // Process job in background (don't await)
      const { jobWorker } = await import('./jobs.worker')
      jobWorker.processJob(id).catch(error => {
        logError('Background job processing error', { job_id: id, error })
      })

      sendSuccess(res, job, 'Job processing started')
    } catch (error) {
      logError('Controller processJob error', { error })
      next(error)
    }
  }

  /**
   * Cancel job
   * POST /api/v1/jobs/:id/cancel
   */
  async cancelJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return next(new Error('Company context required'))
      }

      // Verify job belongs to user and company
      const existingJob = await jobsService.getJobById(id, userId)
      if (existingJob.company_id !== companyId) {
        return next(new Error('Access denied to this job'))
      }

      const job = await jobsService.cancelJob(id, userId)

      sendSuccess(res, job, 'Job cancelled successfully')
    } catch (error) {
      logError('Controller cancelJob error', { error })
      next(error)
    }
  }
}

export const jobsController = new JobsController()
