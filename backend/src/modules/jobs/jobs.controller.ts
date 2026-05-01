import { Request, Response } from 'express'
import { handleError } from '../../utils/error-handler.util'
import { jobsService } from './jobs.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { getJobByIdSchema, cancelJobSchema, createJobFullSchema } from './jobs.schema'

type GetJobReq = ValidatedAuthRequest<typeof getJobByIdSchema>
type CancelJobReq = ValidatedAuthRequest<typeof cancelJobSchema>
type CreateJobReq = ValidatedAuthRequest<typeof createJobFullSchema>

function getCompanyId(req: Request): string {
  const companyId = req.context?.company_id
  if (!companyId) throw new Error('Company context required')
  return companyId
}

export class JobsController {
  getRecentJobs = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const jobs = await jobsService.getUserRecentJobs(req.user?.id ?? '')
      sendSuccess(res, jobs.filter(job => job.company_id === companyId), 'Recent jobs retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_recent_jobs', company_id: req.context?.company_id })
    }
  }

  getJobById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as GetJobReq).validated.params
      const companyId = getCompanyId(req)
      const job = await jobsService.getJobById(id, req.user?.id ?? '')
      if (job.company_id !== companyId) throw new Error('Access denied to this job')

      res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      res.set('Pragma', 'no-cache')
      sendSuccess(res, job, 'Job retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_job', id: req.params.id })
    }
  }

  createJob = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const { type, module: mod, name, metadata } = (req as CreateJobReq).validated.body

      const job = await jobsService.createJob({
        user_id: req.user?.id ?? '',
        company_id: companyId,
        type, module: mod, name, metadata: metadata as unknown as import('./jobs.types').JobMetadata,
      })

      sendSuccess(res, {
        job_id: job.id, status: job.status, name: job.name,
        type: job.type, module: job.module, created_at: job.created_at,
      }, 'Job created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_job', company_id: req.context?.company_id })
    }
  }

  uploadJobFile = async (req: Request, res: Response) => {
    try {
      const { id } = (req as GetJobReq).validated.params
      const companyId = getCompanyId(req)
      const userId = req.user?.id ?? ''

      if (!req.file) return sendError(res, 'No file uploaded', 400)

      const job = await jobsService.getJobById(id, userId)
      if (job.company_id !== companyId) throw new Error('Access denied to this job')
      if (job.status !== 'pending') return sendError(res, `Cannot upload file. Job status is "${job.status}"`, 400)

      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream',
      ]
      if (!allowedMimeTypes.includes(req.file.mimetype)) return sendError(res, 'Invalid file type. Only Excel files allowed', 400)

      const maxSize = 10 * 1024 * 1024
      if (req.file.size > maxSize) return sendError(res, `File size exceeds maximum ${maxSize / (1024 * 1024)}MB`, 400)

      const { saveTempFile } = await import('./jobs.util')
      const tempFilePath = await saveTempFile(req.file.buffer, `${id}_${Date.now()}.xlsx`)
      const completedJob = await jobsService.completeJob(id, userId, tempFilePath, req.file.originalname)

      sendSuccess(res, {
        job_id: completedJob.id, status: completedJob.status,
        file_name: req.file.originalname, file_size: req.file.size,
        message: 'File uploaded successfully. Processing started in background.',
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upload_job_file', id: req.params.id })
    }
  }

  cancelJob = async (req: Request, res: Response) => {
    try {
      const { id } = (req as CancelJobReq).validated.params
      const companyId = getCompanyId(req)

      // Check access before cancel
      const existing = await jobsService.getJobById(id, req.user?.id ?? '')
      if (existing.company_id !== companyId) throw new Error('Access denied to this job')

      const job = await jobsService.cancelJob(id, req.user?.id ?? '')
      sendSuccess(res, job, 'Job cancelled successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'cancel_job', id: req.params.id })
    }
  }

  getAvailableModules = async (req: Request, res: Response) => {
    try {
      const { type } = req.query
      if (!type || (type !== 'export' && type !== 'import')) return sendError(res, 'Query param "type" is required', 400)

      const modules = await import('./processors').then(mod => mod.getAvailableModules(type as 'export' | 'import'))
      sendSuccess(res, { type, modules }, 'Available modules retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_available_modules' })
    }
  }

  clearAllJobs = async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req)
      const deletedCount = await jobsService.clearAllJobs(req.user?.id ?? '', companyId)
      sendSuccess(res, { deleted: deletedCount }, 'Jobs cleared successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'clear_all_jobs', company_id: req.context?.company_id })
    }
  }
}

export const jobsController = new JobsController()
