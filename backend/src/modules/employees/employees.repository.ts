import { supabase } from '../../config/supabase'
import { Employee } from '../../types/employee.types'

export class EmployeesRepository {
  async findAll(pagination: { limit: number; offset: number }): Promise<{ data: Employee[]; total: number }> {
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase.from('employees').select('*').range(pagination.offset, pagination.offset + pagination.limit - 1),
      supabase.from('employees').select('*', { count: 'exact', head: true })
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)
    
    return { data: data || [], total: count || 0 }
  }

  async create(data: Partial<Employee>): Promise<Employee | null> {
    const { data: employee, error } = await supabase
      .from('employees')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return employee
  }

  async findById(id: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByUserId(userId: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async searchByName(searchTerm: string, pagination: { limit: number; offset: number }): Promise<{ data: Employee[]; total: number }> {
    let query = supabase.from('employees').select('*')
    let countQuery = supabase.from('employees').select('*', { count: 'exact', head: true })
    
    if (searchTerm && searchTerm.trim()) {
      query = query.ilike('full_name', `%${searchTerm}%`)
      countQuery = countQuery.ilike('full_name', `%${searchTerm}%`)
    }
    
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery
    ])
  
    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)
    
    return { data: data || [], total: count || 0 }
  }

  async autocompleteName(query: string): Promise<{id: string, full_name: string}[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name')
      .ilike('full_name', `%${query}%`)
      .limit(10)
  
    if (error) throw new Error(error.message)
    return data || []
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async update(userId: string, updates: Partial<Employee>): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  }
}

export const employeesRepository = new EmployeesRepository()
