// =====================================================
// MODULES CONTROLLER
// Responsibility: HTTP handling for modules only
// =====================================================

import { Response, Request } from 'express'
import { AuthRequest } from '../../types/common.types'
import { ModulesService } from './modules.service'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logError } from '../../config/logger'
import { withValidated } from '../../utils/handler'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import {
  createModuleSchema,
  updateModuleSchema,
} from './permissions.schema'

type CreateModuleReq = ValidatedAuthRequest<typeof createModuleSchema>
type UpdateModuleReq = ValidatedAuthRequest<typeof updateModuleSchema>

export class ModulesController {
  private service: ModulesService

  constructor() {
    this.service = new ModulesService()
  }

  getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const modules = await this.service.getAll()
      sendSuccess(res, modules, 'Modules retrieved successfully')
    } catch (error: any) {
      logError('Get modules failed', { error: error.message })
      sendError(res, 'Failed to retrieve modules', 500)
    }
  }

  findById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const module = await this.service.findById(id)

      if (!module) {
        sendError(res, 'Module not found', 404)
        return
      }

      sendSuccess(res, module, 'Module retrieved successfully')
    } catch (error: any) {
      logError('Get module failed', { error: error.message })
      sendError(res, 'Failed to retrieve module', 500)
    }
  }

  create = withValidated(async (req: CreateModuleReq, res: Response) => {
    try {
      const module = await this.service.create({
        name: req.validated.body.module_name,
        description: req.validated.body.description,
      }, req.user?.id)
      sendSuccess(res, module, 'Module created successfully', 201)
    } catch (error: any) {
      logError('Create module failed', { error: error.message })
      const statusCode = error.statusCode || 500
      const message = error.isOperational ? error.message : 'Failed to create module'
      sendError(res, message, statusCode)
    }
  })

  update = withValidated(async (req: UpdateModuleReq, res: Response) => {
    try {
      const { id } = req.validated.params
      const module = await this.service.update(id, {
        ...(req.validated.body.module_name && { name: req.validated.body.module_name }),
        description: req.validated.body.description,
      })
      sendSuccess(res, module, 'Module updated successfully')
    } catch (error: any) {
      logError('Update module failed', { error: error.message })
      sendError(res, 'Failed to update module', 500)
    }
  })

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const success = await this.service.delete(id)

      if (!success) {
        sendError(res, 'Failed to delete module', 400)
        return
      }

      sendSuccess(res, null, 'Module deleted successfully')
    } catch (error: any) {
      logError('Delete module failed', { error: error.message })
      sendError(res, 'Failed to delete module', 500)
    }
  }
}
