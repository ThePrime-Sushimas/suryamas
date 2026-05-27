import type { Request, Response } from 'express'
import type { AuthRequest } from '../../types/common.types'
import { goodsProcessingService } from './goods-processing.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds, requireBranchAccess } from '../../utils/branch-access.util'

const getUserId = (req: Request): string => String((req as AuthRequest).user?.id ?? '')

async function gpScope(req: Request) {
  const userId = getUserId(req)
  const branchIds = await getAccessibleBranchIds(userId)
  return { userId, branchIds, contextBranchId: req.context?.branch_id ?? '' }
}

export class GoodsProcessingController {
  list = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await gpScope(req)
      const page  = typeof req.query.page  === 'string' ? parseInt(req.query.page)  : 1
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 20
      const status   = typeof req.query.status    === 'string' ? req.query.status    : undefined
      const branchId = typeof req.query.branch_id === 'string' ? req.query.branch_id : undefined
      const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from : undefined
      const dateTo   = typeof req.query.date_to   === 'string' ? req.query.date_to   : undefined
      const search   = typeof req.query.search   === 'string' ? req.query.search.trim()   : undefined

      if (branchId) requireBranchAccess(branchId, branchIds)

      const result = await goodsProcessingService.list(
        branchIds,
        { page: isNaN(page) ? 1 : page, limit: isNaN(limit) ? 20 : limit },
        {
          status,
          branch_id: branchId,
          date_from: dateFrom,
          date_to: dateTo,
          ...(search ? { search } : {}),
        }
      )
      sendSuccess(res, result.data, 'Goods processing list retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_goods_processing' })
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await gpScope(req)
      const id = req.params.id as string
      const result = await goodsProcessingService.getById(id, branchIds)
      sendSuccess(res, result, 'Goods processing detail retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_goods_processing' })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { branchIds, userId } = await gpScope(req)
      const id = req.params.id as string
      const result = await goodsProcessingService.update(id, branchIds, req.body, userId)
      sendSuccess(res, result, 'Goods processing updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_goods_processing' })
    }
  }

  start = async (req: Request, res: Response) => {
    try {
      const { branchIds, userId } = await gpScope(req)
      const id = req.params.id as string
      const result = await goodsProcessingService.start(id, branchIds, userId)
      sendSuccess(res, result, 'Processing started')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'start_goods_processing' })
    }
  }

  reopen = async (req: Request, res: Response) => {
    try {
      const { branchIds, userId } = await gpScope(req)
      const id = req.params.id as string
      const result = await goodsProcessingService.reopen(id, branchIds, userId)
      sendSuccess(res, result, 'Goods processing dibuka kembali untuk melanjutkan item')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reopen_goods_processing' })
    }
  }

  unconfirm = async (req: Request, res: Response) => {
    try {
      const { branchIds, userId } = await gpScope(req)
      const id = req.params.id as string
      const result = await goodsProcessingService.unconfirm(id, branchIds, userId)
      sendSuccess(res, result, 'GP dibuka kembali untuk koreksi')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'unconfirm_goods_processing' })
    }
  }

  confirm = async (req: Request, res: Response) => {
    try {
      const { branchIds, userId } = await gpScope(req)
      const id = req.params.id as string
      const result = await goodsProcessingService.confirm(id, branchIds, userId)
      sendSuccess(res, result, 'Confirmed, stock updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_goods_processing' })
    }
  }

  reject = async (req: Request, res: Response) => {
    try {
      const { branchIds, userId } = await gpScope(req)
      const id = req.params.id as string
      const result = await goodsProcessingService.reject(id, branchIds, req.body, userId)
      sendSuccess(res, result, 'Goods processing rejected')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reject_goods_processing' })
    }
  }

  bulkConfirm = async (req: Request, res: Response) => {
    try {
      const { branchIds, userId } = await gpScope(req)
      const { ids } = req.body as { ids: string[] }
      const result = await goodsProcessingService.bulkConfirm(ids, branchIds, userId)
      sendSuccess(res, result, 'Bulk confirm completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'bulk_confirm_goods_processing' })
    }
  }

  resolveReturn = async (req: Request, res: Response) => {
    try {
      const { branchIds, userId } = await gpScope(req)
      const id = req.params.id as string
      const outputId = req.params.outputId as string
      const { resolution } = req.body as { resolution: 'STOCK' | 'DISCARD' }
      const permissions = (req as AuthRequest).permissions ?? {}
      const result = await goodsProcessingService.resolveReturn(id, outputId, branchIds, resolution, userId, permissions)
      sendSuccess(res, result, `Return resolved: ${resolution === 'STOCK' ? 'masuk gudang' : 'dibuang'}`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'resolve_return_goods_processing' })
    }
  }

  confirmInput = async (req: Request, res: Response) => {
    try {
      const { branchIds, userId } = await gpScope(req)
      const id = req.params.id as string
      const inputId = req.params.inputId as string
      const { outputs } = req.body as { outputs: unknown[] }
      const result = await goodsProcessingService.confirmInput(id, inputId, branchIds, outputs, userId)
      sendSuccess(res, result, 'Input confirmed, status updated to DONE')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'confirm_input_goods_processing' })
    }
  }
}

export const goodsProcessingController = new GoodsProcessingController()
