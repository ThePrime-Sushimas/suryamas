import { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response.util'
import { logWarn } from '../config/logger'

export const requireApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const rawKey = req.headers['x-api-key']
  const apiKey = Array.isArray(rawKey) ? rawKey[0] : rawKey

  if (!apiKey || apiKey !== process.env.API_KEY) {
    logWarn('API key authentication failed', {
      path: req.path,
      ip: req.ip,
    })

    sendError(res, 'Unauthorized', 401)
    return
  }

  next()
}
