import { Request, Response } from 'express'
import { employeesService } from './employees.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo, logError } from '../../config/logger'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../utils/export.util'
import { getParamString } from '../../utils/validation.util'
import { EmployeeErrors } from './employees.errors'
import type { EmployeeFilter } from './employees.types'
import type { CreateEmployeeSchema, UpdateEmployeeSchema, UpdateProfileSchema, BulkUpdateActiveSchema, UpdateActiveSchema, BulkDeleteSchema } from './employees.schema'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { jobsService } from '../jobs'

export class EmployeesController {
  async list(req: Request, res: Response) {
    try {
      const pagination = req.pagination ?? { page: 1, limit: 50 }
      const result = await employeesService.list({
        ...pagination,
        sort: req.query.sort as string,
        order: req.query.order as 'asc' | 'desc'
      })
      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_employees' })
    }
  }

  async getUnassigned(req: Request, res: Response) {
    try {
      const result = await employeesService.getUnassigned(req.pagination ?? { page: 1, limit: 50 })
      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_unassigned_employees' })
    }
  }

  async create(req: ValidatedAuthRequest<typeof CreateEmployeeSchema>, res: Response) {
    try {
      const employee = await employeesService.create(req.validated.body, req.file, req.user!.id)
      logInfo('Employee created', { employee_id: employee.employee_id, user: req.user!.id })
      sendSuccess(res, employee, 'Employee created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_employee' })
    }
  }

  async search(req: Request, res: Response) {
    try {
      const q = (req.query.q as string) || ''

      const filters: EmployeeFilter = {}
      if (req.query.branch_name) filters.branch_name = req.query.branch_name as string
      if (req.query.job_position) filters.job_position = req.query.job_position as string
      if (req.query.status_employee) filters.status_employee = req.query.status_employee as EmployeeFilter['status_employee']
      if (req.query.is_active !== undefined) filters.is_active = req.query.is_active === 'true'
      if (req.query.include_deleted !== undefined) filters.include_deleted = req.query.include_deleted === 'true'

      const pagination = req.pagination ?? { page: 1, limit: 50 }
      const result = await employeesService.search(q, {
        ...pagination,
        sort: req.query.sort as string,
        order: req.query.order as 'asc' | 'desc'
      }, filters)

      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'search_employees', query: req.query.q })
    }
  }

  async getFilterOptions(req: Request, res: Response) {
    try {
      const options = await employeesService.getFilterOptions()
      sendSuccess(res, options)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_filter_options' })
    }
  }

  async autocomplete(req: Request, res: Response) {
    try {
      const employees = await employeesService.autocomplete(req.query.q as string || '')
      sendSuccess(res, employees)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'autocomplete_employees' })
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const employee = await employeesService.getProfile(req.user!.id)
      sendSuccess(res, employee)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_profile' })
    }
  }

  async updateProfile(req: ValidatedAuthRequest<typeof UpdateProfileSchema>, res: Response) {
    try {
      const employee = await employeesService.updateProfile(req.user!.id, req.validated.body)
      logInfo('Profile updated', { user: req.user!.id })
      sendSuccess(res, employee, 'Profile updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_profile' })
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const employee = await employeesService.getById(getParamString(req.params.id))
      sendSuccess(res, employee)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_employee', id: req.params.id })
    }
  }

  async update(req: ValidatedAuthRequest<typeof UpdateEmployeeSchema>, res: Response) {
    try {
      const { body, params } = req.validated
      const employee = await employeesService.update(params.id, body, req.file, req.user!.id)
      logInfo('Employee updated', { id: params.id, user: req.user!.id })
      sendSuccess(res, employee, 'Employee updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_employee', id: req.validated?.params?.id })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = getParamString(req.params.id)
      await employeesService.delete(id, req.user!.id)
      logInfo('Employee deleted', { id, user: req.user!.id })
      sendSuccess(res, null, 'Employee deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_employee', id: req.params.id })
    }
  }

  async restore(req: Request, res: Response) {
    try {
      const id = getParamString(req.params.id)
      await employeesService.restore(id, req.user!.id)
      logInfo('Employee restored', { id, user: req.user!.id })
      sendSuccess(res, null, 'Employee restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_employee', id: req.params.id })
    }
  }

  async uploadProfilePicture(req: Request, res: Response) {
    try {
      if (!req.file) throw EmployeeErrors.NO_FILE()

      const url = await employeesService.uploadProfilePicture(req.user!.id, req.file)
      logInfo('Profile picture uploaded', { url, user: req.user!.id })
      sendSuccess(res, { profile_picture: url }, 'Profile picture uploaded')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upload_profile_picture' })
    }
  }

  // ============================================
  // EXPORT (LEGACY)
  // ============================================

  async generateExportToken(req: Request, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: Request, res: Response) {
    return handleExport(req, res, (filter) => employeesService.exportToExcel(filter), 'employees')
  }

  // ============================================
  // EXPORT (JOB-BASED)
  // ============================================

  async createExportJob(req: Request, res: Response) {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id
      if (!companyId) return sendError(res, 'Company context required', 400)

      const filter: Record<string, unknown> = {}
      if (req.query.branch_name) filter.branch_name = req.query.branch_name
      if (req.query.job_position) filter.job_position = req.query.job_position
      if (req.query.status_employee) filter.status_employee = req.query.status_employee
      if (req.query.is_active) filter.is_active = req.query.is_active === 'true'
      if (req.query.search) filter.search = req.query.search

      const job = await jobsService.createJob({
        user_id: userId,
        company_id: companyId,
        type: 'export',
        module: 'employees',
        name: `Export Employees - ${new Date().toISOString().slice(0, 10)}`,
        metadata: {
          type: 'export',
          module: 'employees',
          filter: Object.keys(filter).length ? filter : undefined
        }
      })

      logInfo('Employees export job created', { job_id: job.id, user_id: userId })

      sendSuccess(res, {
        job_id: job.id,
        status: job.status,
        name: job.name,
        type: job.type,
        module: job.module,
        created_at: job.created_at,
        message: 'Export job created successfully. Processing will run in background automatically.'
      }, 'Export job created', 201)
    } catch (error: unknown) {
      logError('Failed to create export job', { error: error instanceof Error ? error.message : 'unknown' })
      await handleError(res, error, req, { action: 'create_export_job' })
    }
  }

  // ============================================
  // IMPORT (LEGACY)
  // ============================================

  async previewImport(req: Request, res: Response) {
    return handleImportPreview(req, res, (buffer) => employeesService.previewImport(buffer))
  }

  async importData(req: Request, res: Response) {
    return handleImport(req, res, (buffer, skip) => employeesService.importFromExcel(buffer, skip))
  }

  // ============================================
  // IMPORT (JOB-BASED)
  // ============================================

  async createImportJob(req: Request, res: Response) {
    try {
      const userId = req.user!.id
      const companyId = req.context?.company_id
      if (!companyId) return sendError(res, 'Company context required', 400)
      if (!req.file) return sendError(res, 'No file uploaded', 400)

      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
      ]
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return sendError(res, 'Invalid file type. Only Excel files (.xlsx, .xls) are allowed', 400)
      }

      const maxSize = 10 * 1024 * 1024
      if (req.file.size > maxSize) {
        return sendError(res, `File size exceeds maximum ${maxSize / (1024 * 1024)}MB`, 400)
      }

      const { saveTempFile } = await import('../jobs/jobs.util')
      const filePath = await saveTempFile(req.file.buffer, `employees_import_${Date.now()}.xlsx`)
      const skipDuplicates = req.body.skipDuplicates === 'true' || req.body.skipDuplicates === true

      const job = await jobsService.createJob({
        user_id: userId,
        company_id: companyId,
        type: 'import',
        module: 'employees',
        name: `Import Employees - ${req.file.originalname}`,
        metadata: {
          type: 'import',
          module: 'employees',
          filePath,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          skipDuplicates,
          mimeType: req.file.mimetype
        }
      })

      logInfo('Employees import job created', {
        job_id: job.id,
        file_name: req.file.originalname,
        file_size: req.file.size,
        user_id: userId
      })

      sendSuccess(res, {
        job_id: job.id,
        status: job.status,
        name: job.name,
        type: job.type,
        module: job.module,
        created_at: job.created_at,
        file_name: req.file.originalname,
        file_size: req.file.size,
        message: 'Import job created successfully. Processing will run in background automatically.'
      }, 'Import job created', 201)
    } catch (error: unknown) {
      logError('Failed to create import job', { error: error instanceof Error ? error.message : 'unknown' })
      await handleError(res, error, req, { action: 'create_import_job' })
    }
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkUpdateActive(req: ValidatedAuthRequest<typeof BulkUpdateActiveSchema>, res: Response) {
    try {
      const { ids, is_active } = req.validated.body
      await employeesService.bulkUpdateActive(ids, is_active)
      logInfo('Bulk update active', { count: ids.length, user: req.user!.id })
      sendSuccess(res, null, 'Employees updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_update_active' })
    }
  }

  async updateActive(req: ValidatedAuthRequest<typeof UpdateActiveSchema>, res: Response) {
    try {
      const { id } = req.validated.params
      const { is_active } = req.validated.body
      await employeesService.bulkUpdateActive([id], is_active)
      logInfo('Update active', { id, is_active, user: req.user!.id })
      sendSuccess(res, null, `Employee ${is_active ? 'activated' : 'deactivated'}`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_active', id: req.validated?.params?.id })
    }
  }

  async bulkDelete(req: ValidatedAuthRequest<typeof BulkDeleteSchema>, res: Response) {
    try {
      const { ids } = req.validated.body
      await employeesService.bulkDelete(ids)
      logInfo('Bulk delete', { count: ids.length, user: req.user!.id })
      sendSuccess(res, null, 'Employees deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_delete' })
    }
  }

  async bulkRestore(req: ValidatedAuthRequest<typeof BulkDeleteSchema>, res: Response) {
    try {
      const { ids } = req.validated.body
      await employeesService.bulkRestore(ids)
      logInfo('Bulk restore', { count: ids.length, user: req.user!.id })
      sendSuccess(res, null, 'Employees restored')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_restore' })
    }
  }
}

export const employeesController = new EmployeesController()
