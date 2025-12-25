import { supabase } from '../../config/supabase'
import { Branch, CreateBranchDto, UpdateBranchDto } from './branches.types'

export class BranchesRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any
  ): Promise<{ data: Branch[]; total: number }> {
    let query = supabase.from('branches').select('*')
    let countQuery = supabase.from('branches').select('*', { count: 'exact', head: true })

    if (filter) {
      if (filter.status) {
        query = query.eq('status', filter.status)
        countQuery = countQuery.eq('status', filter.status)
      }
      if (filter.company_id) {
        query = query.eq('company_id', filter.company_id)
        countQuery = countQuery.eq('company_id', filter.company_id)
      }
      if (filter.city) {
        query = query.eq('city', filter.city)
        countQuery = countQuery.eq('city', filter.city)
      }
      if (filter.hari_operasional) {
        query = query.eq('hari_operasional', filter.hari_operasional)
        countQuery = countQuery.eq('hari_operasional', filter.hari_operasional)
      }
    }

    if (sort) {
      const validFields = ['branch_name', 'branch_code', 'status', 'city', 'hari_operasional', 'created_at']
      if (validFields.includes(sort.field)) {
        query = query.order(sort.field, { ascending: sort.order === 'asc' })
      }
    } else {
      query = query.order('branch_name', { ascending: true })
    }

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery,
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)

    return { data: data || [], total: count || 0 }
  }

  async search(
    searchTerm: string,
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any
  ): Promise<{ data: Branch[]; total: number }> {
    let query = supabase.from('branches').select('*')
    let countQuery = supabase.from('branches').select('*', { count: 'exact', head: true })

    if (searchTerm && searchTerm.trim()) {
      const pattern = `%${searchTerm}%`
      query = query.or(`branch_name.ilike.${pattern},branch_code.ilike.${pattern}`)
      countQuery = countQuery.or(`branch_name.ilike.${pattern},branch_code.ilike.${pattern}`)
    }

    if (filter) {
      if (filter.status) {
        query = query.eq('status', filter.status)
        countQuery = countQuery.eq('status', filter.status)
      }
      if (filter.company_id) {
        query = query.eq('company_id', filter.company_id)
        countQuery = countQuery.eq('company_id', filter.company_id)
      }
      if (filter.city) {
        query = query.eq('city', filter.city)
        countQuery = countQuery.eq('city', filter.city)
      }
      if (filter.hari_operasional) {
        query = query.eq('hari_operasional', filter.hari_operasional)
        countQuery = countQuery.eq('hari_operasional', filter.hari_operasional)
      }
    }

    if (sort) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      query = query.order('branch_name', { ascending: true })
    }

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery,
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)

    return { data: data || [], total: count || 0 }
  }

  async findById(id: string): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByBranchCode(code: string): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('branch_code', code)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async create(data: CreateBranchDto): Promise<Branch> {
    const { data: branch, error } = await supabase
      .from('branches')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return branch
  }

  async updateById(id: string, updates: UpdateBranchDto): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('branches').delete().eq('id', id)

    if (error) {
      if (error.message.includes('violates foreign key constraint')) {
        throw new Error('Branch is referenced and cannot be deleted')
      }
      throw new Error(error.message)
    }
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    const { error } = await supabase
      .from('branches')
      .update({ status })
      .in('id', ids)

    if (error) throw new Error(error.message)
  }

  async exportData(filter?: any): Promise<Branch[]> {
    let query = supabase.from('branches').select('*')

    if (filter) {
      if (filter.status) query = query.eq('status', filter.status)
      if (filter.company_id) query = query.eq('company_id', filter.company_id)
      if (filter.city) query = query.eq('city', filter.city)
      if (filter.hari_operasional) query = query.eq('hari_operasional', filter.hari_operasional)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  }

  async getFilterOptions(): Promise<{ cities: string[]; statuses: string[]; hariOperasional: string[] }> {
    const { data, error } = await supabase
      .from('branches')
      .select('city, status, hari_operasional')

    if (error) throw new Error(error.message)

    const cities = [...new Set((data || []).map((b: any) => b.city).filter(Boolean))] as string[]
    const statuses = ['active', 'inactive', 'maintenance', 'closed']
    const hariOperasional = ['Senin-Jumat', 'Senin-Sabtu', 'Setiap Hari', 'Senin-Minggu']

    return { cities, statuses, hariOperasional }
  }

  async bulkCreate(branches: CreateBranchDto[]): Promise<void> {
    const { error } = await supabase.from('branches').insert(branches)
    if (error) throw new Error(error.message)
  }

  async minimalActive(): Promise<{ id: string; branch_name: string }[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('id, branch_name')
      .eq('status', 'active')
      .order('branch_name')
      .limit(1000)

    if (error) throw new Error(error.message)
    return data || []
  }
}

export const branchesRepository = new BranchesRepository()
