import { Request, Response } from 'express'
import { AuthRequest } from '../types'
import { authService } from '../services/auth.service'
import { sendSuccess, sendError } from '../utils/response'

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body
    const result = await authService.register(email, password, name)
    sendSuccess(res, { user: result.user, session: result.session }, 'Registration successful', 201)
  } catch (error: any) {
    sendError(res, error.message, 400)
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    const result = await authService.login(email, password)
    sendSuccess(res, { 
      user: result.user, 
      access_token: result.session.access_token 
    }, 'Login successful')
  } catch (error: any) {
    sendError(res, 'Invalid credentials', 401)
  }
}

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const profile = await authService.getProfile(req.user.id)
    if (!profile) {
      return sendError(res, 'Profile not found', 404)
    }
    sendSuccess(res, profile)
  } catch (error: any) {
    sendError(res, error.message, 500)
  }
}

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { full_name, phone } = req.body
    const profile = await authService.updateProfile(req.user.id, { full_name, phone })
    sendSuccess(res, profile, 'Profile updated')
  } catch (error: any) {
    sendError(res, error.message, 500)
  }
}