import { Response } from 'express'
import { companiesService } from './companies.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'
import { getPaginationParams } from '../../utils/pagination.util'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../utils/export.util'
import { createCompanySchema, updateCompanySchema, bulkUpdateStatusSchema, bulkDeleteSchema } from './companies.schema'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

export class CompaniesController {
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
      const company = await companiesService.getById(req.params.id)
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
      await companiesService.delete(req.params.id, req.user.id)
      logInfo('Company deleted', {
        company_id: req.params.id,
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
