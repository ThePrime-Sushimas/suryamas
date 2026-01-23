import { supabase } from '../../../config/supabase'
import { DatabaseError } from '../../../utils/error-handler.util'
import { 
  AggregatedTransaction, 
  AggregatedTransactionWithDetails,
  AggregatedTransactionListItem,
  AggregatedTransactionFilterParams,
  AggregatedTransactionSortParams,
  AggregatedTransactionStatus,
  AggregatedTransactionSourceType
} from './pos-aggregates.types'
import { AggregatedTransactionErrors } from './pos-aggregates.errors'

export class PosAggregatesRepository {
  /**
   * Find all aggregated transactions with pagination and filters
   */
  async findAll(
    pagination: { limit: number; offset: number },
    filter?: AggregatedTransactionFilterParams,
    sort?: AggregatedTransactionSortParams
  ): Promise<{ data: AggregatedTransactionListItem[]; total: number }> {
    let dbQuery = supabase
      .from('aggregated_transactions')
      .select(`
        id,
        branch_name,
        source_type,
        source_id,
        source_ref,
        transaction_date,
        payment_method_id,
        gross_amount,
        discount_amount,
        tax_amount,
        service_charge_amount,
        net_amount,
        currency,
        status,
        is_reconciled,
        created_at,
        version,
        payment_methods(id, code, name)
      `, { count: 'exact' })

    // Apply filters

    if (filter?.branch_name !== undefined) {
      if (filter.branch_name === null) {
        dbQuery = dbQuery.is('branch_name', null)
      } else {
        dbQuery = dbQuery.eq('branch_name', filter.branch_name)
      }
    }

    if (filter?.source_type) {
      dbQuery = dbQuery.eq('source_type', filter.source_type)
    }

    if (filter?.source_id) {
      dbQuery = dbQuery.eq('source_id', filter.source_id)
    }

    if (filter?.payment_method_id) {
      dbQuery = dbQuery.eq('payment_method_id', filter.payment_method_id)
    }

    if (filter?.transaction_date) {
      dbQuery = dbQuery.eq('transaction_date', filter.transaction_date)
    }

    if (filter?.transaction_date_from) {
      dbQuery = dbQuery.gte('transaction_date', filter.transaction_date_from)
    }

    if (filter?.transaction_date_to) {
      dbQuery = dbQuery.lte('transaction_date', filter.transaction_date_to)
    }

    if (filter?.status) {
      dbQuery = dbQuery.eq('status', filter.status)
    }

    if (filter?.is_reconciled !== undefined) {
      dbQuery = dbQuery.eq('is_reconciled', filter.is_reconciled)
    }

    if (filter?.has_journal !== undefined) {
      if (filter.has_journal) {
        dbQuery = dbQuery.not('journal_id', 'is', null)
      } else {
        dbQuery = dbQuery.is('journal_id', null)
      }
    }

    if (filter?.search) {
      dbQuery = dbQuery.or(`source_ref.ilike.%${filter.search}%,branch_name.ilike.%${filter.search}%`)
    }

    // Soft delete filter - exclude deleted by default
    if (!filter?.show_deleted) {
      dbQuery = dbQuery.is('deleted_at', null)
    }

    // Apply sorting
    if (sort) {
      dbQuery = dbQuery.order(sort.field, { ascending: sort.order === 'asc' })
    } else {
      dbQuery = dbQuery.order('transaction_date', { ascending: false })
      dbQuery = dbQuery.order('created_at', { ascending: false })
    }

    const { data, error, count } = await dbQuery.range(
      pagination.offset, 
      pagination.offset + pagination.limit - 1
    )

    if (error) throw new DatabaseError('Failed to fetch aggregated transactions', { cause: error })

    const mapped = (data || []).map((item) => this.mapToListItem(item))
    return { data: mapped, total: count || 0 }
  }

  /**
   * Find single aggregated transaction by ID
   */
  async findById(id: string): Promise<AggregatedTransactionWithDetails | null> {
    const { data, error } = await supabase
      .from('aggregated_transactions')
      .select(`
        *,
        payment_methods(id, code, name),
        journal:journal_headers(id, journal_number, status, is_auto)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch aggregated transaction', { cause: error })

    if (!data) return null

    return this.mapToWithDetails(data)
  }

  /**
   * Find aggregated transaction by source composite key
   */
  async findBySource(
    sourceType: string, 
    sourceId: string, 
    sourceRef: string
  ): Promise<AggregatedTransaction | null> {
    const { data, error } = await supabase
      .from('aggregated_transactions')
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('source_ref', sourceRef)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to find transaction by source', { cause: error })
    return data
  }

  /**
   * Check if source already exists
   */
  async sourceExists(
    sourceType: string, 
    sourceId: string, 
    sourceRef: string,
    excludeId?: string
  ): Promise<boolean> {
    let dbQuery = supabase
      .from('aggregated_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('source_ref', sourceRef)
      .is('deleted_at', null)

    if (excludeId) {
      dbQuery = dbQuery.neq('id', excludeId)
    }

    const { count, error } = await dbQuery

    if (error) throw new DatabaseError('Failed to check source existence', { cause: error })
    return (count || 0) > 0
  }

  /**
   * Create new aggregated transaction
   */
  async create(data: Omit<AggregatedTransaction, 'id' | 'created_at' | 'updated_at' | 'version'>): Promise<AggregatedTransaction> {
    const { data: result, error } = await supabase
      .from('aggregated_transactions')
      .insert(data)
      .select()
      .single()

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        throw AggregatedTransactionErrors.DUPLICATE_SOURCE(
          data.source_type,
          data.source_id,
          data.source_ref
        )
      }
      throw new DatabaseError('Failed to create aggregated transaction', { cause: error })
    }

    return result
  }

  /**
   * Create multiple aggregated transactions (batch)
   */
  async createBatch(
    transactions: Array<Omit<AggregatedTransaction, 'id' | 'created_at' | 'updated_at' | 'version'>>
  ): Promise<{ success: string[]; failed: Array<{ source_ref: string; error: string }> }> {
    const success: string[] = []
    const failed: Array<{ source_ref: string; error: string }> = []

    for (const tx of transactions) {
      try {
        await this.create(tx)
        success.push(tx.source_ref)
      } catch (err) {
        failed.push({
          source_ref: tx.source_ref,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    return { success, failed }
  }

  /**
   * Update aggregated transaction
   */
  async update(
    id: string, 
    updates: Partial<AggregatedTransaction>,
    expectedVersion?: number
  ): Promise<AggregatedTransaction> {
    // Build update data with version increment
    const updateData = {
      ...updates,
      version: (expectedVersion || 0) + 1,
      updated_at: new Date().toISOString(),
    }

    let dbQuery = supabase
      .from('aggregated_transactions')
      .update(updateData)
      .eq('id', id)

    // Optimistic locking
    if (expectedVersion !== undefined) {
      dbQuery = dbQuery.eq('version', expectedVersion)
    }

    const { data, error } = await dbQuery.select().single()

    if (error) {
      // Check for version conflict
      if (error.code === 'P0001' || error.message?.includes('version')) {
        throw AggregatedTransactionErrors.VERSION_CONFLICT(id, expectedVersion || 0, (expectedVersion || 0) + 1)
      }
      throw new DatabaseError('Failed to update aggregated transaction', { cause: error })
    }

    return data
  }

  /**
   * Soft delete aggregated transaction
   */
  async softDelete(id: string, deletedBy?: string): Promise<void> {
    const { error } = await supabase
      .from('aggregated_transactions')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) throw new DatabaseError('Failed to delete aggregated transaction', { cause: error })
  }

  /**
   * Restore soft-deleted transaction
   */
  async restore(id: string): Promise<void> {
    const { error } = await supabase
      .from('aggregated_transactions')
      .update({
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .not('deleted_at', 'is', null)

    if (error) throw new DatabaseError('Failed to restore aggregated transaction', { cause: error })
  }

  /**
   * Update journal_id for transaction
   */
  async assignJournal(id: string, journalId: string): Promise<void> {
    const { error } = await supabase
      .from('aggregated_transactions')
      .update({
        journal_id: journalId,
        status: 'PROCESSING' as AggregatedTransactionStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw new DatabaseError('Failed to assign journal', { cause: error })
  }

  /**
   * Update journal_id for multiple transactions (batch)
   */
  async assignJournalBatch(
    transactionIds: string[], 
    journalId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('aggregated_transactions')
      .update({
        journal_id: journalId,
        status: 'PROCESSING' as AggregatedTransactionStatus,
        updated_at: new Date().toISOString(),
      })
      .in('id', transactionIds)

    if (error) throw new DatabaseError('Failed to assign journal to transactions', { cause: error })
  }

  /**
   * Mark transactions as reconciled
   */
  async markReconciled(transactionIds: string[], reconciledBy: string): Promise<void> {
    const { error } = await supabase
      .from('aggregated_transactions')
      .update({
        is_reconciled: true,
        reconciled_by: reconciledBy,
        reconciled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', transactionIds)
      .eq('is_reconciled', false)

    if (error) throw new DatabaseError('Failed to mark transactions as reconciled', { cause: error })
  }

  /**
   * Find transactions by import source
   */
  async findBySourceId(sourceId: string): Promise<AggregatedTransaction[]> {
    const { data, error } = await supabase
      .from('aggregated_transactions')
      .select('*')
      .eq('source_id', sourceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) throw new DatabaseError('Failed to fetch transactions by source', { cause: error })
    return data || []
  }

  /**
   * Find unreconciled transactions for  and date range
   */
  async findUnreconciled(
    dateFrom?: string,
    dateTo?: string,
    branchName?: string
  ): Promise<AggregatedTransaction[]> {
    let dbQuery = supabase
      .from('aggregated_transactions')
      .select('*')
      .eq('is_reconciled', false)
      .is('deleted_at', null)

    if (dateFrom) {
      dbQuery = dbQuery.gte('transaction_date', dateFrom)
    }
    if (dateTo) {
      dbQuery = dbQuery.lte('transaction_date', dateTo)
    }

    if (branchName) {
      dbQuery = dbQuery.eq('branch_name', branchName)
    }

    const { data, error } = await dbQuery.order('transaction_date', { ascending: true })

    if (error) throw new DatabaseError('Failed to fetch unreconciled transactions', { cause: error })
    return data || []
  }

  /**
   * Get summary statistics
   */
  async getSummary(
    dateFrom?: string,
    dateTo?: string,
    branchName?: string
  ): Promise<{
    total_count: number
    total_gross_amount: number
    total_discount_amount: number
    total_tax_amount: number
    total_service_charge_amount: number
    total_net_amount: number
  }> {
    let dbQuery = supabase
      .from('aggregated_transactions')
      .select(
        `
        count,
        gross_amount:sum,
        discount_amount:sum,
        tax_amount:sum,
        service_charge_amount:sum,
        net_amount:sum
      `,
        { count: 'exact', head: true }
      )
      .is('deleted_at', null)

    if (dateFrom) dbQuery = dbQuery.gte('transaction_date', dateFrom)
    if (dateTo) dbQuery = dbQuery.lte('transaction_date', dateTo)
    if (branchName) dbQuery = dbQuery.eq('branch_name', branchName)

    const { data, error } = await dbQuery

    if (error) throw new DatabaseError('Failed to get summary', { cause: error })

    return {
      total_count: (data as any)?.count || 0,
      total_gross_amount: (data as any)?.gross_amount?.sum || 0,
      total_discount_amount: (data as any)?.discount_amount?.sum || 0,
      total_tax_amount: (data as any)?.tax_amount?.sum || 0,
      total_service_charge_amount: (data as any)?.service_charge_amount?.sum || 0,
      total_net_amount: (data as any)?.net_amount?.sum || 0,
    }
  }

  /**
   * Get transaction counts by status
   */
  async getStatusCounts(): Promise<Record<AggregatedTransactionStatus, number>> {
    // Fallback: get counts individually for each status
    const statuses: AggregatedTransactionStatus[] = ['READY', 'PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']
    const counts: Record<AggregatedTransactionStatus, number> = {
      READY: 0,
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    }

    for (const status of statuses) {
      const { count } = await supabase
        .from('aggregated_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)
        .is('deleted_at', null)
      
      counts[status] = count || 0
    }

    return counts
  }

  /**
   * Map database row to ListItem
   */
  private mapToListItem(row: Record<string, unknown>): AggregatedTransactionListItem {
    const paymentMethod = Array.isArray(row.payment_methods) ? row.payment_methods[0] : row.payment_methods

    return {
      id: row.id as string,
      source_type: row.source_type as AggregatedTransactionSourceType,
      source_id: row.source_id as string,
      source_ref: row.source_ref as string,
      transaction_date: row.transaction_date as string,
      payment_method_id: row.payment_method_id as number,
      gross_amount: Number(row.gross_amount),
      discount_amount: Number(row.discount_amount),
      tax_amount: Number(row.tax_amount),
      service_charge_amount: Number(row.service_charge_amount),
      net_amount: Number(row.net_amount),
      currency: row.currency as string,
      status: row.status as AggregatedTransactionStatus,
      is_reconciled: row.is_reconciled as boolean,
      created_at: row.created_at as string,
      version: row.version as number,
      branch_name: row.branch_name as string,
      payment_method_name: (paymentMethod as Record<string, unknown>)?.name as string | undefined,
    }
  }

  /**
   * Map database row to WithDetails
   */
  private mapToWithDetails(row: Record<string, unknown>): AggregatedTransactionWithDetails {
    const paymentMethod = Array.isArray(row.payment_methods) ? row.payment_methods[0] : row.payment_methods
    const journal = Array.isArray(row.journal) ? row.journal[0] : row.journal

    return {
      id: row.id as string,
      branch_name: row.branch_name as string | null,
      source_type: row.source_type as AggregatedTransactionSourceType,
      source_id: row.source_id as string,
      source_ref: row.source_ref as string,
      transaction_date: row.transaction_date as string,
      payment_method_id: row.payment_method_id as number,
      gross_amount: Number(row.gross_amount),
      discount_amount: Number(row.discount_amount),
      tax_amount: Number(row.tax_amount),
      service_charge_amount: Number(row.service_charge_amount),
      net_amount: Number(row.net_amount),
      currency: row.currency as string,
      journal_id: row.journal_id as string | null,
      is_reconciled: row.is_reconciled as boolean,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: row.deleted_at as string | null,
      deleted_by: row.deleted_by as string | null,
      version: row.version as number,
      status: row.status as AggregatedTransactionStatus,
      payment_method_code: (paymentMethod as Record<string, unknown>)?.code as string | undefined,
      payment_method_name: (paymentMethod as Record<string, unknown>)?.name as string | undefined,
      journal: journal as AggregatedTransactionWithDetails['journal'],
    }
  }
}

export const posAggregatesRepository = new PosAggregatesRepository()
