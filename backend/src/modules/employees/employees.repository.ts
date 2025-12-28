import { supabase } from '../../config/supabase'
import { EmployeeDB, EmployeeWithBranch, EmployeeFilter, PaginationParams } from './employees.types'

export class EmployeesRepository {
  private static filterOptionsCache: any = null
  private static filterOptionsCacheExpiry = 0
  private static readonly CACHE_TTL = 30 * 60 * 1000

  async findAll(params: PaginationParams): Promise<{ data: EmployeeWithBranch[]; total: number }> {
    const { page, limit, sort = 'full_name', order = 'asc' } = params
    
    let query = supabase.from('employees').select(`
      *, employee_branches(branch_id, is_primary, branches(id, branch_name, branch_code, city))
    `, { count: 'exact' })
    .order(sort, { ascending: order === 'asc' })
    .range((page - 1) * limit, page * limit - 1)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)
    
    return { data: this.mapWithBranch(data || []), total: count || 0 }
  }

  async findUnassigned(params: { page: number; limit: number }): Promise<{ data: EmployeeWithBranch[]; total: number }> {
    const { data, error } = await supabase.from('employees').select(`
      *, employee_branches(id)
    `).order('full_name')
    
    if (error) throw new Error(error.message)
    
    const unassigned = (data || []).filter((e: any) => !e.employee_branches?.length)
    const offset = (params.page - 1) * params.limit
    const total = unassigned.length
    const paginatedData = unassigned.slice(offset, offset + params.limit)
    
    return { 
      data: paginatedData.map(e => ({ ...e, branch_name: null, branch_code: null, branch_city: null })), 
      total 
    }
  }

  async create(data: Partial<EmployeeDB>): Promise<EmployeeDB> {
    const { data: employee, error } = await supabase
      .from('employees')
      .insert(data)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') throw new Error('Employee ID already exists')
      throw new Error(error.message)
    }
    
    EmployeesRepository.filterOptionsCache = null
    return employee
  }

  async findById(id: string): Promise<EmployeeWithBranch | null> {
    const { data, error } = await supabase
      .from('employees')
      .select(`*, employee_branches(branch_id, is_primary, branches(id, branch_name, branch_code, city))`)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    
    return this.mapWithBranch([data])[0]
  }

  async findByUserId(userId: string): Promise<EmployeeWithBranch | null> {
    const { data, error } = await supabase
      .from('employees')
      .select(`*, employee_branches(branch_id, is_primary, branches(id, branch_name, branch_code, city))`)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    
    return this.mapWithBranch([data])[0]
  }

  async search(searchTerm: string, params: PaginationParams, filter?: EmployeeFilter): Promise<{ data: EmployeeWithBranch[]; total: number }> {
    const { page, limit, sort = 'full_name', order = 'asc' } = params
    const hasBranchFilter = !!filter?.branch_name
    
    let query = supabase.from('employees').select(`
      *, employee_branches${hasBranchFilter ? '!inner' : ''}(branch_id, is_primary, branches(id, branch_name, branch_code, city))
    `, { count: 'exact' })
    
    if (searchTerm) {
      query = query.or(`employee_id.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,mobile_phone.ilike.%${searchTerm}%`)
    }
    
    if (filter) {
      if (filter.branch_name) query = query.eq('employee_branches.branches.branch_name', filter.branch_name).eq('employee_branches.is_primary', true)
      if (filter.job_position) query = query.ilike('job_position', filter.job_position)
      if (filter.status_employee) query = query.eq('status_employee', filter.status_employee)
      if (filter.is_active !== undefined) query = query.eq('is_active', filter.is_active)
    }
    
    query = query.order(sort, { ascending: order === 'asc' }).range((page - 1) * limit, page * limit - 1)
    
    const { data, error, count } = await query
    if (error) throw new Error(error.message)
    
    return { data: this.mapWithBranch(data || []), total: count || 0 }
  }

  async autocomplete(query: string): Promise<{ id: string; full_name: string }[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name')
      .ilike('full_name', `%${query}%`)
      .order('full_name')
      .limit(10)
  
    if (error) throw new Error(error.message)
    return data || []
  }

  async update(userId: string, updates: Partial<EmployeeDB>): Promise<EmployeeDB> {
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    EmployeesRepository.filterOptionsCache = null
    return data
  }

  async updateById(id: string, updates: Partial<EmployeeDB>): Promise<EmployeeDB> {
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    EmployeesRepository.filterOptionsCache = null
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) throw new Error(error.message)
    EmployeesRepository.filterOptionsCache = null
  }

  async uploadFile(fileName: string, buffer: Buffer, contentType: string) {
    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .upload(fileName, buffer, { contentType, upsert: true })
    if (error) throw new Error(error.message)
    return data
  }

  getPublicUrl(fileName: string): string {
    const { data } = supabase.storage.from('profile-pictures').getPublicUrl(fileName)
    return data.publicUrl
  }

  async getFilterOptions(): Promise<{ branches: any[]; positions: string[]; statuses: string[] }> {
    if (EmployeesRepository.filterOptionsCache && EmployeesRepository.filterOptionsCacheExpiry > Date.now()) {
      return EmployeesRepository.filterOptionsCache
    }

    const [{ data: employeeData }, { data: branchData }] = await Promise.all([
      supabase.from('employees').select('job_position').eq('is_active', true),
      supabase.from('branches').select('id, branch_name').eq('status', 'active').order('branch_name')
    ])

    const branches = branchData?.map((b: any) => ({ id: b.id, branch_name: b.branch_name })) || []
    const positions = [...new Set(employeeData?.map((e: any) => e.job_position?.toLowerCase()).filter(Boolean))] as string[]
    positions.sort()
    const statuses = ['Permanent', 'Contract']

    const result = { branches, positions, statuses }
    EmployeesRepository.filterOptionsCache = result
    EmployeesRepository.filterOptionsCacheExpiry = Date.now() + EmployeesRepository.CACHE_TTL

    return result
  }

  async exportData(filter?: EmployeeFilter): Promise<EmployeeWithBranch[]> {
    const hasBranchFilter = !!filter?.branch_name
    
    let query = supabase.from('employees').select(`
      *, employee_branches${hasBranchFilter ? '!inner' : ''}(branch_id, is_primary, branches(id, branch_name, branch_code, city))
    `)
    
    if (filter) {
      if (filter.search) query = query.or(`employee_id.ilike.%${filter.search}%,full_name.ilike.%${filter.search}%,email.ilike.%${filter.search}%,mobile_phone.ilike.%${filter.search}%`)
      if (filter.branch_name) query = query.eq('employee_branches.branches.branch_name', filter.branch_name).eq('employee_branches.is_primary', true)
      if (filter.is_active !== undefined) query = query.eq('is_active', filter.is_active)
      if (filter.status_employee) query = query.eq('status_employee', filter.status_employee)
      if (filter.job_position) query = query.eq('job_position', filter.job_position)
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    
    return this.mapWithBranch(data || [])
  }

  async bulkCreate(employees: Partial<EmployeeDB>[]): Promise<void> {
    const { error } = await supabase.from('employees').insert(employees)
    if (error) throw new Error(error.message)
    EmployeesRepository.filterOptionsCache = null
  }

  async bulkUpdateActive(ids: string[], isActive: boolean): Promise<void> {
    const { error } = await supabase.from('employees').update({ is_active: isActive }).in('id', ids)
    if (error) throw new Error(error.message)
    EmployeesRepository.filterOptionsCache = null
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const { error } = await supabase.from('employees').delete().in('id', ids)
    if (error) throw new Error(error.message)
    EmployeesRepository.filterOptionsCache = null
  }

  private mapWithBranch(data: any[]): EmployeeWithBranch[] {
    return data.map((e: any) => {
      const primaryBranch = e.employee_branches?.find((eb: any) => eb.is_primary)?.branches
      const { employee_branches, ...rest } = e
      return {
        ...rest,
        branch_name: primaryBranch?.branch_name ?? null,
        branch_code: primaryBranch?.branch_code ?? null,
        branch_city: primaryBranch?.city ?? null,
      }
    })
  }
}

export const employeesRepository = new EmployeesRepository()
