import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { printersService } from './printers.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type {
  createPrinterSchema,
  updatePrinterSchema,
  printerIdSchema,
  printPurchaseRequestSchema,
  printGoodsReceiptSchema,
} from './printers.schema'

export class PrintersController {
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await printersService.list(req.context!.company_id, req.user!.id)
      sendSuccess(res, data, 'Printers retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_printers' })
    }
  }

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof printerIdSchema>).validated
      const data = await printersService.getById(params.id, req.context!.company_id, req.user!.id)
      sendSuccess(res, data, 'Printer retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_printer' })
    }
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof createPrinterSchema>).validated
      const data = await printersService.create(req.context!.company_id, body, req.user!.id)
      sendSuccess(res, data, 'Printer created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_printer' })
    }
  }

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof updatePrinterSchema>).validated
      const data = await printersService.update(params.id, req.context!.company_id, body, req.user!.id)
      sendSuccess(res, data, 'Printer updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_printer' })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof printerIdSchema>).validated
      await printersService.delete(params.id, req.context!.company_id, req.user!.id)
      sendSuccess(res, null, 'Printer deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_printer' })
    }
  }

  testConnection = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof printerIdSchema>).validated
      const connected = await printersService.testConnection(
        params.id,
        req.context!.company_id,
        req.user!.id,
      )
      sendSuccess(res, { connected }, connected ? 'Printer connected' : 'Printer unreachable')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'test_printer' })
    }
  }

  printPurchaseRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof printPurchaseRequestSchema>).validated
      await printersService.printPurchaseRequest(
        body.printer_id,
        params.id,
        body.line_ids,
        req.context!.company_id,
        req.user!.id,
      )
      sendSuccess(res, null, 'Print job sent successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'print_purchase_request' })
    }
  }

  printGoodsReceipt = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof printGoodsReceiptSchema>).validated
      await printersService.printGoodsReceipt(
        body.printer_id,
        params.id,
        body.line_ids,
        req.context!.company_id,
        req.user!.id,
      )
      sendSuccess(res, null, 'Print job sent successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'print_goods_receipt' })
    }
  }
}

export const printersController = new PrintersController()
