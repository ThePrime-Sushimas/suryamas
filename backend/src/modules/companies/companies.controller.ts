import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { companiesService } from './companies.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logInfo, logError } from '../../config/logger'
import { PaginatedRequest } from '../../middleware/pagination.middleware'
import { SortRequest } from '../../middleware/sort.middleware'
import { getPaginationParams } from '../../utils/pagination.util'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../utils/export.util'
import { handleBulkUpdate, handleBulkDelete } from '../../utils/bulk.util'

export class CompaniesController {
  async list(req: PaginatedRequest & SortRequest, res: Response) {
    try {
      const { offset } = getPaginationParams(req.query)
      const result = await companiesService.list({ ...req.pagination, offset }, req.sort)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      })
    } catch (error) {
      logError('Failed to list companies', {
        error: (error as Error).message,
        user: (req as AuthRequest).user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async search(req: PaginatedRequest & SortRequest, res: Response) {
    try {
      const { q } = req.query
      const { offset } = getPaginationParams(req.query)
      const result = await companiesService.search(q as string, { ...req.pagination, offset }, req.sort)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      })
    } catch (error) {
      logError('Failed to search companies', {
        error: (error as Error).message,
        query: req.query.q,
        user: (req as AuthRequest).user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async create(req: AuthRequest, res: Response) {
    try {
      const company = await companiesService.create(req.body, req.user?.id)
      logInfo('Company created', {
        company_code: company.company_code,
        user: req.user?.id
      })
      sendSuccess(res, company, 'Company created', 201)
    } catch (error) {
      logError('Failed to create company', {
        error: (error as Error).message,
        body: req.body,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const company = await companiesService.getById(req.params.id)
      sendSuccess(res, company)
    } catch (error) {
      logError('Failed to get company', {
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 404)
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const company = await companiesService.update(req.params.id, req.body, req.user?.id)
      logInfo('Company updated', {
        id: req.params.id,
        user: req.user?.id
      })
      sendSuccess(res, company, 'Company updated')
    } catch (error) {
      logError('Failed to update company', {
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      await companiesService.delete(req.params.id, req.user?.id)
      logInfo('Company deleted', {
        id: req.params.id,
        user: req.user?.id
      })
      sendSuccess(res, null, 'Company deleted')
    } catch (error) {
      logError('Failed to delete company', {
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async getFilterOptions(req: AuthRequest, res: Response) {
    try {
      const options = await companiesService.getFilterOptions()
      sendSuccess(res, options)
    } catch (error) {
      logError('Failed to get filter options', {
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async generateExportToken(req: AuthRequest, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: AuthRequest, res: Response) {
    return handleExport(req, res, (filter) => companiesService.exportToExcel(filter), 'companies')
  }

  async previewImport(req: AuthRequest, res: Response) {
    return handleImportPreview(req, res, (buffer) => companiesService.previewImport(buffer))
  }

  async importData(req: AuthRequest, res: Response) {
    return handleImport(req, res, (buffer, skip) => companiesService.importFromExcel(buffer, skip))
  }

  async bulkUpdateStatus(req: AuthRequest, res: Response) {
    return handleBulkUpdate(req, res, (ids, data) => companiesService.bulkUpdateStatus(ids, data.status, req.user?.id), 'update status')
  }

  async bulkDelete(req: AuthRequest, res: Response) {
    return handleBulkDelete(req, res, (ids) => companiesService.bulkDelete(ids, req.user?.id))
  }
}

export const companiesController = new CompaniesController()
