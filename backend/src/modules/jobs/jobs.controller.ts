import { Response, NextFunction } from 'express'
import { AuthRequest } from '@/types/common.types'
import { jobsService } from './jobs.service'
import { jobsRepository } from './jobs.repository'
import { sendSuccess, sendError } from '@/utils/response.util'
import { logInfo, logError } from '@/config/logger'
import { JobType, JobModule } from './jobs.types'

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
   * Create a new job
   * POST /api/v1/jobs
   * 
   * Body: {
   *   type: 'export' | 'import',
   *   module: JobModule,
   *   name: string,
   *   metadata?: Record<string, unknown>
   * }
   */
  async createJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return next(new Error('Company context required'))
      }

      const { type, module, name, metadata } = req.body

      // Validate required fields
      if (!type || !module || !name) {
        return sendError(res, 'Missing required fields: type, module, name', 400)
      }

      // Validate job type
      if (type !== 'export' && type !== 'import') {
        return sendError(res, 'Invalid job type. Must be "export" or "import"', 400)
      }

      // Validate module
      const validModules: JobModule[] = [
        'employees', 'companies', 'products', 'pos_transactions',
        'fiscal_periods', 'chart_of_accounts', 'accounting_purposes',
        'accounting_purpose_accounts', 'payment_methods', 'categories', 'sub_categories'
      ]
      if (!validModules.includes(module)) {
        return sendError(res, `Invalid module. Must be one of: ${validModules.join(', ')}`, 400)
      }

      // Check if user already has an active job
      const hasActiveJob = await jobsRepository.hasActiveJob(userId)
      if (hasActiveJob) {
        return sendError(res, 'You already have an active job. Please wait for it to complete.', 429)
      }

      // Create the job
      const job = await jobsService.createJob({
        user_id: userId,
        company_id: companyId,
        type,
        module,
        name,
        metadata: metadata || {}
      })

      logInfo('Controller createJob success', { 
        job_id: job.id, 
        type, 
        module, 
        user_id: userId 
      })

      sendSuccess(res, {
        job_id: job.id,
        status: job.status,
        name: job.name,
        type: job.type,
        module: job.module,
        created_at: job.created_at
      }, 'Job created successfully', 201)
    } catch (error) {
      logError('Controller createJob error', { error })
      next(error)
    }
  }

  /**
   * Upload file for import job and trigger processing
   * POST /api/v1/jobs/:id/upload
   */
  async uploadJobFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return next(new Error('Company context required'))
      }

      if (!req.file) {
        return sendError(res, 'No file uploaded', 400)
      }

      // Verify job belongs to user and company
      const existingJob = await jobsService.getJobById(id, userId)
      if (existingJob.company_id !== companyId) {
        return next(new Error('Access denied to this job'))
      }

      // Check job status
      if (existingJob.status !== 'pending') {
        return sendError(res, `Cannot upload file. Job status is "${existingJob.status}"`, 400)
      }

      // Check file type
      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
      ]
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return sendError(res, 'Invalid file type. Only Excel files (.xlsx, .xls) are allowed', 400)
      }

      // Check file size (10MB limit for import files)
      const maxSize = 10 * 1024 * 1024
      if (req.file.size > maxSize) {
        return sendError(res, `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`, 400)
      }

      // Save file to temp location and get path
      const { saveTempFile } = await import('./jobs.util')
      const filePath = await saveTempFile(req.file.buffer, `${id}_${Date.now()}.xlsx`)
      const fileName = req.file.originalname

      // Update job metadata with file info and trigger processing
      const metadata = {
        ...existingJob.metadata,
        filePath,
        fileName,
        originalFileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size
      }

      await jobsRepository.update(id, userId, { metadata })

      // Trigger background processing (don't await)
      const { jobWorker } = await import('./jobs.worker')
      jobWorker.processJob(id).catch(error => {
        logError('Background job processing error', { job_id: id, error })
      })

      logInfo('Controller uploadJobFile success', { 
        job_id: id, 
        file_name: fileName, 
        file_size: req.file.size,
        user_id: userId 
      })

      sendSuccess(res, {
        job_id: id,
        status: 'processing',
        file_name: fileName,
        file_size: req.file.size,
        message: 'File uploaded successfully. Processing started in background.'
      }, 'File uploaded and processing started')
    } catch (error) {
      logError('Controller uploadJobFile error', { error })
      next(error)
    }
  }

  /**
   * Trigger export job processing
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

      // Check job status
      if (job.status !== 'pending') {
        return sendError(res, `Cannot process job. Current status is "${job.status}"`, 400)
      }

      // Process job in background (don't await)
      const { jobWorker } = await import('./jobs.worker')
      jobWorker.processJob(id).catch(error => {
        logError('Background job processing error', { job_id: id, error })
      })

      sendSuccess(res, {
        job_id: id,
        status: 'processing',
        message: 'Job processing started in background'
      }, 'Processing started')
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

  /**
   * Get available modules for a job type
   * GET /api/v1/jobs/modules?type=export|import
   */
  async getAvailableModules(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.query

      if (!type || (type !== 'export' && type !== 'import')) {
        return sendError(res, 'Query param "type" is required and must be "export" or "import"', 400)
      }

      const { getAvailableModules } = await import('./processors')
      const modules = getAvailableModules(type as JobType)

      sendSuccess(res, { type, modules }, 'Available modules retrieved')
    } catch (error) {
      logError('Controller getAvailableModules error', { error })
      next(error)
    }
  }
}

export const jobsController = new JobsController()

