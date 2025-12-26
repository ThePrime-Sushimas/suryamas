import { supabase } from '../../config/supabase'
import { EmployeeBranchEntity, EmployeeBranchWithRelations } from './employee_branches.types'
import { mapEmployeeBranch } from './employee_branches.mapper'

export class EmployeeBranchesRepository {
  private baseSelect = `
    id, employee_id, branch_id, is_primary, created_at,
    employees!inner(full_name),
    branches!inner(branch_name, branch_code)
  `

  async findAll(limit: number, offset: number): Promise<{ data: EmployeeBranchWithRelations[]; total: number }> {
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase
        .from('employee_branches')
        .select(this.baseSelect)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase.from('employee_branches').select('id', { count: 'exact', head: true })
    ])

    if (error) throw error
    if (countError) throw countError

    return { data: (data || []).map(mapEmployeeBranch), total: count || 0 }
  }

  async findByEmployeeId(employeeId: string): Promise<EmployeeBranchWithRelations[]> {
    const { data, error } = await supabase
      .from('employee_branches')
      .select(this.baseSelect)
      .eq('employee_id', employeeId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(mapEmployeeBranch)
  }

  async findById(id: string): Promise<EmployeeBranchWithRelations | null> {
    const { data, error } = await supabase
      .from('employee_branches')
      .select(this.baseSelect)
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data ? mapEmployeeBranch(data) : null
  }

  async findByBranchId(branchId: string, limit: number, offset: number): Promise<{ data: EmployeeBranchWithRelations[]; total: number }> {
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase
        .from('employee_branches')
        .select(this.baseSelect)
        .eq('branch_id', branchId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase.from('employee_branches').select('id', { count: 'exact', head: true }).eq('branch_id', branchId)
    ])

    if (error) throw error
    if (countError) throw countError

    return { data: (data || []).map(mapEmployeeBranch), total: count || 0 }
  }

  async findPrimaryBranch(employeeId: string): Promise<EmployeeBranchWithRelations | null> {
    const { data, error } = await supabase
      .from('employee_branches')
      .select(this.baseSelect)
      .eq('employee_id', employeeId)
      .eq('is_primary', true)
      .maybeSingle()

    if (error) throw error
    return data ? mapEmployeeBranch(data) : null
  }

  async findByEmployeeAndBranch(employeeId: string, branchId: string): Promise<EmployeeBranchEntity | null> {
    const { data, error } = await supabase
      .from('employee_branches')
      .select('id, employee_id, branch_id, is_primary, created_at')
      .eq('employee_id', employeeId)
      .eq('branch_id', branchId)
      .maybeSingle()

    if (error) throw error
    return data as EmployeeBranchEntity | null
  }

  async employeeExists(employeeId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('id', employeeId)

    if (error) throw error
    return (count || 0) > 0
  }

  async branchExists(branchId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('branches')
      .select('id', { count: 'exact', head: true })
      .eq('id', branchId)

    if (error) throw error
    return (count || 0) > 0
  }

  async create(data: Omit<EmployeeBranchEntity, 'id' | 'created_at'>): Promise<EmployeeBranchEntity> {
    const { data: result, error } = await supabase
      .from('employee_branches')
      .insert(data)
      .select('id, employee_id, branch_id, is_primary, created_at')
      .single()

    if (error) throw error
    return result as EmployeeBranchEntity
  }

  async update(id: string, updates: Partial<Pick<EmployeeBranchEntity, 'is_primary'>>): Promise<EmployeeBranchEntity | null> {
    const { data, error } = await supabase
      .from('employee_branches')
      .update(updates)
      .eq('id', id)
      .select('id, employee_id, branch_id, is_primary, created_at')
      .maybeSingle()

    if (error) throw error
    return data as EmployeeBranchEntity | null
  }

  async setPrimaryBranch(employeeId: string, branchId: string): Promise<void> {
    const { error } = await supabase.rpc('set_primary_employee_branch', {
      p_employee_id: employeeId,
      p_branch_id: branchId
    })

    if (error) throw error
  }

  async unsetPrimaryForEmployee(employeeId: string): Promise<void> {
    const { error } = await supabase
      .from('employee_branches')
      .update({ is_primary: false })
      .eq('employee_id', employeeId)

    if (error) throw error
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('employee_branches')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async deleteByEmployeeAndBranch(employeeId: string, branchId: string): Promise<void> {
    const { error } = await supabase
      .from('employee_branches')
      .delete()
      .eq('employee_id', employeeId)
      .eq('branch_id', branchId)

    if (error) throw error
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('employee_branches')
      .delete()
      .in('id', ids)

    if (error) throw error
  }
}

export const employeeBranchesRepository = new EmployeeBranchesRepository()
