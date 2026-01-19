import { Response, NextFunction } from 'express'
import { AuthRequest } from '@/types/common.types'
import { jobsService } from './jobs.service'
import { sendSuccess, sendError } from '@/utils/response.util'
import { logInfo, logError } from '@/config/logger'
import { JobType, JobModule } from './jobs.types'

export class JobsController {
  // -----------------------------
  // Helper: Validate company context
  // -----------------------------
  private getCompanyId(req: AuthRequest): string {
    const companyId = req.context?.company_id
    if (!companyId) throw new Error('Company context required')
    return companyId
  }

  // -----------------------------
  // Helper: Validate module
  // -----------------------------
  private validateModule(module: unknown): asserts module is JobModule {
    const validModules: JobModule[] = [
      'employees', 'companies', 'products', 'pos_transactions',
      'fiscal_periods', 'chart_of_accounts', 'accounting_purposes',
      'accounting_purpose_accounts', 'payment_methods', 'categories', 'sub_categories'
    ]
    if (!validModules.includes(module as JobModule)) {
      throw new Error(`Invalid module. Must be one of: ${validModules.join(', ')}`)
    }
  }

  // -----------------------------
  // GET /api/v1/jobs/recent
  // -----------------------------
  async getRecentJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id
      const companyId = this.getCompanyId(req)

      const jobs = await jobsService.getUserRecentJobs(userId)
      const filteredJobs = jobs.filter(job => job.company_id === companyId)

      sendSuccess(res, filteredJobs, 'Recent jobs retrieved successfully')
    } catch (error) {
      logError('Controller getRecentJobs error', { error })
      next(error)
    }
  }

  // -----------------------------
  // GET /api/v1/jobs/:id
  // -----------------------------
  async getJobById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.id
      const companyId = this.getCompanyId(req)

      const job = await jobsService.getJobById(id, userId)
      if (job.company_id !== companyId) throw new Error('Access denied to this job')

      sendSuccess(res, job, 'Job retrieved successfully')
    } catch (error) {
      logError('Controller getJobById error', { error })
      next(error)
    }
  }

  // -----------------------------
  // POST /api/v1/jobs
  // -----------------------------
  async createJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id
      const companyId = this.getCompanyId(req)
      const { type, module, name, metadata } = req.body

      if (!type || !module || !name) return sendError(res, 'Missing required fields: type, module, name', 400)
      if (type !== 'export' && type !== 'import') return sendError(res, 'Invalid job type', 400)
      this.validateModule(module)

      const job = await jobsService.createJob({
        user_id: userId,
        company_id: companyId,
        type,
        module,
        name,
        metadata
      })

      logInfo('Controller createJob success', { job_id: job.id, type, module, user_id: userId })
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

  // -----------------------------
  // POST /api/v1/jobs/:id/upload
  // -----------------------------
  async uploadJobFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.id
      const companyId = this.getCompanyId(req)

      if (!req.file) return sendError(res, 'No file uploaded', 400)
      const uploadedFile = req.file

      const job = await jobsService.getJobById(id, userId)
      if (job.company_id !== companyId) throw new Error('Access denied to this job')
      if (job.status !== 'pending') return sendError(res, `Cannot upload file. Job status is "${job.status}"`, 400)

      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
      ]
      if (!allowedMimeTypes.includes(uploadedFile.mimetype)) return sendError(res, 'Invalid file type. Only Excel files allowed', 400)

      const maxSize = 10 * 1024 * 1024
      if (uploadedFile.size > maxSize) return sendError(res, `File size exceeds maximum ${maxSize / (1024 * 1024)}MB`, 400)

      const { saveTempFile } = await import('./jobs.util')
      const tempFilePath = await saveTempFile(uploadedFile.buffer, `${id}_${Date.now()}.xlsx`)

      const completedJob = await jobsService.completeJob(id, userId, tempFilePath, uploadedFile.originalname)

      logInfo('Controller uploadJobFile success', { job_id: id, file_name: uploadedFile.originalname, user_id: userId })
      sendSuccess(res, {
        job_id: completedJob.id,
        status: completedJob.status,
        file_name: uploadedFile.originalname,
        file_size: uploadedFile.size,
        message: 'File uploaded successfully. Processing started in background.'
      })
    } catch (error) {
      logError('Controller uploadJobFile error', { error })
      next(error)
    }
  }

  // -----------------------------
  // POST /api/v1/jobs/:id/cancel
  // -----------------------------
  async cancelJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.id
      const companyId = this.getCompanyId(req)

      const job = await jobsService.cancelJob(id, userId)
      if (job.company_id !== companyId) throw new Error('Access denied to this job')

      sendSuccess(res, job, 'Job cancelled successfully')
    } catch (error) {
      logError('Controller cancelJob error', { error })
      next(error)
    }
  }

  // -----------------------------
  // GET /api/v1/jobs/modules?type=export|import
  // -----------------------------
  async getAvailableModules(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.query
      if (!type || (type !== 'export' && type !== 'import')) return sendError(res, 'Query param "type" is required', 400)

      const modules = await import('./processors').then(mod => mod.getAvailableModules(type as JobType))
      sendSuccess(res, { type, modules }, 'Available modules retrieved')
    } catch (error) {
      logError('Controller getAvailableModules error', { error })
      next(error)
    }
  }

  // -----------------------------
  // POST /api/v1/jobs/clear-all
  // -----------------------------
  async clearAllJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id
      const companyId = this.getCompanyId(req)

      const deletedCount = await jobsService.clearAllJobs(userId, companyId)
      sendSuccess(res, { deleted: deletedCount }, 'Jobs cleared successfully')
    } catch (error) {
      logError('Controller clearAllJobs error', { error })
      next(error)
    }
  }
}

export const jobsController = new JobsController()
