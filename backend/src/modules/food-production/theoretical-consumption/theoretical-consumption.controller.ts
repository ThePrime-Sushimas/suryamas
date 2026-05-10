import type { Request, Response } from 'express'
import { theoreticalConsumptionService } from './theoretical-consumption.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { theoreticalConsumptionQuerySchema } from './theoretical-consumption.schema'

type QueryReq = ValidatedAuthRequest<typeof theoreticalConsumptionQuerySchema>

export class TheoreticalConsumptionController {
  getTheoretical = async (req: Request, res: Response) => {
    try {
      const { query } = (req as QueryReq).validated
      const result = await theoreticalConsumptionService.getTheoretical(query)
      sendSuccess(res, result, 'Theoretical consumption calculated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_theoretical_consumption' })
    }
  }

  getVariance = async (req: Request, res: Response) => {
    try {
      const { query } = (req as QueryReq).validated
      const result = await theoreticalConsumptionService.getVariance(query)
      sendSuccess(res, result, 'Variance calculated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_variance' })
    }
  }

  getCoverage = async (req: Request, res: Response) => {
    try {
      const { query } = (req as QueryReq).validated
      const result = await theoreticalConsumptionService.getCoverage(query)
      sendSuccess(res, result, 'Coverage retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_coverage' })
    }
  }

  getMenuProfitability = async (req: Request, res: Response) => {
    try {
      const { query } = (req as QueryReq).validated
      const result = await theoreticalConsumptionService.getMenuProfitability(query)
      sendSuccess(res, result, 'Menu profitability calculated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_menu_profitability' })
    }
  }

  getCostTrend = async (req: Request, res: Response) => {
    try {
      const { query } = (req as QueryReq).validated
      const companyId = req.context?.company_id ?? ''
      const result = await theoreticalConsumptionService.getCostTrend(companyId, query)
      sendSuccess(res, result, 'Cost trend retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_cost_trend' })
    }
  }

  getWasteSummary = async (req: Request, res: Response) => {
    try {
      const { query } = (req as QueryReq).validated
      const result = await theoreticalConsumptionService.getWasteSummary(query)
      sendSuccess(res, result, 'Waste summary retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_waste_summary' })
    }
  }
}

export const theoreticalConsumptionController = new TheoreticalConsumptionController()
