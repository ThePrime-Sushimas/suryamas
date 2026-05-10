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
}

export const theoreticalConsumptionController = new TheoreticalConsumptionController()
