import { Response } from 'express'
import { supabase } from '../../config/supabase'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logInfo, logError, logWarn } from '../../config/logger'
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
    const { email, password, employee_id } = req.validated.body

    const { data: employee } = await supabase
      .from('employees')
      .select('*')
      .eq('employee_id', employee_id)
      .maybeSingle()

    if (!employee) {
      logWarn('Registration failed: Employee not found', { employee_id })
      return sendError(res, 'Employee not found', 404)
    }

    if (employee.user_id) {
      logWarn('Registration failed: Employee already has account', { employee_id })
      return sendError(res, 'Employee already has an account', 400)
    }

    const isResigned = employee.resign_date && new Date(employee.resign_date) < new Date()
    if (isResigned) {
      logWarn('Registration failed: Employee has resigned', { employee_id })
      return sendError(res, 'Cannot register resigned employee', 403)
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    })

    if (authError) {
      logError('Registration failed: Auth error', { error: authError.message, email })
      return sendError(res, authError.message, 400)
    }

    const { error: updateError } = await supabase
      .from('employees')
      .update({ user_id: authData.user!.id })
      .eq('employee_id', employee_id)

    if (updateError) {
      logError('Failed to link user to employee', { employee_id, error: updateError.message })
      return sendError(res, 'Registration failed', 500)
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
  })

  login = withValidated(async (req: LoginReq, res: Response) => {
    const { email, password } = req.validated.body

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      logWarn('Login failed', { email, error: error.message })
      return sendError(res, 'Invalid credentials', 401)
    }

    const { data: employee } = await supabase
      .from('employees')
      .select('resign_date')
      .eq('user_id', data.user.id)
      .maybeSingle()

    const isResigned = employee?.resign_date && new Date(employee.resign_date) < new Date()
    if (isResigned) {
      logWarn('Login failed: Employee has resigned', { user_id: data.user.id, email })
      return sendError(res, 'Account has been deactivated', 403)
    }

    logInfo('User logged in', { user_id: data.user.id, email })

    sendSuccess(res, {
      access_token: data.session.access_token,
      user: data.user
    }, 'Login successful')
  })

  logout = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id
    await supabase.auth.signOut()
    logInfo('User logged out', { user_id: userId })
    sendSuccess(res, null, 'Logout successful')
  }

  forgotPassword = withValidated(async (req: ForgotPasswordReq, res: Response) => {
    const { email } = req.validated.body

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    })

    if (error) {
      return sendError(res, error.message, 400)
    }

    sendSuccess(res, null, 'Password reset email sent')
  })

  resetPassword = withValidated(async (req: ResetPasswordReq, res: Response) => {
    const { password } = req.validated.body

    const { error } = await supabase.auth.updateUser({
      password
    })

    if (error) {
      return sendError(res, error.message, 400)
    }

    sendSuccess(res, null, 'Password updated successfully')
  })
}

export const authController = new AuthController()
