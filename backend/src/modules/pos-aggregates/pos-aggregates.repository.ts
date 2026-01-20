// backend/src/modules/pos-aggregates/pos-aggregates.repository.ts

import { supabase } from '@/config/supabase'
import {
  AggregatedTransaction,
  CreateAggregatedTransactionInput,
  UpdateAggregatedTransactionStatusInput,
} from './pos-aggregates.types'
import {
  PosAggregatesDuplicateSourceError,
  PosAggregatesPaymentMethodNotFoundError,
  PosAggregatesInternalError,
  PosAggregatesNotFoundError,
  PosAggregatesVersionConflictError,
} from './pos-aggregates.errors'

export class PosAggregatesRepository {
  private table = 'aggregated_transactions'

  constructor(private db = supabase) {}

  async findById(id: string): Promise<AggregatedTransaction | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data as AggregatedTransaction | null
  }

  async findBySource(
    sourceType: string,
    sourceId: string,
    sourceRef: string
  ): Promise<AggregatedTransaction | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('source_ref', sourceRef)
      .is('deleted_at', null)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data as AggregatedTransaction | null
  }

  async findByParentId(parentId: string): Promise<AggregatedTransaction[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('parent_id', parentId)
      .is('deleted_at', null)

    if (error) throw new PosAggregatesInternalError('Failed to fetch child transactions', error)
    return data as AggregatedTransaction[]
  }

  async insert(
    input: CreateAggregatedTransactionInput,
    userId?: string
  ): Promise<AggregatedTransaction> {
    try {
      const { data, error } = await this.db
        .from(this.table)
        .insert({
          ...input,
          status: 'READY',
          version: 1,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new PosAggregatesDuplicateSourceError(
            `${input.source_type}:${input.source_id}:${input.source_ref}`
          )
        }
        if (error.code === '23503') {
          throw new PosAggregatesPaymentMethodNotFoundError(input.payment_method_id)
        }
        throw new PosAggregatesInternalError('Failed to insert aggregated transaction', error)
      }

      return data as AggregatedTransaction
    } catch (err) {
      if (err instanceof PosAggregatesInternalError) throw err
      throw new PosAggregatesInternalError('Repository insert failed', err)
    }
  }

  async batchInsert(
    inputs: CreateAggregatedTransactionInput[],
    userId?: string
  ): Promise<AggregatedTransaction[]> {
    try {
      const { data, error } = await this.db
        .from(this.table)
        .insert(
          inputs.map((input) => ({
            ...input,
            status: 'READY',
            version: 1,
            created_by: userId,
            updated_by: userId,
          }))
        )
        .select()

      if (error) throw new PosAggregatesInternalError('Batch insert failed', error)
      return data as AggregatedTransaction[]
    } catch (err) {
      throw new PosAggregatesInternalError('Repository batch insert failed', err)
    }
  }

  async listByCompanyAndDate(params: {
    companyId: string
    fromDate: string
    toDate: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<{ data: AggregatedTransaction[]; total: number; hasMore: boolean }> {
    const { companyId, fromDate, toDate, status, limit = 50, offset = 0 } = params

    let query = this.db
      .from(this.table)
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .gte('transaction_date', fromDate)
      .lte('transaction_date', toDate)
      .is('deleted_at', null)

    if (status) query = query.eq('status', status)

    query = query.range(offset, offset + limit - 1).order('transaction_date', { ascending: true })

    const { data, count, error } = await query

    if (error) throw new PosAggregatesInternalError('Failed to fetch transactions', error)

    return {
      data: data as AggregatedTransaction[],
      total: count || 0,
      hasMore: count ? offset + limit < count : false,
    }
  }

  async updateWithVersion(
    id: string,
    input: UpdateAggregatedTransactionStatusInput,
    expectedVersion: number,
    userId?: string
  ): Promise<AggregatedTransaction> {
    const { data, error } = await this.db
      .from(this.table)
      .update({
        ...input,
        version: expectedVersion + 1,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .eq('version', expectedVersion)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      if (error.code === 'P0001') throw new PosAggregatesVersionConflictError(id, expectedVersion)
      throw new PosAggregatesInternalError('Failed to update transaction', error)
    }

    if (!data) throw new PosAggregatesNotFoundError(id)
    return data as AggregatedTransaction
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const { error } = await this.db
      .from(this.table)
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        updated_at: new Date().toISOString(),
        updated_by: userId,
        status: 'DELETED',
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) throw new PosAggregatesInternalError('Failed to soft delete transaction', error)
  }

  async findUnreconciled(params: {
    companyId: string
    paymentMethodId: number
    fromDate: string
    toDate: string
  }): Promise<AggregatedTransaction[]> {
    const { companyId, paymentMethodId, fromDate, toDate } = params
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('company_id', companyId)
      .eq('payment_method_id', paymentMethodId)
      .eq('status', 'READY')
      .gte('transaction_date', fromDate)
      .lte('transaction_date', toDate)
      .is('deleted_at', null)

    if (error) throw new PosAggregatesInternalError('Failed to fetch unreconciled transactions', error)
    return data as AggregatedTransaction[]
  }
}

export const posAggregatesRepository = new PosAggregatesRepository()

