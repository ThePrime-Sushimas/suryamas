import { Response } from 'express'
import { companiesService } from './companies.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logInfo, logError } from '../../config/logger'
import { getPaginationParams } from '../../utils/pagination.util'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../utils/export.util'
import { handleBulkUpdate, handleBulkDelete } from '../../utils/bulk.util'
import { CompanyError } from './companies.errors'
import { createCompanySchema, updateCompanySchema, bulkStatusSchema, bulkDeleteSchema } from './companies.schema'
import { ZodError } from 'zod'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

export class CompaniesController {
  async list(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const { offset } = getPaginationParams(req.query)
      const result = await companiesService.list({ ...req.pagination, offset }, req.sort, req.filterParams)
      sendSuccess(res, result.data, 'Companies retrieved', 200, result.pagination)
    } catch (error) {
      logError('Failed to list companies', {
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 500)
    }
  }

  async search(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const { q } = req.query
      const { offset } = getPaginationParams(req.query)
      const result = await companiesService.search(q as string, { ...req.pagination, offset }, req.sort, req.filterParams)
      sendSuccess(res, result.data, 'Companies retrieved', 200, result.pagination)
    } catch (error) {
      logError('Failed to search companies', {
        error: (error as Error).message,
        query: req.query.q,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 500)
    }
  }

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const validated = createCompanySchema.parse(req.body)
      const company = await companiesService.create(validated, req.user.id)
      logInfo('Company created', {
        company_id: company.id,
        company_code: company.company_code,
        user: req.user.id
      })
      sendSuccess(res, company, 'Company created', 201)
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
        logError('Validation error creating company', { errors, user: req.user?.id })
        return sendError(res, errors, 400)
      }
      if (error instanceof CompanyError) {
        logError('Failed to create company', { code: error.code, user: req.user?.id })
        return sendError(res, error.message, error.statusCode)
      }
      logError('Unexpected error creating company', {
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, 'Internal server error', 500)
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const company = await companiesService.getById(req.params.id)
      sendSuccess(res, company)
    } catch (error) {
      if (error instanceof CompanyError) {
        logError('Failed to get company', { code: error.code, id: req.params.id })
        return sendError(res, error.message, error.statusCode)
      }
      logError('Failed to get company', {
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 500)
    }
  }

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const validated = updateCompanySchema.parse(req.body)
      const company = await companiesService.update(req.params.id, validated, req.user.id)
      logInfo('Company updated', {
        company_id: req.params.id,
        user: req.user.id
      })
      sendSuccess(res, company, 'Company updated')
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
        logError('Validation error updating company', { errors, user: req.user?.id })
        return sendError(res, errors, 400)
      }
      if (error instanceof CompanyError) {
        logError('Failed to update company', { code: error.code, id: req.params.id })
        return sendError(res, error.message, error.statusCode)
      }
      logError('Unexpected error updating company', {
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, 'Internal server error', 500)
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      await companiesService.delete(req.params.id, req.user.id)
      logInfo('Company deleted', {
        company_id: req.params.id,
        user: req.user.id
      })
      sendSuccess(res, null, 'Company deleted')
    } catch (error) {
      if (error instanceof CompanyError) {
        logError('Failed to delete company', { code: error.code, id: req.params.id })
        return sendError(res, error.message, error.statusCode)
      }
      logError('Unexpected error deleting company', {
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, 'Internal server error', 500)
    }
  }

  async getFilterOptions(req: AuthenticatedRequest, res: Response) {
    try {
      const options = await companiesService.getFilterOptions()
      sendSuccess(res, options)
    } catch (error) {
      logError('Failed to get filter options', {
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 500)
    }
  }

  async generateExportToken(req: AuthenticatedRequest, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: AuthenticatedRequest, res: Response) {
    return handleExport(req, res, (filter) => companiesService.exportToExcel(filter), 'companies')
  }

  async previewImport(req: AuthenticatedRequest, res: Response) {
    return handleImportPreview(req, res, (buffer) => companiesService.previewImport(buffer))
  }

  async importData(req: AuthenticatedRequest, res: Response) {
    return handleImport(req, res, (buffer, skip) => companiesService.importFromExcel(buffer, skip))
  }

  async bulkUpdateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const validated = bulkStatusSchema.parse(req.body)
      await companiesService.bulkUpdateStatus(validated.ids, validated.status, req.user.id)
      sendSuccess(res, null, 'Bulk status update completed')
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
        return sendError(res, errors, 400)
      }
      if (error instanceof CompanyError) {
        return sendError(res, error.message, error.statusCode)
      }
      sendError(res, (error as Error).message, 500)
    }
  }

  async bulkDelete(req: AuthenticatedRequest, res: Response) {
    try {
      const validated = bulkDeleteSchema.parse(req.body)
      await companiesService.bulkDelete(validated.ids, req.user.id)
      sendSuccess(res, null, 'Bulk delete completed')
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
        return sendError(res, errors, 400)
      }
      if (error instanceof CompanyError) {
        return sendError(res, error.message, error.statusCode)
      }
      sendError(res, (error as Error).message, 500)
    }
  }
}

export const companiesController = new CompaniesController()
