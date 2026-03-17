import { supabase } from '../../../config/supabase'
import { logInfo, logError } from '../../../config/logger'
import type { 
  PosImport, 
  CreatePosImportDto, 
  UpdatePosImportDto,
  PosImportFilter 
} from './pos-imports.types'
import type { PaginationParams, SortParams } from '../../../types/request.types'

export class PosImportsRepository {

  async findAll(
    companyId: string,
    pagination: PaginationParams,
    sort?: SortParams,
    filter?: PosImportFilter
  ): Promise<{ data: PosImport[]; total: number }> {
    try {
      let query = supabase
        .from('pos_imports')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('is_deleted', false)

      if (filter?.branch_id) query = query.eq('branch_id', filter.branch_id)
      if (filter?.status) query = query.eq('status', filter.status)
      if (filter?.date_from) query = query.gte('date_range_start', filter.date_from)
      if (filter?.date_to) query = query.lte('date_range_end', filter.date_to)
      if (filter?.search) query = query.ilike('file_name', `%${filter.search}%`)

      if (sort?.field && sort?.order) {
        query = query.order(sort.field, { ascending: sort.order === 'asc' })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      query = query.range(
        (pagination.page - 1) * pagination.limit,
        pagination.page * pagination.limit - 1
      )

      const { data, error, count } = await query

      if (error) {
        logError('PosImportsRepository Supabase error', { 
          company_id: companyId, 
          error: error.message
        })
        throw new Error(`Database error: ${error.message}`)
      }

      const result = { data: data || [], total: count || 0 }

      logInfo('PosImportsRepository findAll success', {
        company_id: companyId,
        count: result.data.length,
        total: result.total
      })

      return result
    } catch (error) {
      logError('PosImportsRepository findAll error', { company_id: companyId, error })
      throw error
    }
  }

  async findById(id: string, companyId: string): Promise<PosImport | null> {
    try {
      const { data, error } = await supabase
        .from('pos_imports')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .eq('is_deleted', false)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      return data
    } catch (error) {
      logError('PosImportsRepository findById error', { id, error })
      throw error
    }
  }

  async findByIdOnly(id: string): Promise<PosImport | null> {
    try {
      const { data, error } = await supabase
        .from('pos_imports')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      return data
    } catch (error) {
      logError('PosImportsRepository findByIdOnly error', { id, error })
      throw error
    }
  }

  async findByIdWithLines(id: string, companyId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('pos_imports')
        .select('*, pos_import_lines(*)')
        .eq('id', id)
        .eq('company_id', companyId)
        .eq('is_deleted', false)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      return data
    } catch (error) {
      logError('PosImportsRepository findByIdWithLines error', { id, error })
      throw error
    }
  }

  async create(dto: CreatePosImportDto, userId: string): Promise<PosImport> {
    try {
      const { data, error } = await supabase
        .from('pos_imports')
        .insert({
          ...dto,
          created_by: userId,
          updated_by: userId
        })
        .select()
        .single()

      if (error) throw error

      logInfo('PosImportsRepository create success', { id: data.id })
      return data
    } catch (error) {
      logError('PosImportsRepository create error', { dto, error })
      throw error
    }
  }

  async update(id: string, companyId: string, updates: UpdatePosImportDto, userId: string): Promise<PosImport | null> {
    try {
      const { data, error } = await supabase
        .from('pos_imports')
        .update({
          ...updates,
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .eq('is_deleted', false)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      logInfo('PosImportsRepository update success', { id })
      return data
    } catch (error) {
      logError('PosImportsRepository update error', { id, error })
      throw error
    }
  }

  async delete(id: string, companyId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('pos_imports')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('company_id', companyId)

      if (error) throw error

      logInfo('PosImportsRepository delete success', { id })
    } catch (error) {
      logError('PosImportsRepository delete error', { id, error })
      throw error
    }
  }

  async restore(id: string, companyId: string, userId: string): Promise<PosImport | null> {
    try {
      const { data, error } = await supabase
        .from('pos_imports')
        .update({
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .eq('is_deleted', true)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      logInfo('PosImportsRepository restore success', { id })
      return data
    } catch (error) {
      logError('PosImportsRepository restore error', { id, error })
      throw error
    }
  }
}

export const posImportsRepository = new PosImportsRepository()