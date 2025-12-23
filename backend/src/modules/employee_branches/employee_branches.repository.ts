import { supabase } from '../../config/supabase'
import { EmployeeBranch, EmployeeBranchWithDetails } from './employee_branches.types'

export class EmployeeBranchesRepository {
  async findAll(pagination: { limit: number; offset: number }): Promise<{ data: EmployeeBranchWithDetails[]; total: number }> {
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase
        .from('employee_branches')
        .select(`
          id, employee_id, branch_id, is_primary, created_at,
          employees(full_name),
          branches(branch_name, branch_code)
        `)
        .order('created_at', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1),
      supabase.from('employee_branches').select('id', { count: 'exact', head: true })
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)

    const rows = (data || []).map((item: any) => ({
      ...item,
      employee_name: item.employees?.full_name,
      branch_name: item.branches?.branch_name,
      branch_code: item.branches?.branch_code,
      employees: undefined,
      branches: undefined
    }))

    return { data: rows as EmployeeBranchWithDetails[], total: count || 0 }
  }

  async findByEmployeeId(employeeId: string): Promise<EmployeeBranchWithDetails[]> {
    const { data, error } = await supabase
      .from('employee_branches')
      .select(`
        id, employee_id, branch_id, is_primary, created_at,
        employees(full_name),
        branches(branch_name, branch_code)
      `)
      .eq('employee_id', employeeId)
      .order('is_primary', { ascending: false })

    if (error) throw new Error(error.message)

    return (data || []).map((item: any) => ({
      ...item,
      employee_name: item.employees?.full_name,
      branch_name: item.branches?.branch_name,
      branch_code: item.branches?.branch_code,
      employees: undefined,
      branches: undefined
    })) as EmployeeBranchWithDetails[]
  }

  async findById(id: string): Promise<EmployeeBranchWithDetails | null> {
    const { data, error } = await supabase
      .from('employee_branches')
      .select(`
        id, employee_id, branch_id, is_primary, created_at,
        employees(full_name),
        branches(branch_name, branch_code)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null

    const item = data as any
    return {
      ...item,
      employee_name: item.employees?.full_name,
      branch_name: item.branches?.branch_name,
      branch_code: item.branches?.branch_code,
      employees: undefined,
      branches: undefined
    } as EmployeeBranchWithDetails
  }

  async findByBranchId(branchId: string, pagination: { limit: number; offset: number }): Promise<{ data: EmployeeBranchWithDetails[]; total: number }> {
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase
        .from('employee_branches')
        .select(`
          id, employee_id, branch_id, is_primary, created_at,
          employees(id, full_name, employee_id, job_position, email, mobile_phone),
          branches(branch_name, branch_code)
        `)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1),
      supabase.from('employee_branches').select('id', { count: 'exact', head: true }).eq('branch_id', branchId)
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)

    return { data: (data || []) as EmployeeBranchWithDetails[], total: count || 0 }
  }

  async findPrimaryBranch(employeeId: string): Promise<EmployeeBranchWithDetails | null> {
    const { data, error } = await supabase
      .from('employee_branches')
      .select(`
        id, employee_id, branch_id, is_primary, created_at,
        employees(full_name),
        branches(branch_name, branch_code)
      `)
      .eq('employee_id', employeeId)
      .eq('is_primary', true)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null

    const item = data as any
    return {
      ...item,
      employee_name: item.employees?.full_name,
      branch_name: item.branches?.branch_name,
      branch_code: item.branches?.branch_code,
      employees: undefined,
      branches: undefined
    } as EmployeeBranchWithDetails
  }

  async create(data: Partial<EmployeeBranch>): Promise<EmployeeBranch> {
    const { data: result, error } = await supabase
      .from('employee_branches')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return result
  }

  async update(id: string, updates: Partial<EmployeeBranch>): Promise<EmployeeBranch | null> {
    const { data, error } = await supabase
      .from('employee_branches')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('employee_branches')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  }

  async deleteByEmployeeAndBranch(employeeId: string, branchId: string): Promise<void> {
    const { error } = await supabase
      .from('employee_branches')
      .delete()
      .eq('employee_id', employeeId)
      .eq('branch_id', branchId)

    if (error) throw new Error(error.message)
  }

  async setPrimaryBranch(employeeId: string, branchId: string): Promise<void> {
    // Remove primary from all branches for this employee
    await supabase
      .from('employee_branches')
      .update({ is_primary: false })
      .eq('employee_id', employeeId)

    // Set new primary
    const { error } = await supabase
      .from('employee_branches')
      .update({ is_primary: true })
      .eq('employee_id', employeeId)
      .eq('branch_id', branchId)

    if (error) throw new Error(error.message)
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('employee_branches')
      .delete()
      .in('id', ids)

    if (error) throw new Error(error.message)
  }
}

export const employeeBranchesRepository = new EmployeeBranchesRepository()
