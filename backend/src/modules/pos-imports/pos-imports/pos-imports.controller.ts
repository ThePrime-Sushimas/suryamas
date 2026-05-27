import { Request, Response } from 'express'
import { posImportsService } from './pos-imports.service'
import { posImportLinesRepository } from '../pos-import-lines/pos-import-lines.repository'
import { sendSuccess, sendError } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { logError, logInfo } from '../../../config/logger'
import { jobsService } from '../../jobs/jobs.service'
import {
  getAccessibleBranchIds,
  getAccessibleCompanyIds,
  getCompanyIdForBranch,
  requireBranchAccess,
  requireCompanyAccess,
} from '../../../utils/branch-access.util'

function getUserId(req: Request): string {
  const id = req.user?.id
  if (!id) throw new Error('User ID required')
  return id
}

async function getAccess(req: Request) {
  const userId = req.user?.id ?? ''
  const [branchIds, companyIds] = await Promise.all([
    getAccessibleBranchIds(userId),
    getAccessibleCompanyIds(userId),
  ])
  return { userId, branchIds, companyIds }
}

class PosImportsController {
  list = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getAccess(req)
      const { pagination, sort, filter } = req.query
      const paginationParams = pagination || { page: 1, limit: 10 }
      const result = await posImportsService.list(companyIds, paginationParams as unknown as Parameters<typeof posImportsService.list>[1], sort as unknown as Parameters<typeof posImportsService.list>[2], filter as unknown as Parameters<typeof posImportsService.list>[3])
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      res.set('Pragma', 'no-cache')
      sendSuccess(res, result.data, 'POS imports retrieved', 200, {
        page: (paginationParams as Record<string, unknown>).page,
        limit: (paginationParams as Record<string, unknown>).limit,
        total: result.total,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_pos_imports' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getAccess(req)
      const posImport = await posImportsService.getById(req.params.id as string, companyIds)
      sendSuccess(res, posImport)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_pos_import', id: req.params.id })
    }
  }

  getLines = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getAccess(req)
      const id = req.params.id as string
      await posImportsService.getById(id, companyIds)
      const { pagination } = req.query
      const page = (pagination as Record<string, unknown>)?.page as number || 1
      const limit = (pagination as Record<string, unknown>)?.limit as number || 50
      const result = await posImportLinesRepository.findByImportId(id, page, limit)
      sendSuccess(res, result.data, 'Lines retrieved', 200, { page, limit, total: result.total })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_pos_import_lines', id: req.params.id })
    }
  }

  export = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getAccess(req)
      const id = req.params.id as string
      const posImport = await posImportsService.getById(id, companyIds)
      const buffer = await posImportsService.exportToExcel(id, posImport.company_id)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${posImport.file_name.replace(/\.[^/.]+$/, '')}_export.xlsx"`)
      res.send(buffer)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'export_pos_import', id: req.params.id })
    }
  }

  getSummary = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getAccess(req)
      const id = req.params.id as string
      await posImportsService.getById(id, companyIds)
      const summary = await posImportLinesRepository.getSummaryByImportId(id)
      sendSuccess(res, summary, 'Summary retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_pos_import_summary', id: req.params.id })
    }
  }

  upload = async (req: Request, res: Response) => {
    try {
      const { userId, branchIds, companyIds } = await getAccess(req)
      const { branch_id } = req.body
      if (!req.file) { sendError(res, 'No file uploaded', 400); return }
      const allowedMimeTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
      if (!allowedMimeTypes.includes(req.file.mimetype)) { sendError(res, 'Invalid file type. Please upload Excel file (.xlsx or .xls)', 400); return }
      requireBranchAccess(branch_id, branchIds)
      const company_id = await getCompanyIdForBranch(branch_id)
      if (!company_id) { sendError(res, 'Invalid branch', 400); return }
      requireCompanyAccess(company_id, companyIds)
      const result = await posImportsService.analyzeFile(req.file, branch_id, company_id, userId)
      sendSuccess(res, { import: result.import, analysis: result.analysis, summary: result.summary }, 'File analyzed successfully. Review duplicates and click Confirm to start import.')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upload_pos_import' })
    }
  }

  confirm = async (req: Request, res: Response) => {
    try {
      const { userId, companyIds } = await getAccess(req)
      const id = req.params.id as string
      const { skip_duplicates } = req.body
      const existing = await posImportsService.getById(id, companyIds)
      const result = await posImportsService.confirmImport(id, existing.company_id, skip_duplicates, userId)
      sendSuccess(res, { import: result.posImport, job_id: result.job_id }, 'Import confirmed. Job is being processed in the background.')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_pos_import', id: req.params.id })
    }
  }

  updateStatus = async (req: Request, res: Response) => {
    try {
      const { userId, companyIds } = await getAccess(req)
      const id = req.params.id as string
      const { status, error_message } = req.body
      const existing = await posImportsService.getById(id, companyIds)
      const posImport = await posImportsService.updateStatus(id, existing.company_id, status, error_message, userId)
      sendSuccess(res, posImport, 'Status updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_pos_import_status', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { userId, companyIds } = await getAccess(req)
      const existing = await posImportsService.getById(req.params.id as string, companyIds)
      await posImportsService.delete(req.params.id as string, existing.company_id, userId)
      sendSuccess(res, null, 'Import deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_pos_import', id: req.params.id })
    }
  }

  createExportJob = async (req: Request, res: Response) => {
    try {
      const { userId, companyIds } = await getAccess(req)
      const { ids } = req.body
      if (!ids || !Array.isArray(ids) || ids.length === 0) { sendError(res, 'No import IDs provided', 400); return }
      const imports = await Promise.all(ids.map((id: string) => posImportsService.getById(id, companyIds)))
      const company_id = imports[0].company_id
      const job = await jobsService.createJob({
        user_id: userId, company_id, type: 'export', module: 'pos_imports',
        name: `Export POS Imports - ${new Date().toISOString().slice(0, 10)}`,
        metadata: { type: 'export', module: 'pos_imports', companyId: company_id, importIds: ids },
      })
      const { jobWorker } = await import('../../jobs')
      jobWorker.processJob(job.id).catch((err: unknown) => { logError('POS imports export job processing error', { job_id: job.id, error: err }) })
      logInfo('POS imports export job created', { job_id: job.id, user_id: userId, import_count: ids.length })
      sendSuccess(res, { job_id: job.id, status: job.status, name: job.name, type: job.type, module: job.module, created_at: job.created_at }, 'Export job created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_pos_export_job' })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { userId, companyIds } = await getAccess(req)
      const existing = await posImportsService.getById(req.params.id as string, companyIds)
      const posImport = await posImportsService.restore(req.params.id as string, existing.company_id, userId)
      sendSuccess(res, posImport, 'Import restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_pos_import', id: req.params.id })
    }
  }
}

export const posImportsController = new PosImportsController()
