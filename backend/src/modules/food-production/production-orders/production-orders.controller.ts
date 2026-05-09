import type { Request, Response } from 'express'
import { productionOrdersService } from './production-orders.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type {
  createProductionOrderSchema, completeProductionOrderSchema,
  voidProductionOrderSchema, listProductionOrdersSchema,
  summarySchema, materialsReportSchema, idParamSchema
} from './production-orders.schema'

type CreateReq = ValidatedAuthRequest<typeof createProductionOrderSchema>
type CompleteReq = ValidatedAuthRequest<typeof completeProductionOrderSchema>
type VoidReq = ValidatedAuthRequest<typeof voidProductionOrderSchema>
type ListReq = ValidatedAuthRequest<typeof listProductionOrdersSchema>
type SummaryReq = ValidatedAuthRequest<typeof summarySchema>
type MaterialsReq = ValidatedAuthRequest<typeof materialsReportSchema>
type IdReq = ValidatedAuthRequest<typeof idParamSchema>

class ProductionOrdersController {

  list = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const { page, limit, branch_id, status, date_from, date_to } = (req as ListReq).validated.query
      const result = await productionOrdersService.list(companyId, { page, limit }, { branch_id, status, date_from, date_to })
      const totalPages = Math.ceil(result.total / limit)
      sendSuccess(res, result.data, 'Production orders retrieved', 200, { page, limit, total: result.total, totalPages })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_production_orders' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const order = await productionOrdersService.getById(id, companyId)
      sendSuccess(res, order, 'Production order retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_production_order', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const { body } = (req as CreateReq).validated
      const order = await productionOrdersService.create({
        ...body,
        company_id: companyId,
        created_by: userId,
      })
      sendSuccess(res, order, 'Production order created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_production_order' })
    }
  }

  complete = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as CompleteReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await productionOrdersService.complete(params.id, companyId, { ...body, user_id: userId })
      sendSuccess(res, null, 'Production order completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'complete_production_order', id: req.params.id })
    }
  }

  generateJournal = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const employeeId = req.context?.employee_id
      const result = await productionOrdersService.generateJournal(id, companyId, userId, employeeId)
      sendSuccess(res, result, 'Journal generated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'generate_journal_production_order', id: req.params.id })
    }
  }

  voidOrder = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as VoidReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await productionOrdersService.voidOrder(params.id, companyId, { user_id: userId, reason: body.reason })
      sendSuccess(res, null, 'Production order voided')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'void_production_order', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await productionOrdersService.delete(id, companyId, userId)
      sendSuccess(res, null, 'Production order deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_production_order', id: req.params.id })
    }
  }

  summary = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const { date_from, date_to, branch_id } = (req as SummaryReq).validated.query
      const data = await productionOrdersService.getSummary(companyId, date_from, date_to, branch_id)
      sendSuccess(res, data, 'Summary retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'production_order_summary' })
    }
  }

  materialsReport = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const { date_from, date_to, branch_id } = (req as MaterialsReq).validated.query
      const data = await productionOrdersService.getMaterialsReport(companyId, date_from, date_to, branch_id)
      sendSuccess(res, data, 'Materials report retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'production_order_materials_report' })
    }
  }
}

export const productionOrdersController = new ProductionOrdersController()
