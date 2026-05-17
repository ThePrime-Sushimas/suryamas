import type { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { productOutputTemplateService } from './product-output-template.service'
import type { UpsertOutputTemplateDto } from './product-output-template.repository'

export class ProductOutputTemplateController {
  getTemplate = async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string
      const result = await productOutputTemplateService.getTemplate(productId)
      sendSuccess(res, result, 'Template retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_output_template' })
    }
  }

  saveTemplate = async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string
      const userId = String((req as any).user?.id ?? '')
      const { items } = req.body as { items: UpsertOutputTemplateDto[] }
      const result = await productOutputTemplateService.saveTemplate(productId, items, userId)
      sendSuccess(res, result, 'Template saved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'save_output_template' })
    }
  }
}

export const productOutputTemplateController = new ProductOutputTemplateController()
