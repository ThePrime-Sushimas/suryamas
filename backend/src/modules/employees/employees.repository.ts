import { supabase } from '../../config/supabase'
import { Employee, EmployeeWithBranch } from './employees.types'

export class EmployeesRepository {
  private static filterOptionsCache: any = null
  private static filterOptionsCacheExpiry = 0
  private static readonly CACHE_TTL = 30 * 60 * 1000 // 30 minutes

  async findAll(pagination: { page: number; limit: number }): Promise<{ data: EmployeeWithBranch[]; total: number }> {
    let query = supabase.from('employees').select(`
      id, employee_id, full_name, job_position, join_date, resign_date, status_employee,
      end_date, sign_date, email, birth_date, birth_place, citizen_id_address,
      ptkp_status, bank_name, bank_account, bank_account_holder, nik, mobile_phone,
      brand_name, religion, gender, marital_status, profile_picture,
      created_at, updated_at, user_id, is_active,
      employee_branches(branch_id, is_primary, branches(id, branch_name, branch_code, city))
    `, { count: 'exact' })
    .order('full_name', { ascending: true })
    
    const offset = (pagination.page - 1) * pagination.limit
    const { data, error, count } = await query.range(offset, offset + pagination.limit - 1)

    if (error) throw new Error(error.message)
    
    const rows = (data || []).map((e: any) => {
      // Find primary branch assignment (is_primary = true)
      const primaryBranch = e.employee_branches?.find((eb: any) => eb.is_primary)?.branches
      const out: any = {
        ...e,
        branch_name: primaryBranch?.branch_name ?? null,
        branch_code: primaryBranch?.branch_code ?? null,
        branch_city: primaryBranch?.city ?? null,
      }
      delete out.employee_branches
      return out
    })
    
    return { data: rows as EmployeeWithBranch[], total: count || 0 }
  }

  async findUnassigned(pagination: { page: number; limit: number }): Promise<{ data: EmployeeWithBranch[]; total: number }> {
    let query = supabase.from('employees').select(`
      id, employee_id, full_name, job_position, join_date, resign_date, status_employee,
      end_date, sign_date, email, birth_date, birth_place, citizen_id_address,
      ptkp_status, bank_name, bank_account, bank_account_holder, nik, mobile_phone,
      brand_name, religion, gender, marital_status, profile_picture,
      created_at, updated_at, user_id, is_active,
      employee_branches(id)
    `)
    .order('full_name', { ascending: true })
    
    const { data: allEmployees, error } = await query
    if (error) throw new Error(error.message)
    
    // Filter employees without any branch assignments
    const unassigned = (allEmployees || []).filter((e: any) => !e.employee_branches || e.employee_branches.length === 0)
    
    // Apply pagination after filtering
    const offset = (pagination.page - 1) * pagination.limit
    const total = unassigned.length
    const paginatedData = unassigned.slice(offset, offset + pagination.limit)
    
    const rows = paginatedData.map((e: any) => {
      const { employee_branches, ...rest } = e
      return {
        ...rest,
        branch_name: null,
        branch_code: null,
        branch_city: null,
      }
    })
    
    return { data: rows as EmployeeWithBranch[], total }
  }

  async create(data: Partial<Employee>): Promise<Employee | null> {
    const { data: employee, error } = await supabase
      .from('employees')
      .insert(data)
      .select()
      .single()

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error('Employee ID already exists')
      }
      throw new Error(error.message)
    }
    EmployeesRepository.filterOptionsCache = null
    return employee
  }

  async findById(id: string): Promise<EmployeeWithBranch | null> {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        id, employee_id, full_name, job_position, join_date, resign_date, status_employee,
        end_date, sign_date, email, birth_date, birth_place, citizen_id_address,
        ptkp_status, bank_name, bank_account, bank_account_holder, nik, mobile_phone,
        brand_name, religion, gender, marital_status, profile_picture,
        created_at, updated_at, user_id, is_active,
        employee_branches(branch_id, is_primary, branches(id, branch_name, branch_code, city))
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    
    const primaryBranch = (data as any).employee_branches?.find((eb: any) => eb.is_primary)?.branches
    const out: any = {
      ...data,
      branch_name: primaryBranch?.branch_name ?? null,
      branch_code: primaryBranch?.branch_code ?? null,
      branch_city: primaryBranch?.city ?? null,
    }
    delete out.employee_branches
    return out
  }

  async findByUserId(userId: string): Promise<EmployeeWithBranch | null> {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        id, employee_id, full_name, job_position, join_date, resign_date, status_employee,
        end_date, sign_date, email, birth_date, birth_place, citizen_id_address,
        ptkp_status, bank_name, bank_account, bank_account_holder, nik, mobile_phone,
        brand_name, religion, gender, marital_status, profile_picture,
        created_at, updated_at, user_id, is_active,
        employee_branches(branch_id, is_primary, branches(id, branch_name, branch_code, city))
      `)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    
    const primaryBranch = (data as any).employee_branches?.find((eb: any) => eb.is_primary)?.branches
    const out: any = {
      ...data,
      branch_name: primaryBranch?.branch_name ?? null,
      branch_code: primaryBranch?.branch_code ?? null,
      branch_city: primaryBranch?.city ?? null,
    }
    delete out.employee_branches
    return out
  }

  async searchByName(searchTerm: string, pagination: { page: number; limit: number }, filter?: any): Promise<{ data: EmployeeWithBranch[]; total: number }> {
    const hasBranchFilter = filter?.branch_name
    
    let query = supabase.from('employees').select(`
      id, employee_id, full_name, job_position, join_date, resign_date, status_employee,
      end_date, sign_date, email, birth_date, birth_place, citizen_id_address,
      ptkp_status, bank_name, bank_account, bank_account_holder, nik, mobile_phone,
      brand_name, religion, gender, marital_status, profile_picture,
      created_at, updated_at, user_id, is_active,
      employee_branches(branch_id, is_primary, branches(id, branch_name, branch_code, city))
    `, { count: 'exact' })
    .order('full_name', { ascending: true })
    
    const offset = (pagination.page - 1) * pagination.limit
    const { data, error, count } = await query.range(offset, offset + pagination.limit - 1)
  
    if (error) throw new Error(error.message)
    
    const rows = (data || []).map((e: any) => {
      // Find primary branch assignment (is_primary = true)
      const primaryBranch = e.employee_branches?.find((eb: any) => eb.is_primary)?.branches
      const out: any = {
        ...e,
        branch_name: primaryBranch?.branch_name ?? null,
        branch_code: primaryBranch?.branch_code ?? null,
        branch_city: primaryBranch?.city ?? null,
      }
      delete out.employee_branches
      return out
    })

    return { data: rows as EmployeeWithBranch[], total: count || 0 }
  }

  async autocompleteName(query: string): Promise<{id: string, full_name: string}[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name')
      .ilike('full_name', `%${query}%`)
      .order('full_name', { ascending: true })
  
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
    EmployeesRepository.filterOptionsCache = null
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
    EmployeesRepository.filterOptionsCache = null
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)

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
    const { data } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(fileName)
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

  async exportData(filter?: any): Promise<EmployeeWithBranch[]> {
    const hasBranchFilter = filter?.branch_name
    
    let query = supabase.from('employees').select(`
      id, employee_id, full_name, job_position, join_date, resign_date, status_employee,
      end_date, sign_date, email, birth_date, birth_place, citizen_id_address,
      ptkp_status, bank_name, bank_account, bank_account_holder, nik, mobile_phone,
      brand_name, religion, gender, marital_status, profile_picture,
      created_at, updated_at, user_id, is_active,
      employee_branches${hasBranchFilter ? '!inner' : ''}(branch_id, is_primary, branches(id, branch_name, branch_code, city))
    `)
    
    if (filter) {
      if (filter.branch_name) query = query.eq('employee_branches.branches.branch_name', filter.branch_name)
      if (filter.is_active !== undefined) query = query.eq('is_active', filter.is_active)
      if (filter.status_employee) query = query.eq('status_employee', filter.status_employee)
      if (filter.job_position) query = query.eq('job_position', filter.job_position)
    }
    
    query = query.eq('employee_branches.is_primary', true)
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    
    const rows = (data || []).map((e: any) => {
      const primaryBranch = e.employee_branches?.find((eb: any) => eb.is_primary)?.branches
      const out: any = {
        ...e,
        branch_name: primaryBranch?.branch_name ?? null,
        branch_code: primaryBranch?.branch_code ?? null,
        branch_city: primaryBranch?.city ?? null,
      }
      delete out.employee_branches
      return out
    })
    return rows as EmployeeWithBranch[]
  }

  async bulkCreate(employees: Partial<Employee>[]): Promise<void> {
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
}

export const employeesRepository = new EmployeesRepository()
