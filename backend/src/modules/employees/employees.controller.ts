import { Response } from 'express'
import { employeesService } from './employees.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logInfo, logError } from '../../config/logger'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../utils/export.util'
import { handleBulkDelete } from '../../utils/bulk.util'
import type { AuthenticatedPaginatedRequest, AuthenticatedRequest } from '../../types/request.types'
import { CreateEmployeeSchema, UpdateEmployeeSchema, UpdateProfileSchema, EmployeeSearchSchema, BulkUpdateActiveSchema, BulkDeleteSchema } from './employees.schema'
import { ValidatedRequest } from '../../types/validation.types'
import { ZodError } from 'zod'

export class EmployeesController {
  async list(req: AuthenticatedPaginatedRequest, res: Response) {
    try {
      const result = await employeesService.list({
        ...req.pagination,
        sort: req.query.sort as string,
        order: req.query.order as 'asc' | 'desc'
      })
      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error) {
      this.handleError(res, error, 'list employees', req.user.id)
    }
  }

  async getUnassigned(req: AuthenticatedPaginatedRequest, res: Response) {
    try {
      const result = await employeesService.getUnassigned(req.pagination)
      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error) {
      this.handleError(res, error, 'get unassigned employees', req.user.id)
    }
  }
  
  async create(req: ValidatedRequest<typeof CreateEmployeeSchema>, res: Response) {
    try {
      const employee = await employeesService.create(req.validated.body, req.file, req.user!.id)
      logInfo('Employee created', { employee_id: employee.employee_id, user: req.user!.id })
      sendSuccess(res, employee, 'Employee created', 201)
    } catch (error) {
      this.handleError(res, error, 'create employee', req.user!.id, req.validated)
    }
  }

  async search(req: AuthenticatedPaginatedRequest, res: Response) {
    try {
      const { q } = req.query as any
      
      const filters: any = {}
      if (req.query.branch_name) filters.branch_name = req.query.branch_name
      if (req.query.job_position) filters.job_position = req.query.job_position
      if (req.query.status_employee) filters.status_employee = req.query.status_employee
      if (req.query.is_active !== undefined) filters.is_active = req.query.is_active === 'true'
      
      const result = await employeesService.search(q || '', {
        ...req.pagination,
        sort: req.query.sort as string,
        order: req.query.order as 'asc' | 'desc'
      }, filters)
      
      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error) {
      this.handleError(res, error, 'search employees', req.user.id)
    }
  }

  async getFilterOptions(req: AuthenticatedRequest, res: Response) {
    try {
      const options = await employeesService.getFilterOptions()
      sendSuccess(res, options)
    } catch (error) {
      this.handleError(res, error, 'get filter options', req.user.id)
    }
  }

  async autocomplete(req: AuthenticatedRequest, res: Response) {
    try {
      const employees = await employeesService.autocomplete(req.query.q as string || '')
      sendSuccess(res, employees)
    } catch (error) {
      this.handleError(res, error, 'autocomplete employees', req.user.id)
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const employee = await employeesService.getProfile(req.user.id)
      sendSuccess(res, employee)
    } catch (error) {
      this.handleError(res, error, 'get profile', req.user.id, undefined, 404)
    }
  }

  async updateProfile(req: ValidatedRequest<typeof UpdateProfileSchema>, res: Response) {
    try {
      const employee = await employeesService.updateProfile(req.user!.id, req.validated.body)
      logInfo('Profile updated', { user: req.user!.id })
      sendSuccess(res, employee, 'Profile updated')
    } catch (error) {
      this.handleError(res, error, 'update profile', req.user!.id, req.validated)
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const employee = await employeesService.getById(req.params.id)
      sendSuccess(res, employee)
    } catch (error) {
      this.handleError(res, error, 'get employee', req.user.id, { id: req.params.id }, 404)
    }
  }

  async update(req: ValidatedRequest<typeof UpdateEmployeeSchema>, res: Response) {
    try {
      const { body, params } = req.validated
      const employee = await employeesService.update(params.id, body, req.file, req.user!.id)
      logInfo('Employee updated', { id: params.id, user: req.user!.id })
      sendSuccess(res, employee, 'Employee updated')
    } catch (error) {
      this.handleError(res, error, 'update employee', req.user!.id, { id: req.validated.params.id })
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      await employeesService.delete(req.params.id, req.user.id)
      logInfo('Employee deleted', { id: req.params.id, user: req.user.id })
      sendSuccess(res, null, 'Employee deleted')
    } catch (error) {
      this.handleError(res, error, 'delete employee', req.user.id, { id: req.params.id })
    }
  }

  async uploadProfilePicture(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file) return sendError(res, 'No file uploaded', 400)
      
      const url = await employeesService.uploadProfilePicture(req.user.id, req.file)
      logInfo('Profile picture uploaded', { url, user: req.user.id })
      sendSuccess(res, { profile_picture: url }, 'Profile picture uploaded')
    } catch (error) {
      this.handleError(res, error, 'upload profile picture', req.user.id)
    }
  }

  async generateExportToken(req: AuthenticatedRequest, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: AuthenticatedRequest, res: Response) {
    return handleExport(req, res, (filter) => employeesService.exportToExcel(filter), 'employees')
  }

  async previewImport(req: AuthenticatedRequest, res: Response) {
    return handleImportPreview(req, res, (buffer) => employeesService.previewImport(buffer))
  }

  async importData(req: AuthenticatedRequest, res: Response) {
    return handleImport(req, res, (buffer, skip) => employeesService.importFromExcel(buffer, skip))
  }

  async bulkUpdateActive(req: ValidatedRequest<typeof BulkUpdateActiveSchema>, res: Response) {
    try {
      const { ids, is_active } = req.validated.body
      await employeesService.bulkUpdateActive(ids, is_active)
      logInfo('Bulk update active', { count: ids.length, user: req.user!.id })
      sendSuccess(res, null, 'Employees updated')
    } catch (error) {
      this.handleError(res, error, 'bulk update active', req.user!.id)
    }
  }

  async bulkDelete(req: ValidatedRequest<typeof BulkDeleteSchema>, res: Response) {
    try {
      const { ids } = req.validated.body
      await employeesService.bulkDelete(ids)
      logInfo('Bulk delete', { count: ids.length, user: req.user!.id })
      sendSuccess(res, null, 'Employees deleted')
    } catch (error) {
      this.handleError(res, error, 'bulk delete', req.user!.id)
    }
  }

  private handleError(res: Response, error: unknown, action: string, userId: string, context?: any, defaultStatus: number = 400) {
    if (error instanceof ZodError) {
      logError(`Validation failed: ${action}`, { errors: error.issues, user: userId, context })
      return sendError(res, error.issues[0]?.message || 'Validation failed', 400)
    }

    const err = error as Error
    const message = err.message

    let status = defaultStatus
    if (message.includes('already exists')) status = 409
    if (message.includes('not found')) status = 404
    if (message.includes('No valid fields')) status = 400

    logError(`Failed to ${action}`, { error: message, user: userId, context })
    sendError(res, message, status)
  }
}

export const employeesController = new EmployeesController()
