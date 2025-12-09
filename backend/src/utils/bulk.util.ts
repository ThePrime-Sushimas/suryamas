import { Response } from 'express'
import { AuthRequest } from '../types/common.types'
import { sendSuccess, sendError } from './response.util'
import { logInfo, logError } from '../config/logger'

export async function handleBulkUpdate(
  req: AuthRequest,
  res: Response,
  updateFn: (ids: string[], data: any) => Promise<void>,
  actionName: string
) {
  try {
    const { ids, ...updateData } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 'No IDs provided', 400)
    }
    
    await updateFn(ids, updateData)
    logInfo(`Bulk ${actionName}`, { count: ids.length, user: req.user?.id })
    sendSuccess(res, null, `${ids.length} items updated`)
  } catch (error) {
    logError(`Failed to bulk ${actionName}`, {
      error: (error as Error).message,
      user: req.user?.id
    })
    sendError(res, (error as Error).message, 400)
  }
}

export async function handleBulkDelete(
  req: AuthRequest,
  res: Response,
  deleteFn: (ids: string[]) => Promise<void>
) {
  try {
    const { ids } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 'No IDs provided', 400)
    }
    
    await deleteFn(ids)
    logInfo('Bulk delete', { count: ids.length, user: req.user?.id })
    sendSuccess(res, null, `${ids.length} items deleted`)
  } catch (error) {
    logError('Failed to bulk delete', {
      error: (error as Error).message,
      user: req.user?.id
    })
    sendError(res, (error as Error).message, 400)
  }
}
