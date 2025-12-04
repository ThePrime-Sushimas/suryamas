import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { sendSuccess, sendError } from '../utils/response.util'

const router = Router()

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, employee_id } = req.body

  // Check if employee exists
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

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password
  })

  if (authError) {
    return sendError(res, authError.message, 400)
  }

  // Link user_id to employee
  await supabase
    .from('employees')
    .update({ user_id: authData.user!.id })
    .eq('employee_id', employee_id)

  sendSuccess(res, {
    user: authData.user,
    employee: employee.full_name
  }, 'Registration successful', 201)
})

router.post('/login', async (req: Request, res: Response) => {
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
})

router.post('/logout', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (token) {
    await supabase.auth.signOut()
  }

  sendSuccess(res, null, 'Logout successful')
})

// Helper: Check employee by ID
router.get('/check-employee/:employee_id', async (req: Request, res: Response) => {
  const { employee_id } = req.params

  const { data, error } = await supabase
    .from('employees')
    .select('employee_id, full_name, email, user_id')
    .eq('employee_id', employee_id)
    .maybeSingle()

  if (error) {
    return sendError(res, error.message, 500)
  }

  if (!data) {
    return sendError(res, 'Employee not found', 404)
  }

  sendSuccess(res, data)
})

export default router