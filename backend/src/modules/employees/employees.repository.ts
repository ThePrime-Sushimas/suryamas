import { supabase } from '../../config/supabase'
import { Employee } from '../../types/employee.types'

export class EmployeesRepository {
  async create(data: Partial<Employee>): Promise<Employee | null> {
    const { data: employee, error } = await supabase
      .from('employees')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return employee
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

  async searchByName(searchTerm: string): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .textSearch('full_name', searchTerm, {
        type: 'websearch',  // Support: "Budi Sant", "Budi OR Santoso"
      })
      .limit(20)
  
    if (error) throw new Error(error.message)
    return data || []
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
