import { Response } from 'express'
import { companiesService } from './companies.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo, logError } from '../../config/logger'
import { getPaginationParams } from '../../utils/pagination.util'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../utils/export.util'

import { getParamString } from '../../utils/validation.util'
import { createCompanySchema, updateCompanySchema, bulkUpdateStatusSchema, bulkDeleteSchema } from './companies.schema'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'
import type { AuthRequest } from '../../types/common.types'
import { jobsService, jobsRepository } from '../jobs'

export class CompaniesController {
  // ============================================
  // LIST & SEARCH
  // ============================================

  async list(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const { offset } = getPaginationParams(req.query)
      const result = await companiesService.list({ ...req.pagination, offset }, req.sort, req.filterParams)
      sendSuccess(res, result.data, 'Companies retrieved', 200, result.pagination)
    } catch (error) {
      handleError(res, error)
    }
  }

  async search(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const { q } = req.query
      const { offset } = getPaginationParams(req.query)
      const result = await companiesService.search(q as string, { ...req.pagination, offset }, req.sort, req.filterParams)
      sendSuccess(res, result.data, 'Companies retrieved', 200, result.pagination)
    } catch (error) {
      handleError(res, error)
    }
  }

  async create(req: ValidatedAuthRequest<typeof createCompanySchema>, res: Response) {
    try {
      const company = await companiesService.create(req.validated.body, req.user!.id)
      logInfo('Company created', {
        company_id: company.id,
        company_code: company.company_code,
        user: req.user!.id
      })
      sendSuccess(res, company, 'Company created', 201)
    } catch (error) {
      handleError(res, error)
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const company = await companiesService.getById(getParamString(req.params.id))
      sendSuccess(res, company)
    } catch (error) {
      handleError(res, error)
    }
  }

  async update(req: ValidatedAuthRequest<typeof updateCompanySchema>, res: Response) {
    try {
      const { body, params } = req.validated
      const company = await companiesService.update(params.id, body, req.user!.id)
      logInfo('Company updated', {
        company_id: params.id,
        user: req.user!.id
      })
      sendSuccess(res, company, 'Company updated')
    } catch (error) {
      handleError(res, error)
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      await companiesService.delete(getParamString(req.params.id), req.user.id)
      logInfo('Company deleted', {
        company_id: getParamString(req.params.id),
        user: req.user.id
      })
      sendSuccess(res, null, 'Company deleted')
    } catch (error) {
      handleError(res, error)
    }
  }

  async getFilterOptions(req: AuthenticatedRequest, res: Response) {
    try {
      const options = await companiesService.getFilterOptions()
      sendSuccess(res, options)
    } catch (error) {
      handleError(res, error)
    }
  }

  // ============================================
  // EXPORT (LEGACY)
  // ============================================

  async generateExportToken(req: AuthenticatedRequest, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: AuthenticatedRequest, res: Response) {
    return handleExport(req, res, (filter) => companiesService.exportToExcel(filter), 'companies')
  }

  // ============================================
  // EXPORT (JOB-BASED - NEW)
  // ============================================

  /**
   * Create export job for companies
   * POST /api/v1/companies/export/job
   */
  async createExportJob(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return sendError(res, 'Company context required', 400)
      }

      // Check for existing active job
      const hasActiveJob = await jobsRepository.hasActiveJob(userId)
      if (hasActiveJob) {
        return sendError(res, 'You already have an active job. Please wait for it to complete.', 429)
      }

      // Extract filter from query params with type checking
      const filter: Record<string, unknown> = {}
      if (typeof req.query.search === 'string') filter.search = req.query.search
      if (typeof req.query.status === 'string') filter.status = req.query.status

      // Create the export job
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

      // Trigger background processing
      const { jobWorker } = await import('../jobs/jobs.worker')
      jobWorker.processJob(job.id).catch(error => {
        logError('Companies export job processing error', { job_id: job.id, error })
      })

      sendSuccess(res, {
        job_id: job.id,
        status: job.status,
        name: job.name,
        type: job.type,
        module: job.module,
        created_at: job.created_at,
        message: 'Export job created successfully. Processing in background.'
      }, 'Export job created', 201)
    } catch (error: any) {
      logError('Failed to create export job', { error: error.message })
      handleError(res, error)
    }
  }

  // ============================================
  // IMPORT (LEGACY)
  // ============================================

  async previewImport(req: AuthenticatedRequest, res: Response) {
    return handleImportPreview(req, res, (buffer) => companiesService.previewImport(buffer))
  }

  async importData(req: AuthenticatedRequest, res: Response) {
    return handleImport(req, res, (buffer, skip) => companiesService.importFromExcel(buffer, skip))
  }

  // ============================================
  // IMPORT (JOB-BASED - NEW)
  // ============================================

  /**
   * Create import job for companies
   * POST /api/v1/companies/import/job
   */
  async createImportJob(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id

      if (!companyId) {
        return sendError(res, 'Company context required', 400)
      }

      // Use multer to parse multipart/form-data
      const file = (req as any).file
      if (!file) {
        return sendError(res, 'No file uploaded', 400)
      }

      // Check file type
      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
      ]
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return sendError(res, 'Invalid file type. Only Excel files (.xlsx, .xls) are allowed', 400)
      }

      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        return sendError(res, `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`, 400)
      }

      // Check for existing active job
      const hasActiveJob = await jobsRepository.hasActiveJob(userId)
      if (hasActiveJob) {
        return sendError(res, 'You already have an active job. Please wait for it to complete.', 429)
      }

      // Save file to temp location
      const { saveTempFile } = await import('../jobs/jobs.util')
      const filePath = await saveTempFile(file.buffer, `companies_import_${Date.now()}.xlsx`)

      // Parse skipDuplicates from body
      const skipDuplicates = req.body.skipDuplicates === 'true' || req.body.skipDuplicates === true

      // Create the import job
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

      logInfo('Companies import job created', { 
        job_id: job.id, 
        file_name: file.originalname,
        file_size: file.size,
        user_id: userId 
      })

      // Trigger background processing
      const { jobWorker } = await import('../jobs/jobs.worker')
      jobWorker.processJob(job.id).catch(error => {
        logError('Companies import job processing error', { job_id: job.id, error })
      })

      sendSuccess(res, {
        job_id: job.id,
        status: job.status,
        name: job.name,
        type: job.type,
        module: job.module,
        created_at: job.created_at,
        file_name: file.originalname,
        file_size: file.size,
        message: 'Import job created successfully. Processing in background.'
      }, 'Import job created', 201)
    } catch (error: any) {
      logError('Failed to create import job', { error: error.message })
      handleError(res, error)
    }
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkUpdateStatus(req: ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res: Response) {
    try {
      const { ids, status } = req.validated.body
      await companiesService.bulkUpdateStatus(ids, status, req.user!.id)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error) {
      handleError(res, error)
    }
  }

  async bulkDelete(req: ValidatedAuthRequest<typeof bulkDeleteSchema>, res: Response) {
    try {
      const { ids } = req.validated.body
      await companiesService.bulkDelete(ids, req.user!.id)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const companiesController = new CompaniesController()

