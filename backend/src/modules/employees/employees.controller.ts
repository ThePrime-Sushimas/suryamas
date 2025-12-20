import { Response } from 'express'
import { AuthRequest } from '../../types/common.types'
import { employeesService } from './employees.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logInfo, logError } from '../../config/logger'
import { PaginatedRequest } from '../../middleware/pagination.middleware'
import { SortRequest } from '../../middleware/sort.middleware'
import { FilterRequest } from '../../middleware/filter.middleware'
import { handleExportToken, handleExport, handleImportPreview, handleImport } from '../../utils/export.util'
import { handleBulkUpdate, handleBulkDelete } from '../../utils/bulk.util'

export class EmployeesController {
  async list(req: PaginatedRequest & SortRequest, res: Response) {
    try {
      const result = await employeesService.list(req.pagination, req.sort)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      })
    } catch (error) {
      logError('Failed to list employees', {
        error: (error as Error).message,
        user: (req as AuthRequest).user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async getUnassigned(req: PaginatedRequest & SortRequest, res: Response) {
    try {
      const result = await employeesService.getUnassigned(req.pagination, req.sort)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      })
    } catch (error) {
      logError('Failed to get unassigned employees', {
        error: (error as Error).message,
        user: (req as AuthRequest).user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }
  async create(req: AuthRequest, res: Response) {
    try {
      const employee = await employeesService.create(req.body, req.file, req.user?.id)
      logInfo('Employee created', { 
        employee_id: employee.employee_id,
        user: req.user?.id 
      })
      sendSuccess(res, employee, 'Employee created', 201)
    } catch (error) {
      logError('Failed to create employee', {
        error: (error as Error).message,
        body: req.body,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async search(req: PaginatedRequest & SortRequest & FilterRequest, res: Response) {
    try {
      const { q } = req.query
      const result = await employeesService.search(q as string, req.pagination, req.sort, req.filterParams)
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      })
    } catch (error) {
      logError('Failed to search employees', {
        error: (error as Error).message,
        query: req.query.q,
        user: (req as AuthRequest).user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async getFilterOptions(req: AuthRequest, res: Response) {
    try {
      const options = await employeesService.getFilterOptions()
      sendSuccess(res, options)
    } catch (error) {
      logError('Failed to get filter options', {
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async autocomplete(req: AuthRequest, res: Response) {
    try {
      const { q } = req.query
      const employees = await employeesService.autocomplete(q as string)
      sendSuccess(res, employees)
    } catch (error) {
      logError('Failed to autocomplete employees', {
        error: (error as Error).message,
        query: req.query.q,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async getProfile(req: AuthRequest, res: Response) {
    try {
      const employee = await employeesService.getProfile(req.user!.id)
      sendSuccess(res, employee)
    } catch (error) {
      logError('Failed to get profile', {
        error: (error as Error).message,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 404)
    }
  }

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const employee = await employeesService.updateProfile(req.user!.id, req.body)
      logInfo('Profile updated', { user: req.user?.id })
      sendSuccess(res, employee, 'Profile updated')
    } catch (error) {
      logError('Failed to update profile', {
        error: (error as Error).message,
        body: req.body,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const employee = await employeesService.getById(req.params.id)
      sendSuccess(res, employee)
    } catch (error) {
      logError('Failed to get employee', {
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 404)
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const employee = await employeesService.update(req.params.id, req.body, req.file, req.user?.id)
      logInfo('Employee updated', { 
        id: req.params.id,
        user: req.user?.id 
      })
      sendSuccess(res, employee, 'Employee updated')
    } catch (error) {
      logError('Failed to update employee', {
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      await employeesService.delete(req.params.id, req.user?.id)
      logInfo('Employee deleted', { 
        id: req.params.id,
        user: req.user?.id 
      })
      sendSuccess(res, null, 'Employee deleted')
    } catch (error) {
      logError('Failed to delete employee', {
        error: (error as Error).message,
        id: req.params.id,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async uploadProfilePicture(req: AuthRequest, res: Response) {
    try {
      logInfo('Upload request received', { 
        hasFile: !!req.file,
        user: req.user?.id 
      })
      
      if (!req.file) {
        logError('No file in request', { user: req.user?.id })
        return sendError(res, 'No file uploaded', 400)
      }
      
      logInfo('Processing file upload', { 
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        user: req.user?.id 
      })
      
      const url = await employeesService.uploadProfilePicture(req.user!.id, req.file)
      logInfo('Profile picture uploaded', { url, user: req.user?.id })
      sendSuccess(res, { profile_picture: url }, 'Profile picture uploaded')
    } catch (error) {
      logError('Failed to upload profile picture', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        user: req.user?.id
      })
      sendError(res, (error as Error).message, 400)
    }
  }

  async generateExportToken(req: AuthRequest, res: Response) {
    return handleExportToken(req, res)
  }

  async exportData(req: AuthRequest & FilterRequest, res: Response) {
    return handleExport(req, res, (filter) => employeesService.exportToExcel(filter), 'employees')
  }

  async previewImport(req: AuthRequest, res: Response) {
    return handleImportPreview(req, res, (buffer) => employeesService.previewImport(buffer))
  }

  async importData(req: AuthRequest, res: Response) {
    return handleImport(req, res, (buffer, skip) => employeesService.importFromExcel(buffer, skip))
  }

  async bulkUpdateActive(req: AuthRequest, res: Response) {
    return handleBulkUpdate(req, res, (ids, data) => employeesService.bulkUpdateActive(ids, data.is_active), 'update active')
  }

  async bulkDelete(req: AuthRequest, res: Response) {
    return handleBulkDelete(req, res, (ids) => employeesService.bulkDelete(ids))
  }
}

export const employeesController = new EmployeesController()