import { supabase } from '../../config/supabase'
import { Company, CreateCompanyDTO, UpdateCompanyDTO } from './companies.types'

export class CompaniesRepository {
  async findAll(pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: any): Promise<{ data: Company[]; total: number }> {
    let query = supabase.from('companies').select('*')
    let countQuery = supabase.from('companies').select('*', { count: 'exact', head: true })
    
    if (filter) {
      if (filter.status) {
        query = query.eq('status', filter.status)
        countQuery = countQuery.eq('status', filter.status)
      }
      if (filter.company_type) {
        query = query.eq('company_type', filter.company_type)
        countQuery = countQuery.eq('company_type', filter.company_type)
      }
    }
    
    if (sort) {
      const validFields = ['company_name', 'company_code', 'status', 'company_type', 'created_at']
      if (validFields.includes(sort.field)) {
        query = query.order(sort.field, { ascending: sort.order === 'asc' })
      }
    } else {
      query = query.order('company_name', { ascending: true })
    }
    
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)
    
    return { data: data || [], total: count || 0 }
  }

  async search(searchTerm: string, pagination: { limit: number; offset: number }, sort?: { field: string; order: 'asc' | 'desc' }, filter?: any): Promise<{ data: Company[]; total: number }> {
    let query = supabase.from('companies').select('*')
    let countQuery = supabase.from('companies').select('*', { count: 'exact', head: true })
    
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm}%`
      query = query.or(`company_name.ilike.${searchPattern},company_code.ilike.${searchPattern}`)
      countQuery = countQuery.or(`company_name.ilike.${searchPattern},company_code.ilike.${searchPattern}`)
    }
    
    if (filter) {
      if (filter.status) {
        query = query.eq('status', filter.status)
        countQuery = countQuery.eq('status', filter.status)
      }
      if (filter.company_type) {
        query = query.eq('company_type', filter.company_type)
        countQuery = countQuery.eq('company_type', filter.company_type)
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

  async create(data: CreateCompanyDTO): Promise<Company | null> {
    const { data: company, error } = await supabase
      .from('companies')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return company
  }

  invalidateCache(): void {
    // Placeholder for future cache invalidation if needed
  }

  async findById(id: string): Promise<Company | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByCode(code: string): Promise<Company | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('company_code', code)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async findByNpwp(npwp: string): Promise<Company | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('npwp', npwp)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

  async update(id: string, updates: UpdateCompanyDTO): Promise<Company | null> {
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    this.invalidateCache()
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
    this.invalidateCache()
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update({ status })
      .in('id', ids)

    if (error) throw new Error(error.message)
    this.invalidateCache()
  }

  async bulkDelete(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .delete()
      .in('id', ids)

    if (error) throw new Error(error.message)
    this.invalidateCache()
  }

  async exportData(filter?: any): Promise<Company[]> {
    let query = supabase.from('companies').select('*')
    
    if (filter) {
      if (filter.status) query = query.eq('status', filter.status)
      if (filter.company_type) query = query.eq('company_type', filter.company_type)
    }
    
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data || []
  }

  async bulkCreate(companies: CreateCompanyDTO[]): Promise<void> {
    const { error } = await supabase.from('companies').insert(companies)
    if (error) throw new Error(error.message)
  }

  async getFilterOptions(): Promise<{ statuses: string[]; types: string[] }> {
    const statuses = ['active', 'inactive', 'suspended', 'closed']
    const types = ['PT', 'CV', 'Firma', 'Koperasi', 'Yayasan']
    return { statuses, types }
  }
}

export const companiesRepository = new CompaniesRepository()
