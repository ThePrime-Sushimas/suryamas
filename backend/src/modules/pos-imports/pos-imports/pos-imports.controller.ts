/**
 * POS Imports Controller - COMPLETE VERSION
 * All endpoints implemented
 */

import { Response } from 'express'
import { posImportsService } from './pos-imports.service'
import { posImportLinesRepository } from '../pos-import-lines/pos-import-lines.repository'
import { sendSuccess, sendError } from '../../../utils/response.util'
import { logError } from '../../../config/logger'
import type { AuthenticatedRequest, AuthenticatedQueryRequest } from '../../../types/request.types'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { UploadPosFileInput, ConfirmImportInput, UpdateStatusInput } from './pos-imports.schema'

class PosImportsController {
  /**
   * List POS imports
   * GET /api/v1/pos-imports
   */
  async list(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const company_id = (req as any).context?.company_id
      if (!company_id) {
        throw new Error('Branch context required')
      }
      const { pagination, sort, filter } = req.query

      // Provide default pagination if not present
      const paginationParams = pagination || { page: 1, limit: 10 }

      const result = await posImportsService.list(company_id, paginationParams as any, sort as any, filter as any)

      return sendSuccess(res, result.data, 'POS imports retrieved', 200, {
        page: (paginationParams as any).page,
        limit: (paginationParams as any).limit,
        total: result.total
      })
    } catch (error) {
      console.error('PosImportsController list error:', error)
      logError('PosImportsController list error', { error })
      return sendError(res, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Get POS import by ID
   * GET /api/v1/pos-imports/:id
   */
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      const company_id = (req as any).context?.company_id
      if (!company_id) {
        throw new Error('Branch context required')
      }

      const posImport = await posImportsService.getById(id, company_id)

      return sendSuccess(res, posImport)
    } catch (error) {
      logError('PosImportsController getById error', { error })
      return sendError(res, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Get POS import lines with pagination
   * GET /api/v1/pos-imports/:id/lines
   */
  async getLines(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const { id } = req.params
      const company_id = (req as any).context?.company_id
      if (!company_id) {
        throw new Error('Branch context required')
      }

      // Verify import exists and belongs to company
      await posImportsService.getById(id, company_id)

      const { pagination } = req.query
      const page = (pagination as any)?.page || 1
      const limit = (pagination as any)?.limit || 50

      const result = await posImportLinesRepository.findByImportId(id, page, limit)

      return sendSuccess(res, result.data, 'Lines retrieved', 200, {
        page,
        limit,
        total: result.total
      })
    } catch (error) {
      logError('PosImportsController getLines error', { error })
      return sendError(res, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Export POS import to Excel
   * GET /api/v1/pos-imports/:id/export
   */
  async export(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      const company_id = (req as any).context?.company_id
      if (!company_id) {
        throw new Error('Branch context required')
      }

      const buffer = await posImportsService.exportToExcel(id, company_id)
      const posImport = await posImportsService.getById(id, company_id)

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${posImport.file_name.replace(/\.[^/.]+$/, '')}_export.xlsx"`)
      return res.send(buffer)
    } catch (error) {
      logError('PosImportsController export error', { error })
      return sendError(res, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Get financial summary for import
   * GET /api/v1/pos-imports/:id/summary
   */
  async getSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      const company_id = (req as any).context?.company_id
      if (!company_id) {
        throw new Error('Branch context required')
      }

      await posImportsService.getById(id, company_id)
      const summary = await posImportLinesRepository.getSummaryByImportId(id)

      return sendSuccess(res, summary, 'Summary retrieved')
    } catch (error) {
      logError('PosImportsController getSummary error', { error })
      return sendError(res, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Upload and analyze POS Excel file
   * POST /api/v1/pos-imports/upload
   * NOW: Returns job_id in response for frontend tracking
   */
  async upload(req: any, res: Response) {
    try {
      const { branch_id } = req.body
      const company_id = (req as any).context?.company_id
      if (!company_id) {
        throw new Error('Branch context required')
      }
      const userId = req.user?.id
      if (!userId) {
        throw new Error('User ID required')
      }

      if (!req.file) {
        return sendError(res, 'No file uploaded', 400)
      }

      // Validate file type
      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ]
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return sendError(res, 'Invalid file type. Please upload Excel file (.xlsx or .xls)', 400)
      }

      const result = await posImportsService.analyzeFile(req.file, branch_id, company_id, userId)

      return sendSuccess(res, {
        import: result.import,
        analysis: result.analysis,
        job_id: result.job_id  // Added for jobs system integration
      }, 'File analyzed successfully')
    } catch (error) {
      logError('PosImportsController upload error', { error })
      return sendError(res, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Confirm import after duplicate analysis
   * POST /api/v1/pos-imports/:id/confirm
   * NOW: Passes job_id for jobs system tracking
   */
  async confirm(req: any, res: Response) {
    try {
      const { id } = req.params
      const { skip_duplicates } = req.body
      const company_id = (req as any).context?.company_id
      if (!company_id) {
        throw new Error('Branch context required')
      }
      const userId = req.user?.id
      if (!userId) {
        throw new Error('User ID required')
      }

      // Get job_id from request body (returned from upload response)
      const { job_id } = req.body

      const posImport = await posImportsService.confirmImport(id, company_id, skip_duplicates, userId, job_id)

      return sendSuccess(res, posImport, 'Import confirmed successfully')
    } catch (error) {
      logError('PosImportsController confirm error', { error })
      return sendError(res, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Update import status
   * PUT /api/v1/pos-imports/:id/status
   */
  async updateStatus(req: any, res: Response) {
    try {
      const { id } = req.params
      const { status, error_message } = req.body
      const company_id = (req as any).context?.company_id
      if (!company_id) {
        throw new Error('Branch context required')
      }
      const userId = req.user?.id
      if (!userId) {
        throw new Error('User ID required')
      }

      const posImport = await posImportsService.updateStatus(id, company_id, status, error_message, userId)

      return sendSuccess(res, posImport, 'Status updated successfully')
    } catch (error) {
      logError('PosImportsController updateStatus error', { error })
      return sendError(res, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Delete POS import
   * DELETE /api/v1/pos-imports/:id
   */
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      const company_id = (req as any).context?.company_id
      if (!company_id) {
        throw new Error('Branch context required')
      }
      const userId = req.user?.id
      if (!userId) {
        throw new Error('User ID required')
      }

      await posImportsService.delete(id, company_id, userId)

      return sendSuccess(res, null, 'Import deleted successfully')
    } catch (error) {
      logError('PosImportsController delete error', { error })
      return sendError(res, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Restore deleted POS import
   * POST /api/v1/pos-imports/:id/restore
   */
  async restore(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      const company_id = (req as any).context?.company_id
      if (!company_id) {
        throw new Error('Branch context required')
      }
      const userId = req.user?.id
      if (!userId) {
        throw new Error('User ID required')
      }

      const posImport = await posImportsService.restore(id, company_id, userId)

      return sendSuccess(res, posImport, 'Import restored successfully')
    } catch (error) {
      logError('PosImportsController restore error', { error })
      return sendError(res, error instanceof Error ? error.message : 'Unknown error')
    }
  }
}

export const posImportsController = new PosImportsController()
