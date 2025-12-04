import { Response } from 'express'
import { supabase } from '../config/supabase'
import { AuthRequest } from '../middleware/auth'

export const getProfile = async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', req.user.id)
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

export const updateProfile = async (req: AuthRequest, res: Response) => {
  const { full_name, phone } = req.body
  
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ full_name, phone })
    .eq('user_id', req.user.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}