import { Request, Response } from 'express'
import { ModulesService } from './modules.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { PermissionErrors } from './permissions.errors'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { moduleIdSchema, createModuleSchema, updateModuleSchema } from './permissions.schema'

type ModuleIdReq = ValidatedAuthRequest<typeof moduleIdSchema>
type CreateModuleReq = ValidatedAuthRequest<typeof createModuleSchema>
type UpdateModuleReq = ValidatedAuthRequest<typeof updateModuleSchema>

export class ModulesController {
  private service = new ModulesService()

  getAll = async (req: Request, res: Response) => {
    try {
      const modules = await this.service.getAll()
      sendSuccess(res, modules, 'Modules retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_all_modules' })
    }
  }

  findById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as ModuleIdReq).validated.params
      const mod = await this.service.findById(id)
      if (!mod) throw PermissionErrors.NOT_FOUND(id)
      sendSuccess(res, mod, 'Module retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_module', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateModuleReq).validated
      const mod = await this.service.create({ name: body.module_name, description: body.description }, req.user?.id)
      sendSuccess(res, mod, 'Module created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_module' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateModuleReq).validated
      const mod = await this.service.update(params.id, {
        ...(body.module_name && { name: body.module_name }),
        description: body.description,
      })
      sendSuccess(res, mod, 'Module updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_module', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as ModuleIdReq).validated.params
      const success = await this.service.delete(id)
      if (!success) throw PermissionErrors.DELETE_FAILED('module')
      sendSuccess(res, null, 'Module deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_module', id: req.params.id })
    }
  }
}
