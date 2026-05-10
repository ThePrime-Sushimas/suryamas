import type { Request, Response } from 'express'
import { departmentsService } from './departments.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { createDepartmentSchema, updateDepartmentSchema, departmentIdSchema } from './departments.schema'

type CreateReq = ValidatedAuthRequest<typeof createDepartmentSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateDepartmentSchema>
type IdReq = ValidatedAuthRequest<typeof departmentIdSchema>

class DepartmentsController {

  list = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const data = await departmentsService.list(companyId)
      sendSuccess(res, data, 'Departments retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_departments' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const data = await departmentsService.getById(id, companyId)
      sendSuccess(res, data, 'Department retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_department', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const { body } = (req as CreateReq).validated
      const data = await departmentsService.create(companyId, { ...body, created_by: userId })
      sendSuccess(res, data, 'Department created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_department' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const data = await departmentsService.update(params.id, companyId, { ...body, updated_by: userId })
      sendSuccess(res, data, 'Department updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_department', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await departmentsService.delete(id, companyId, userId)
      sendSuccess(res, null, 'Department deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_department', id: req.params.id })
    }
  }
}

export const departmentsController = new DepartmentsController()
