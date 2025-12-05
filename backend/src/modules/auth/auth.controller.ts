import { Request, Response } from 'express'
import { supabase } from '../../config/supabase'
import { sendSuccess, sendError } from '../../utils/response.util'

export class AuthController {
  async register(req: Request, res: Response) {
    const { email, password, employee_id } = req.body

    const { data: employee } = await supabase
      .from('employees')
      .select('*')
      .eq('employee_id', employee_id)
      .maybeSingle()

    if (!employee) {
      return sendError(res, 'Employee not found', 404)
    }

    if (employee.user_id) {
      return sendError(res, 'Employee already has an account', 400)
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    })

    if (authError) {
      return sendError(res, authError.message, 400)
    }

    await supabase
      .from('employees')
      .update({ user_id: authData.user!.id })
      .eq('employee_id', employee_id)

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
      return sendError(res, 'Invalid credentials', 401)
    }

    sendSuccess(res, {
      access_token: data.session.access_token,
      user: data.user
    }, 'Login successful')
  }

  async logout(req: Request, res: Response) {
    await supabase.auth.signOut()
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