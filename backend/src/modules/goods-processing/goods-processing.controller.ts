import type { Request, Response } from 'express'
import { goodsProcessingService } from './goods-processing.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'

export class GoodsProcessingController {
  list = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25

      const filter: { status?: string; branch_id?: string; branch_ids?: string[]; date_from?: string; date_to?: string } = {}
      if (req.query.status) filter.status = req.query.status as string
      if (req.query.branch_id) filter.branch_id = req.query.branch_id as string
      if (req.query.date_from) filter.date_from = req.query.date_from as string
      if (req.query.date_to) filter.date_to = req.query.date_to as string

      if (!filter.branch_id) {
        filter.branch_ids = await getAccessibleBranchIds(userId)
      }

      const result = await goodsProcessingService.list(companyId, { page, limit }, filter)
      sendSuccess(res, result.data, 'Goods processing retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_goods_processing' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const id = req.params.id as string
      const detail = await goodsProcessingService.getById(id, companyId)
      sendSuccess(res, detail, 'Goods processing detail retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_goods_processing', id: req.params.id })
    }
  }

  start = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await goodsProcessingService.start(id, companyId, userId)
      sendSuccess(res, result, 'Processing started')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'start_goods_processing', id: req.params.id })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await goodsProcessingService.update(id, companyId, req.body, userId)
      sendSuccess(res, result, 'Goods processing updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_goods_processing', id: req.params.id })
    }
  }

  submitQc = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await goodsProcessingService.submitQc(id, companyId, userId)
      sendSuccess(res, result, 'Submitted to QC')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'submit_qc_goods_processing', id: req.params.id })
    }
  }

  confirm = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await goodsProcessingService.confirm(id, companyId, userId)
      sendSuccess(res, result, 'QC confirmed, stock updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_goods_processing', id: req.params.id })
    }
  }

  bulkConfirm = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const { ids } = req.body
      const result = await goodsProcessingService.bulkConfirm(ids, companyId, userId)
      sendSuccess(res, result, `${result.success.length} confirmed, ${result.failed.length} failed`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_confirm_goods_processing' })
    }
  }

  reject = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const id = req.params.id as string
      const result = await goodsProcessingService.reject(id, companyId, req.body, userId)
      sendSuccess(res, result, 'Rejected')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_goods_processing', id: req.params.id })
    }
  }

  // ── Per-Line Actions ──

  startLine = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const lineId = req.params.lineId as string
      await goodsProcessingService.startLine(lineId, companyId, userId)
      sendSuccess(res, null, 'Line processing started')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'start_line', id: req.params.lineId })
    }
  }

  submitLineQc = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const lineId = req.params.lineId as string
      await goodsProcessingService.submitLineQc(lineId, companyId, userId)
      sendSuccess(res, null, 'Line submitted to QC')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'submit_line_qc', id: req.params.lineId })
    }
  }

  confirmLine = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const lineId = req.params.lineId as string
      await goodsProcessingService.confirmLine(lineId, companyId, userId)
      sendSuccess(res, null, 'Line confirmed, stock updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_line', id: req.params.lineId })
    }
  }

  rejectLine = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const lineId = req.params.lineId as string
      await goodsProcessingService.rejectLine(lineId, companyId, req.body, userId)
      sendSuccess(res, null, 'Line rejected')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_line', id: req.params.lineId })
    }
  }

  bulkConfirmLines = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const { line_ids } = req.body
      const result = await goodsProcessingService.bulkConfirmLines(line_ids, companyId, userId)
      sendSuccess(res, result, `${result.success.length} confirmed, ${result.failed.length} failed`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_confirm_lines' })
    }
  }
}

export const goodsProcessingController = new GoodsProcessingController()
