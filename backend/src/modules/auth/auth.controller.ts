import { Response } from 'express'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { withValidated } from '../../utils/handler'
import type { AuthenticatedRequest } from '../../types/request.types'
import type { ValidatedRequest } from '../../middleware/validation.middleware'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema'
import { authService } from './auth.service'

type RegisterReq = ValidatedRequest<typeof registerSchema>
type LoginReq = ValidatedRequest<typeof loginSchema>
type ForgotPasswordReq = ValidatedRequest<typeof forgotPasswordSchema>
type ResetPasswordReq = ValidatedRequest<typeof resetPasswordSchema>

export class AuthController {
  register = withValidated(async (req: RegisterReq, res: Response) => {
    try {
      const { email, password, employee_id } = req.validated.body
      const result = await authService.register(email, password, employee_id)
      sendSuccess(res, { user: result.user, employee: result.employeeName }, 'Registration successful', 201)
    } catch (error) {
      handleError(res, error)
    }
  })

  login = withValidated(async (req: LoginReq, res: Response) => {
    try {
      const { email, password } = req.validated.body
      const session = await authService.login(email, password)
      sendSuccess(res, session, 'Login successful')
    } catch (error) {
      handleError(res, error)
    }
  })

  logout = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (userId) await authService.logout(userId)
      sendSuccess(res, null, 'Logout successful')
    } catch (error) {
      handleError(res, error)
    }
  }

  forgotPassword = withValidated(async (req: ForgotPasswordReq, res: Response) => {
    try {
      const { email } = req.validated.body
      await authService.forgotPassword(email)
      sendSuccess(res, null, 'Password reset email sent')
    } catch (error) {
      handleError(res, error)
    }
  })

  resetPassword = withValidated(async (req: ResetPasswordReq, res: Response) => {
    try {
      const { password, recovery_token } = req.validated.body
      await authService.resetPassword(recovery_token || '', password)
      sendSuccess(res, null, 'Password updated successfully')
    } catch (error) {
      handleError(res, error)
    }
  })
}

export const authController = new AuthController()
