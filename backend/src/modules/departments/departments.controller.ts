import type { Request, Response } from 'express'
import { departmentsService } from './departments.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { createDepartmentSchema, updateDepartmentSchema, departmentIdSchema } from './departments.schema'
import { getReadScope, getWriteScope } from '../../utils/branch-access.util'

type CreateReq = ValidatedAuthRequest<typeof createDepartmentSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateDepartmentSchema>
type IdReq = ValidatedAuthRequest<typeof departmentIdSchema>

class DepartmentsController {

  list = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const data = await departmentsService.list(companyIds)
      sendSuccess(res, data, 'Departments retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_departments' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { companyIds } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const data = await departmentsService.getById(id, companyIds)
      sendSuccess(res, data, 'Department retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_department', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { companyId, userId } = await getWriteScope(req)
      const { body } = (req as CreateReq).validated
      const data = await departmentsService.create(companyId, { ...body, created_by: userId })
      sendSuccess(res, data, 'Department created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_department' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { params, body } = (req as UpdateReq).validated
      const existing = await departmentsService.getById(params.id, companyIds)
      const data = await departmentsService.update(params.id, existing.company_id, { ...body, updated_by: userId }, existing)
      sendSuccess(res, data, 'Department updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_department', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { companyIds, userId } = await getReadScope(req)
      const { id } = (req as IdReq).validated.params
      const existing = await departmentsService.getById(id, companyIds)
      await departmentsService.delete(id, existing.company_id, userId, existing)
      sendSuccess(res, null, 'Department deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_department', id: req.params.id })
    }
  }
}

export const departmentsController = new DepartmentsController()
