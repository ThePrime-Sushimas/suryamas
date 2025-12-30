// =====================================================
// MODULES REPOSITORY
// Responsibility: Module database operations only
// =====================================================

import { supabase } from '../../config/supabase'
import type { Module, CreateModuleDto } from './permissions.types'

export class ModulesRepository {
  async getAll(): Promise<Module[]> {
    const { data, error } = await supabase
      .from('perm_modules')
      .select('*')
      .order('name')

    if (error) throw error
    return (data as Module[]) || []
  }

  async findById(id: string): Promise<Module | null> {
    const { data, error } = await supabase
      .from('perm_modules')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null
    return data as Module
  }

  async getByName(name: string): Promise<Module | null> {
    const { data, error } = await supabase
      .from('perm_modules')
      .select('*')
      .eq('name', name)
      .single()

    if (error) return null
    return data as Module
  }

  async create(dto: CreateModuleDto): Promise<Module> {
    const { data, error } = await supabase
      .from('perm_modules')
      .insert(dto)
      .select()
      .single()

    if (error) throw error
    return data as Module
  }

  async update(id: string, updates: Partial<Module>): Promise<Module> {
    const { data, error } = await supabase
      .from('perm_modules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Module
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase.from('perm_modules').delete().eq('id', id)
    return !error
  }
}
