import { Response } from 'express'
import { employeesService } from './employees.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo } from '../../config/logger'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../utils/export.util'
import type { AuthenticatedPaginatedRequest, AuthenticatedRequest } from '../../types/request.types'
import { CreateEmployeeSchema, UpdateEmployeeSchema, UpdateProfileSchema, EmployeeSearchSchema, BulkUpdateActiveSchema, UpdateActiveSchema, BulkDeleteSchema } from './employees.schema'
import { ValidatedAuthRequest } from '../../middleware/validation.middleware'

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
      handleError(res, error)
    }
  }

  async getUnassigned(req: AuthenticatedPaginatedRequest, res: Response) {
    try {
      const result = await employeesService.getUnassigned(req.pagination)
      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error) {
      handleError(res, error)
    }
  }
  
  async create(req: ValidatedAuthRequest<typeof CreateEmployeeSchema>, res: Response) {
    try {
      const employee = await employeesService.create(req.validated.body, req.file, req.user!.id)
      logInfo('Employee created', { employee_id: employee.employee_id, user: req.user!.id })
      sendSuccess(res, employee, 'Employee created', 201)
    } catch (error) {
      handleError(res, error)
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
      if (req.query.include_deleted !== undefined) filters.include_deleted = req.query.include_deleted === 'true'
      
      const result = await employeesService.search(q || '', {
        ...req.pagination,
        sort: req.query.sort as string,
        order: req.query.order as 'asc' | 'desc'
      }, filters)
      
      res.json({ success: true, data: result.data, pagination: result.pagination })
    } catch (error) {
      handleError(res, error)
    }
  }

  async getFilterOptions(req: AuthenticatedRequest, res: Response) {
    try {
      const options = await employeesService.getFilterOptions()
      sendSuccess(res, options)
    } catch (error) {
      handleError(res, error)
    }
  }

  async autocomplete(req: AuthenticatedRequest, res: Response) {
    try {
      const employees = await employeesService.autocomplete(req.query.q as string || '')
      sendSuccess(res, employees)
    } catch (error) {
      handleError(res, error)
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const employee = await employeesService.getProfile(req.user.id)
      sendSuccess(res, employee)
    } catch (error) {
      handleError(res, error)
    }
  }

  async updateProfile(req: ValidatedAuthRequest<typeof UpdateProfileSchema>, res: Response) {
    try {
      const employee = await employeesService.updateProfile(req.user!.id, req.validated.body)
      logInfo('Profile updated', { user: req.user!.id })
      sendSuccess(res, employee, 'Profile updated')
    } catch (error) {
      handleError(res, error)
    }
  }

  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const employee = await employeesService.getById(req.params.id)
      sendSuccess(res, employee)
    } catch (error) {
      handleError(res, error)
    }
  }

  async update(req: ValidatedAuthRequest<typeof UpdateEmployeeSchema>, res: Response) {
    try {
      const { body, params } = req.validated
      const employee = await employeesService.update(params.id, body, req.file, req.user!.id)
      logInfo('Employee updated', { id: params.id, user: req.user!.id })
      sendSuccess(res, employee, 'Employee updated')
    } catch (error) {
      handleError(res, error)
    }
  }

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      await employeesService.delete(req.params.id, req.user.id)
      logInfo('Employee deleted', { id: req.params.id, user: req.user.id })
      sendSuccess(res, null, 'Employee deleted')
    } catch (error) {
      handleError(res, error)
    }
  }

  async restore(req: AuthenticatedRequest, res: Response) {
    try {
      await employeesService.restore(req.params.id, req.user.id)
      logInfo('Employee restored', { id: req.params.id, user: req.user.id })
      sendSuccess(res, null, 'Employee restored')
    } catch (error) {
      handleError(res, error)
    }
  }

  async uploadProfilePicture(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file) throw new Error('No file uploaded')
      
      const url = await employeesService.uploadProfilePicture(req.user.id, req.file)
      logInfo('Profile picture uploaded', { url, user: req.user.id })
      sendSuccess(res, { profile_picture: url }, 'Profile picture uploaded')
    } catch (error) {
      handleError(res, error)
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

  async bulkUpdateActive(req: ValidatedAuthRequest<typeof BulkUpdateActiveSchema>, res: Response) {
    try {
      const { ids, is_active } = req.validated.body
      await employeesService.bulkUpdateActive(ids, is_active)
      logInfo('Bulk update active', { count: ids.length, user: req.user!.id })
      sendSuccess(res, null, 'Employees updated')
    } catch (error) {
      handleError(res, error)
    }
  }

  async updateActive(req: ValidatedAuthRequest<typeof UpdateActiveSchema>, res: Response) {
    try {
      const { id } = req.validated.params
      const { is_active } = req.validated.body
      await employeesService.bulkUpdateActive([id], is_active)
      logInfo('Update active', { id, is_active, user: req.user!.id })
      sendSuccess(res, null, `Employee ${is_active ? 'activated' : 'deactivated'}`)
    } catch (error) {
      handleError(res, error)
    }
  }

  async bulkDelete(req: ValidatedAuthRequest<typeof BulkDeleteSchema>, res: Response) {
    try {
      const { ids } = req.validated.body
      await employeesService.bulkDelete(ids)
      logInfo('Bulk delete', { count: ids.length, user: req.user!.id })
      sendSuccess(res, null, 'Employees deleted')
    } catch (error) {
      handleError(res, error)
    }
  }

  async bulkRestore(req: ValidatedAuthRequest<typeof BulkDeleteSchema>, res: Response) {
    try {
      const { ids } = req.validated.body
      await employeesService.bulkRestore(ids)
      logInfo('Bulk restore', { count: ids.length, user: req.user!.id })
      sendSuccess(res, null, 'Employees restored')
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const employeesController = new EmployeesController()
