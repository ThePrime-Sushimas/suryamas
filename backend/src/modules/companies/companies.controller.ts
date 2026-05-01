import { Request, Response } from 'express'
import { companiesService } from './companies.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo, logError } from '../../config/logger'
import { getPaginationParams } from '../../utils/pagination.util'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../utils/export.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { createCompanySchema, updateCompanySchema, bulkUpdateStatusSchema, bulkDeleteSchema, companyIdSchema } from './companies.schema'
import { jobsService, jobsRepository } from '../jobs'

export class CompaniesController {
  async list(req: Request, res: Response) {
    try {
      const { offset } = getPaginationParams(req.query)
      const pagination = req.pagination ?? { page: 1, limit: 50 }
      const result = await companiesService.list({ ...pagination, offset }, req.sort, req.filterParams)
      sendSuccess(res, result.data, 'Companies retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list' })
    }
  }

  async search(req: Request, res: Response) {
    try {
      const q = req.query.q as string
      const { offset } = getPaginationParams(req.query)
      const pagination = req.pagination ?? { page: 1, limit: 50 }
      const result = await companiesService.search(q, { ...pagination, offset }, req.sort, req.filterParams)
      sendSuccess(res, result.data, 'Companies retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search', query: req.query.q })
    }
  }

  async create(req: ValidatedAuthRequest<typeof createCompanySchema>, res: Response) {
    try {
      const company = await companiesService.create(req.validated.body, req.user!.id)
      logInfo('Company created', { company_id: company.id, company_code: company.company_code, user: req.user!.id })
      sendSuccess(res, company, 'Company created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create' })
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = (req as ValidatedAuthRequest<typeof companyIdSchema>).validated.params
      const company = await companiesService.getById(id)
      sendSuccess(res, company)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'getById', id: req.params.id })
    }
  }

  async update(req: ValidatedAuthRequest<typeof updateCompanySchema>, res: Response) {
    try {
      const { body, params } = req.validated
      const company = await companiesService.update(params.id, body, req.user!.id)
      logInfo('Company updated', { company_id: params.id, user: req.user!.id })
      sendSuccess(res, company, 'Company updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update', id: req.validated.params.id })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = (req as ValidatedAuthRequest<typeof companyIdSchema>).validated.params
      await companiesService.delete(id, req.user!.id)
      logInfo('Company deleted', { company_id: id, user: req.user!.id })
      sendSuccess(res, null, 'Company deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete', id: req.params.id })
    }
  }

  async getFilterOptions(req: Request, res: Response) {
    try {
      const options = await companiesService.getFilterOptions()
      sendSuccess(res, options)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'getFilterOptions' })
    }
  }

  async generateExportToken(req: Request, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: Request, res: Response) {
    return handleExport(req, res, (filter) => companiesService.exportToExcel(filter), 'companies')
  }

  async createExportJob(req: Request, res: Response) {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return sendError(res, 'Company context required', 400)
      }

      const hasActiveJob = await jobsRepository.hasActiveJob(userId)
      if (hasActiveJob) {
        return sendError(res, 'You already have an active job. Please wait for it to complete.', 429)
      }

      const filter: Record<string, unknown> = {}
      if (typeof req.query.search === 'string') filter.search = req.query.search
      if (typeof req.query.status === 'string') filter.status = req.query.status

      const job = await jobsService.createJob({
        user_id: userId,
        company_id: companyId,
        type: 'export',
        module: 'companies',
        name: `Export Companies - ${new Date().toISOString().slice(0, 10)}`,
        metadata: {
          type: 'export',
          module: 'companies',
          filter: Object.keys(filter).length > 0 ? filter : undefined
        }
      })

      logInfo('Companies export job created', { job_id: job.id, user_id: userId })

      const { jobWorker } = await import('../jobs/jobs.worker')
      jobWorker.processJob(job.id).catch(err => {
        logError('Companies export job processing error', { job_id: job.id, error: err })
      })

      sendSuccess(res, {
        job_id: job.id, status: job.status, name: job.name,
        type: job.type, module: job.module, created_at: job.created_at,
        message: 'Export job created successfully. Processing in background.'
      }, 'Export job created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'createExportJob' })
    }
  }

  async previewImport(req: Request, res: Response) {
    return handleImportPreview(req, res, (buffer) => companiesService.previewImport(buffer))
  }

  async importData(req: Request, res: Response) {
    return handleImport(req, res, (buffer, skip) => companiesService.importFromExcel(buffer, skip))
  }

  async createImportJob(req: Request, res: Response) {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return sendError(res, 'Company context required', 400)
      }

      const file = (req as Request & { file?: Express.Multer.File }).file
      if (!file) {
        return sendError(res, 'No file uploaded', 400)
      }

      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
      ]
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return sendError(res, 'Invalid file type. Only Excel files (.xlsx, .xls) are allowed', 400)
      }

      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        return sendError(res, `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`, 400)
      }

      const hasActiveJob = await jobsRepository.hasActiveJob(userId)
      if (hasActiveJob) {
        return sendError(res, 'You already have an active job. Please wait for it to complete.', 429)
      }

      const { saveTempFile } = await import('../jobs/jobs.util')
      const filePath = await saveTempFile(file.buffer, `companies_import_${Date.now()}.xlsx`)

      const skipDuplicates = req.body.skipDuplicates === 'true' || req.body.skipDuplicates === true

      const job = await jobsService.createJob({
        user_id: userId,
        company_id: companyId,
        type: 'import',
        module: 'companies',
        name: `Import Companies - ${file.originalname}`,
        metadata: {
          type: 'import',
          module: 'companies',
          filePath,
          fileName: file.originalname,
          fileSize: file.size,
          skipDuplicates,
          mimeType: file.mimetype
        }
      })

      logInfo('Companies import job created', { job_id: job.id, file_name: file.originalname, file_size: file.size, user_id: userId })

      const { jobWorker } = await import('../jobs/jobs.worker')
      jobWorker.processJob(job.id).catch(err => {
        logError('Companies import job processing error', { job_id: job.id, error: err })
      })

      sendSuccess(res, {
        job_id: job.id, status: job.status, name: job.name,
        type: job.type, module: job.module, created_at: job.created_at,
        file_name: file.originalname, file_size: file.size,
        message: 'Import job created successfully. Processing in background.'
      }, 'Import job created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'createImportJob' })
    }
  }

  async bulkUpdateStatus(req: ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res: Response) {
    try {
      const { ids, status } = req.validated.body
      await companiesService.bulkUpdateStatus(ids, status, req.user!.id)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulkUpdateStatus' })
    }
  }

  async bulkDelete(req: ValidatedAuthRequest<typeof bulkDeleteSchema>, res: Response) {
    try {
      const { ids } = req.validated.body
      await companiesService.bulkDelete(ids, req.user!.id)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulkDelete' })
    }
  }
}

export const companiesController = new CompaniesController()
