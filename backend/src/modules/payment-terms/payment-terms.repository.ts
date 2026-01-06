// backend/src/modules/payment-terms/payment-terms.repository.ts

import { supabase } from '../../config/supabase'
import { PaymentTerm, CreatePaymentTermDto, UpdatePaymentTermDto, CalculationType } from './payment-terms.types'
import { mapPaymentTermFromDb } from './payment-terms.mapper'

export class PaymentTermsRepository {
  async findAll(
    pagination: { limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: { is_active?: boolean; calculation_type?: CalculationType },
    includeDeleted = false
  ): Promise<{ data: PaymentTerm[]; total: number }> {
    let query = supabase.from('payment_terms').select('*')
    let countQuery = supabase.from('payment_terms').select('*', { count: 'exact', head: true })

    if (!includeDeleted) {
      query = query.is('deleted_at', null)
      countQuery = countQuery.is('deleted_at', null)
    }

    if (filter?.is_active !== undefined) {
      query = query.eq('is_active', filter.is_active)
      countQuery = countQuery.eq('is_active', filter.is_active)
    }

    if (filter?.calculation_type) {
      query = query.eq('calculation_type', filter.calculation_type)
      countQuery = countQuery.eq('calculation_type', filter.calculation_type)
    }

    if (sort) {
      query = query.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      query = query.order('term_name', { ascending: true })
    }

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query.range(pagination.offset, pagination.offset + pagination.limit - 1),
      countQuery,
    ])

    if (error) throw new Error(error.message)
    if (countError) throw new Error(countError.message)

    return { data: (data || []).map(mapPaymentTermFromDb), total: count || 0 }
  }

  async findById(id: number, includeDeleted = false): Promise<PaymentTerm | null> {
    let query = supabase
      .from('payment_terms')
      .select('*')
      .eq('id_payment_term', id)

    if (!includeDeleted) {
      query = query.is('deleted_at', null)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    return mapPaymentTermFromDb(data)
  }

  async findByTermCode(code: string): Promise<PaymentTerm | null> {
    const { data, error } = await supabase
      .from('payment_terms')
      .select('*')
      .eq('term_code', code)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    return mapPaymentTermFromDb(data)
  }

  async create(data: CreatePaymentTermDto & { created_by?: string }): Promise<PaymentTerm> {
    const { data: term, error } = await supabase
      .from('payment_terms')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return mapPaymentTermFromDb(term)
  }

  async updateById(id: number, updates: UpdatePaymentTermDto): Promise<PaymentTerm | null> {
    const { data, error } = await supabase
      .from('payment_terms')
      .update(updates)
      .eq('id_payment_term', id)
      .is('deleted_at', null)
      .select()
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data ? mapPaymentTermFromDb(data) : null
  }

  async delete(id: number, userId?: string): Promise<void> {
    const { error } = await supabase
      .from('payment_terms')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id_payment_term', id)

    if (error) throw new Error(error.message)
  }

  async restore(id: number): Promise<void> {
    const { error } = await supabase
      .from('payment_terms')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id_payment_term', id)

    if (error) throw new Error(error.message)
  }

  async minimalActive(): Promise<{ id: number; term_name: string }[]> {
    const { data, error } = await supabase
      .from('payment_terms')
      .select('id_payment_term, term_name')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('term_name')
      .limit(1000)

    if (error) throw new Error(error.message)
    return (data || []).map((row) => ({ id: row.id_payment_term, term_name: row.term_name }))
  }
}

export const paymentTermsRepository = new PaymentTermsRepository()
