import { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response.util'

/**
 * Write Guard Middleware
 * Blocks mutation operations (POST/PUT/DELETE) on closed branches.
 * Apply to routes AFTER resolveBranchContext, BEFORE permission middleware.
 *
 * Usage in routes:
 *   router.post('/', requireWriteAccess, canInsert('module'), ...)
 */
export const requireWriteAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.context?.is_read_only) {
    sendError(res, 'Cabang ini sudah tutup. Tidak bisa membuat atau mengubah data.', 403)
    return
  }
  next()
}
