import { Request, Response } from "express"
import { salesService } from './pos-sync.service'
import { ImportSalesPayload } from './pos-sync.types'
import { logWarn } from '../../../config/logger'

export const salesController = {
  import: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = req.body as ImportSalesPayload

      const result = await salesService.import(payload)

      res.json({
        success: true,
        data: result,
      })
    } catch (err: any) {
      logWarn('POS import failed', { error: err?.message })

      res.status(500).json({
        success: false,
        message: err?.message || 'Internal Server Error',
      })
    }
  },
}