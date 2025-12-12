import { supabase } from '../../config/supabase'
import { Employee } from '../../types/employee.types'

export class EmployeesRepository {
  async findAll(pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }): Promise<{ data: Employee[]; total: number }> {
    let query = supabase.from('employees').select('*')
    
    if (sort) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    }
    
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
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

  async searchByName(searchTerm: string, pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: any): Promise<{ data: Employee[]; total: number }> {
    let query = supabase.from('employees').select('*')
    let countQuery = supabase.from('employees').select('*', { count: 'exact', head: true })
    
    if (searchTerm && searchTerm.trim()) {
      query = query.ilike('full_name', `%${searchTerm}%`)
      countQuery = countQuery.ilike('full_name', `%${searchTerm}%`)
    }
    
    if (filter) {
      if (filter.branch_name) {
        query = query.eq('branch_name', filter.branch_name)
        countQuery = countQuery.eq('branch_name', filter.branch_name)
      }
      if (filter.is_active !== undefined) {
        query = query.eq('is_active', filter.is_active)
        countQuery = countQuery.eq('is_active', filter.is_active)
      }
      if (filter.status_employee) {
        query = query.eq('status_employee', filter.status_employee)
        countQuery = countQuery.eq('status_employee', filter.status_employee)
      }
      if (filter.job_position) {
        query = query.eq('job_position', filter.job_position)
        countQuery = countQuery.eq('job_position', filter.job_position)
      }
    }
    
    if (sort) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
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

  async updateById(id: string, updates: Partial<Employee>): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', id)
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

  async uploadFile(fileName: string, buffer: Buffer, contentType: string) {
    return await supabase.storage
      .from('profile-pictures')
      .upload(fileName, buffer, { contentType, upsert: true })
  }

  getPublicUrl(fileName: string): string {
    const { data } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(fileName)
    return data.publicUrl
  }

  async getFilterOptions(): Promise<{ branches: string[]; positions: string[]; statuses: string[] }> {
    const [branchesRes, positionsRes] = await Promise.all([
      supabase.from('employees').select('branch_name').order('branch_name'),
      supabase.from('employees').select('job_position').order('job_position')
    ])

    const branches = [...new Set(branchesRes.data?.map(e => e.branch_name).filter(Boolean))] as string[]
    const positions = [...new Set(positionsRes.data?.map(e => e.job_position).filter(Boolean))] as string[]
    const statuses = ['Permanent', 'Contract']

    return { branches, positions, statuses }
  }

  async exportData(filter?: any): Promise<Employee[]> {
    let query = supabase.from('employees').select('*')
    
    if (filter) {
      if (filter.branch_name) query = query.eq('branch_name', filter.branch_name)
      if (filter.is_active !== undefined) query = query.eq('is_active', filter.is_active)
      if (filter.status_employee) query = query.eq('status_employee', filter.status_employee)
      if (filter.job_position) query = query.eq('job_position', filter.job_position)
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  }

  async bulkCreate(employees: Partial<Employee>[]): Promise<void> {
    const { error } = await supabase.from('employees').insert(employees)
    if (error) throw new Error(error.message)
  }

  async bulkUpdateActive(ids: string[], isActive: boolean): Promise<void> {
    const { error } = await supabase.from('employees').update({ is_active: isActive }).in('id', ids)
    if (error) throw new Error(error.message)
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const { error } = await supabase.from('employees').delete().in('id', ids)
    if (error) throw new Error(error.message)
  }

  async getLastEmployeeId(): Promise<string | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('employee_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data?.employee_id || null
  }
}

export const employeesRepository = new EmployeesRepository()
