import type { Request, Response } from 'express'
import { goodsReceiptsService } from './goods-receipts.service'
import { goodsReceiptsRepository } from './goods-receipts.repository'
import { storageService } from '../../services/storage.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { GoodsReceiptNotFoundError, GoodsReceiptAttachmentNotFoundError } from './goods-receipts.errors'
import { getAccessibleBranchIds } from '../../utils/branch-access.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import type { createGoodsReceiptSchema, updateGoodsReceiptSchema, confirmGoodsReceiptSchema, goodsReceiptIdSchema, createAttachmentSchema, deleteAttachmentSchema, pendingQtySchema } from './goods-receipts.schema'

type CreateReq = ValidatedAuthRequest<typeof createGoodsReceiptSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateGoodsReceiptSchema>
type ConfirmReq = ValidatedAuthRequest<typeof confirmGoodsReceiptSchema>
type IdReq = ValidatedAuthRequest<typeof goodsReceiptIdSchema>
type CreateAttachmentReq = ValidatedAuthRequest<typeof createAttachmentSchema>
type DeleteAttachmentReq = ValidatedAuthRequest<typeof deleteAttachmentSchema>
type PendingQtyReq = ValidatedAuthRequest<typeof pendingQtySchema>

export class GoodsReceiptsController {
  list = async (req: Request, res: Response) => {
    try {
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 25

      const filter: Record<string, unknown> = {}
      if (req.query.status) filter.status = req.query.status as string
      if (req.query.po_id) filter.po_id = req.query.po_id as string
      if (req.query.branch_id) filter.branch_id = req.query.branch_id as string
      if (req.query.date_from) filter.date_from = req.query.date_from as string
      if (req.query.date_to) filter.date_to = req.query.date_to as string

      // Show GRs from all accessible branches (not just active branch)
      if (!filter.branch_id) {
        filter.branch_ids = await getAccessibleBranchIds(userId)
      }

      const result = await goodsReceiptsService.list(companyId, { page, limit }, filter as Record<string, string | string[] | undefined>)
      sendSuccess(res, result.data, 'Goods receipts retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_goods_receipts' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const gr = await goodsReceiptsService.getById(id, companyId)
      sendSuccess(res, gr, 'Goods receipt retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_goods_receipt', id: req.params.id })
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const gr = await goodsReceiptsService.create(companyId, body, userId)
      sendSuccess(res, gr, 'Goods receipt created', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_goods_receipt' })
    }
  }

  confirm = async (req: Request, res: Response) => {
    try {
      const { params } = (req as ConfirmReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const gr = await goodsReceiptsService.confirm(params.id, companyId, userId)
      sendSuccess(res, gr, 'Goods receipt confirmed — stock & journal created')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_goods_receipt', id: req.params.id })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      const gr = await goodsReceiptsService.update(params.id, companyId, body, userId)
      sendSuccess(res, gr, 'Goods receipt updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_goods_receipt', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''
      await goodsReceiptsService.delete(id, companyId, userId)
      sendSuccess(res, null, 'Goods receipt deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_goods_receipt', id: req.params.id })
    }
  }

  pendingQty = async (req: Request, res: Response) => {
    try {
      const { query } = (req as PendingQtyReq).validated
      const pendingMap = await goodsReceiptsRepository.findPendingQtyByPo(query.po_id, query.exclude_gr_id)
      const result: Record<string, number> = Object.fromEntries(pendingMap)
      sendSuccess(res, result, 'Pending qty retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_pending_qty' })
    }
  }

  // ── Attachments ──

  listAttachments = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const companyId = req.context?.company_id ?? ''
      const gr = await goodsReceiptsRepository.findById(id, companyId)
      if (!gr) throw new GoodsReceiptNotFoundError(id)
      const attachments = await goodsReceiptsRepository.findAttachments(id)
      sendSuccess(res, attachments, 'Attachments retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_gr_attachments', id: req.params.id })
    }
  }

  uploadAttachment = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as CreateAttachmentReq).validated
      const companyId = req.context?.company_id ?? ''
      const userId = req.user?.id ?? ''

      const gr = await goodsReceiptsRepository.findById(params.id, companyId)
      if (!gr) throw new GoodsReceiptNotFoundError(params.id)

      const file = req.file
      if (!file) {
        res.status(400).json({
          success: false,
          message:
            'File tidak diterima. Gunakan JPG, PNG, WEBP, PDF, atau HEIC (maks. 10MB).',
        })
        return
      }

      const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'heic', 'heif']
      const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        res.status(400).json({ success: false, message: `File type .${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` })
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        res.status(400).json({ success: false, message: 'File too large. Maximum 10MB.' })
        return
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const now = new Date()
      const path = `${companyId}/gr-attachments/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${fileName}`

      await storageService.uploadToPath(file.buffer, path, file.mimetype, 'invoices')

      const attachment = await goodsReceiptsRepository.insertAttachment(params.id, {
        file_type: body.file_type,
        file_path: path,
        file_name: file.originalname,
        uploaded_by: userId,
      })

      sendSuccess(res, attachment, 'Attachment uploaded', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'upload_gr_attachment', id: req.params.id })
    }
  }

  deleteAttachment = async (req: Request, res: Response) => {
    try {
      const { params } = (req as DeleteAttachmentReq).validated
      const companyId = req.context?.company_id ?? ''

      const gr = await goodsReceiptsRepository.findById(params.id, companyId)
      if (!gr) throw new GoodsReceiptNotFoundError(params.id)

      const deleted = await goodsReceiptsRepository.deleteAttachment(params.attachmentId, params.id)
      if (!deleted) throw new GoodsReceiptAttachmentNotFoundError(params.attachmentId)

      sendSuccess(res, null, 'Attachment deleted')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_gr_attachment', id: req.params.id })
    }
  }
}

export const goodsReceiptsController = new GoodsReceiptsController()
