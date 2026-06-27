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
  printDailyPrepOrderSchema,
  printStockTransferSchema,
  printMonthlyStockOpnameSchema,
  printPettyCashSchema,
} from './printers.schema'
import { getAccessibleCompanyIds, requireCompanyAccess, resolveContextCompanyId } from '../../utils/branch-access.util'

async function printerWriteScope(req: Request) {
  const userId = req.user?.id ?? ''
  const companyIds = await getAccessibleCompanyIds(userId)
  const companyId = resolveContextCompanyId(req.context?.company_id ?? '', companyIds)
  requireCompanyAccess(companyId, companyIds)
  return { userId, companyIds, companyId }
}

export class PrintersController {
  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyId, userId } = await printerWriteScope(req)
      const data = await printersService.list(companyId, userId)
      sendSuccess(res, data, 'Printers retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_printers' })
    }
  }

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof printerIdSchema>).validated
      const { companyId, userId } = await printerWriteScope(req)
      const data = await printersService.getById(params.id, companyId, userId)
      sendSuccess(res, data, 'Printer retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_printer' })
    }
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof createPrinterSchema>).validated
      const { companyId, userId } = await printerWriteScope(req)
      const data = await printersService.create(companyId, body, userId)
      sendSuccess(res, data, 'Printer created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_printer' })
    }
  }

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof updatePrinterSchema>).validated
      const { companyId, userId } = await printerWriteScope(req)
      const data = await printersService.update(params.id, companyId, body, userId)
      sendSuccess(res, data, 'Printer updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_printer' })
    }
  }

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof printerIdSchema>).validated
      const { companyId, userId } = await printerWriteScope(req)
      await printersService.delete(params.id, companyId, userId)
      sendSuccess(res, null, 'Printer deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_printer' })
    }
  }

  testConnection = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof printerIdSchema>).validated
      const { companyId, userId } = await printerWriteScope(req)
      const connected = await printersService.testConnection(
        params.id,
        companyId,
        userId,
      )
      sendSuccess(res, { connected }, connected ? 'Printer connected' : 'Printer unreachable')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'test_printer' })
    }
  }

  printPurchaseRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof printPurchaseRequestSchema>).validated
      const { companyId, userId } = await printerWriteScope(req)
      await printersService.printPurchaseRequest(
        body.printer_id,
        params.id,
        body.line_ids,
        companyId,
        userId,
      )
      sendSuccess(res, null, 'Print job sent successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'print_purchase_request' })
    }
  }

  printGoodsReceipt = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof printGoodsReceiptSchema>).validated
      const { companyId, userId } = await printerWriteScope(req)
      await printersService.printGoodsReceipt(
        body.printer_id,
        params.id,
        body.line_ids,
        companyId,
        userId,
      )
      sendSuccess(res, null, 'Print job sent successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'print_goods_receipt' })
    }
  }

  printDailyPrepOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof printDailyPrepOrderSchema>).validated
      const { companyId, userId } = await printerWriteScope(req)
      await printersService.printDailyPrepOrder(
        body.printer_id,
        params.id,
        body.line_ids,
        companyId,
        userId,
      )
      sendSuccess(res, null, 'Print job sent successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'print_daily_prep_order' })
    }
  }

  printStockTransfer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof printStockTransferSchema>).validated
      const { companyId, userId } = await printerWriteScope(req)
      await printersService.printStockTransfer(
        body.printer_id,
        params.id,
        body.line_ids,
        companyId,
        userId,
      )
      sendSuccess(res, null, 'Print job sent successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'print_stock_transfer' })
    }
  }

  printProductionRequestSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyId, userId } = await printerWriteScope(req)
      const printerId = req.body?.printer_id
      if (!printerId) { sendSuccess(res, null, 'printer_id required', 400); return }

      const filter: Record<string, string> = {}
      if (req.body.status) filter.status = req.body.status
      if (req.body.date_from) filter.date_from = req.body.date_from
      if (req.body.date_to) filter.date_to = req.body.date_to

      await printersService.printProductionRequestSummary(printerId, companyId, userId, filter)
      sendSuccess(res, null, 'Print job sent successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'print_production_request_summary' })
    }
  }

  printProductionRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyId, userId } = await printerWriteScope(req)
      const prId = req.params.id as string
      const printerId = req.body?.printer_id as string
      if (!printerId) { sendSuccess(res, null, 'printer_id required', 400); return }

      await printersService.printProductionRequest(printerId, prId, companyId, userId)
      sendSuccess(res, null, 'Print job sent successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'print_production_request', id: req.params.id })
    }
  }

  printMonthlyStockOpname = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof printMonthlyStockOpnameSchema>).validated
      const { companyId, userId } = await printerWriteScope(req)
      await printersService.printMonthlyStockOpname(body.printer_id, params.id, companyId, userId)
      sendSuccess(res, null, 'Print job sent successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'print_monthly_stock_opname', id: req.params.id })
    }
  }

  printPettyCash = async (req: Request, res: Response): Promise<void> => {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof printPettyCashSchema>).validated
      const { companyId, userId } = await printerWriteScope(req)
      await printersService.printPettyCash(body.printer_id, params.id, companyId, userId)
      sendSuccess(res, null, 'Print job sent successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'print_petty_cash', id: req.params.id })
    }
  }
}

export const printersController = new PrintersController()
