import { Response } from 'express'
import { supabase } from '../../config/supabase'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { logInfo, logWarn } from '../../config/logger'
import { withValidated } from '../../utils/handler'
import type { AuthenticatedRequest } from '../../types/request.types'
import type { ValidatedRequest } from '../../middleware/validation.middleware'
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema'

const DEFAULT_ROLE = 'staff'

type RegisterReq = ValidatedRequest<typeof registerSchema>
type LoginReq = ValidatedRequest<typeof loginSchema>
type ForgotPasswordReq = ValidatedRequest<typeof forgotPasswordSchema>
type ResetPasswordReq = ValidatedRequest<typeof resetPasswordSchema>

export class AuthController {
  register = withValidated(async (req: RegisterReq, res: Response) => {
    try {
      const { email, password, employee_id } = req.validated.body

      const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_id', employee_id)
        .maybeSingle()

      if (!employee) {
        throw new Error('Employee not found')
      }

      if (employee.user_id) {
        throw new Error('Employee already has an account')
      }

      const isResigned = employee.resign_date && new Date(employee.resign_date) < new Date()
      if (isResigned) {
        throw new Error('Cannot register resigned employee')
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      })

      if (authError) {
        throw new Error(authError.message)
      }

      const { error: updateError } = await supabase
        .from('employees')
        .update({ user_id: authData.user!.id })
        .eq('employee_id', employee_id)

      if (updateError) {
        throw new Error('Registration failed')
      }

      const { data: staffRole } = await supabase
        .from('perm_roles')
        .select('id')
        .eq('name', DEFAULT_ROLE)
        .single()

      if (staffRole) {
        await supabase
          .from('perm_user_profiles')
          .insert({
            user_id: authData.user!.id,
            role_id: staffRole.id
          })
      }

      logInfo('User registered successfully', { 
        user_id: authData.user!.id,
        employee_id,
        email 
      })

      sendSuccess(res, {
        user: authData.user,
        employee: employee.full_name
      }, 'Registration successful', 201)
    } catch (error) {
      handleError(res, error)
    }
  })

  login = withValidated(async (req: LoginReq, res: Response) => {
    try {
      const { email, password } = req.validated.body

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw new Error('Invalid credentials')
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('resign_date')
        .eq('user_id', data.user.id)
        .maybeSingle()

      const isResigned = employee?.resign_date && new Date(employee.resign_date) < new Date()
      if (isResigned) {
        throw new Error('Account has been deactivated')
      }

      logInfo('User logged in', { user_id: data.user.id, email })

      sendSuccess(res, {
        access_token: data.session.access_token,
        user: data.user
      }, 'Login successful')
    } catch (error) {
      handleError(res, error)
    }
  })

  logout = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id
    await supabase.auth.signOut()
    logInfo('User logged out', { user_id: userId })
    sendSuccess(res, null, 'Logout successful')
  }

  forgotPassword = withValidated(async (req: ForgotPasswordReq, res: Response) => {
    try {
      const { email } = req.validated.body

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`
      })

      if (error) {
        throw new Error(error.message)
      }

      sendSuccess(res, null, 'Password reset email sent')
    } catch (error) {
      handleError(res, error)
    }
  })

  resetPassword = withValidated(async (req: ResetPasswordReq, res: Response) => {
    try {
      const { password } = req.validated.body
      const recoveryToken = req.headers['x-supabase-recovery-token'] as string || req.validated.body.recovery_token

      if (!recoveryToken) {
        throw new Error('Recovery token is required')
      }

      // The token from Supabase reset URL is an access_token
      // We need to set the session using this token first
      const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
        access_token: recoveryToken,
        refresh_token: recoveryToken // Use the same token as refresh token for recovery flow
      })

      if (setSessionError) {
        // If setSession fails, try to get the user directly
        const { data: { user }, error: getUserError } = await supabase.auth.getUser(recoveryToken)
        
        if (getUserError || !user) {
          throw new Error('Invalid or expired recovery token')
        }

        // Use admin API to update password (requires service role key)
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          { password }
        )

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        // Update password with the session
        const { error: updateError } = await supabase.auth.updateUser({
          password
        })

        if (updateError) {
          throw new Error(updateError.message)
        }
      }

      sendSuccess(res, null, 'Password updated successfully')
    } catch (error) {
      handleError(res, error)
    }
  })
}

export const authController = new AuthController()
 