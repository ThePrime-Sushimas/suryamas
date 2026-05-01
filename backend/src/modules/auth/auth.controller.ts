import { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema'
import { authService } from './auth.service'

type RegisterReq = ValidatedAuthRequest<typeof registerSchema>
type LoginReq = ValidatedAuthRequest<typeof loginSchema>
type ForgotPasswordReq = ValidatedAuthRequest<typeof forgotPasswordSchema>
type ResetPasswordReq = ValidatedAuthRequest<typeof resetPasswordSchema>

export class AuthController {
  register = async (req: Request, res: Response) => {
    try {
      const { email, password, employee_id } = (req as RegisterReq).validated.body
      const result = await authService.register(email, password, employee_id)
      sendSuccess(res, { user: result.user, employee: result.employeeName }, 'Registration successful', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'register' })
    }
  }

  login = async (req: Request, res: Response) => {
    try {
      const { email, password } = (req as LoginReq).validated.body
      const session = await authService.login(email, password)
      sendSuccess(res, session, 'Login successful')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'login' })
    }
  }

  logout = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (userId) await authService.logout(userId)
      sendSuccess(res, null, 'Logout successful')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'logout' })
    }
  }

  forgotPassword = async (req: Request, res: Response) => {
    try {
      const { email } = (req as ForgotPasswordReq).validated.body
      await authService.forgotPassword(email)
      sendSuccess(res, null, 'Password reset email sent')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'forgot_password' })
    }
  }

  resetPassword = async (req: Request, res: Response) => {
    try {
      const { password, recovery_token } = (req as ResetPasswordReq).validated.body
      await authService.resetPassword(recovery_token || '', password)
      sendSuccess(res, null, 'Password updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reset_password' })
    }
  }
}

export const authController = new AuthController()
