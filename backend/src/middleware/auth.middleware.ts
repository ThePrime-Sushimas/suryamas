import { Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'
import { AuthRequest } from '../types/common.types'
import { sendError } from '../utils/response.util'

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    sendError(res, 'No token provided', 401)
    return
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    sendError(res, 'Invalid or expired token', 401)
    return
  }

  req.user = user as any
  next()
}