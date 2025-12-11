import { Request, Response } from 'express'
import { supabase } from '../../config/supabase'
import { sendSuccess, sendError } from '../../utils/response.util'
import { logInfo, logError, logWarn } from '../../config/logger'

export class AuthController {
  async register(req: Request, res: Response) {
    const { email, password, employee_id } = req.body

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

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    })

    if (authError) {
      logError('Registration failed: Auth error', { error: authError.message, email })
      return sendError(res, authError.message, 400)
    }

    await supabase
      .from('employees')
      .update({ user_id: authData.user!.id })
      .eq('employee_id', employee_id)

    // Assign default role (staff) to new user
    const { data: staffRole } = await supabase
      .from('perm_roles')
      .select('id')
      .eq('name', 'staff')
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
  }

  async login(req: Request, res: Response) {
    const { email, password } = req.body

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      logWarn('Login failed', { email, error: error.message })
      return sendError(res, 'Invalid credentials', 401)
    }

    logInfo('User logged in', { user_id: data.user.id, email })

    sendSuccess(res, {
      access_token: data.session.access_token,
      user: data.user
    }, 'Login successful')
  }

  async logout(req: Request, res: Response) {
    const userId = (req as any).user?.id
    await supabase.auth.signOut()
    logInfo('User logged out', { user_id: userId })
    sendSuccess(res, null, 'Logout successful')
  }

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    })

    if (error) {
      return sendError(res, error.message, 400)
    }

    sendSuccess(res, null, 'Password reset email sent')
  }

  async resetPassword(req: Request, res: Response) {
    const { password } = req.body

    const { error } = await supabase.auth.updateUser({
      password
    })

    if (error) {
      return sendError(res, error.message, 400)
    }

    sendSuccess(res, null, 'Password updated successfully')
  }
}

export const authController = new AuthController()