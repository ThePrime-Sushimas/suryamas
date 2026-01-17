/**
 * POS Import Lines Repository
 * Handles bulk insertion of POS transaction lines
 */

import { supabase } from '../../../config/supabase'
import { logInfo, logError } from '../../../config/logger'
import type { PosImportLine, CreatePosImportLineDto } from './pos-import-lines.types'

export class PosImportLinesRepository {
  /**
   * Bulk insert lines for an import
   */
  async bulkInsert(lines: CreatePosImportLineDto[]): Promise<void> {
    try {
      if (lines.length === 0) return

      const { error } = await supabase
        .from('pos_import_lines')
        .insert(lines)

      if (error) throw error

      logInfo('PosImportLinesRepository bulkInsert success', {
        pos_import_id: lines[0]?.pos_import_id,
        count: lines.length
      })
    } catch (error) {
      logError('PosImportLinesRepository bulkInsert error', { count: lines.length, error })
      throw error
    }
  }

  /**
   * Find lines by import ID with pagination
   */
  async findByImportId(
    importId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: PosImportLine[]; total: number }> {
    try {
      const offset = (page - 1) * limit

      const [dataResult, countResult] = await Promise.all([
        supabase
          .from('pos_import_lines')
          .select('*')
          .eq('pos_import_id', importId)
          .order('row_number', { ascending: true })
          .range(offset, offset + limit - 1),
        supabase
          .from('pos_import_lines')
          .select('*', { count: 'exact', head: true })
          .eq('pos_import_id', importId)
      ])

      if (dataResult.error) throw dataResult.error
      if (countResult.error) throw countResult.error

      return {
        data: dataResult.data || [],
        total: countResult.count || 0
      }
    } catch (error) {
      logError('PosImportLinesRepository findByImportId error', { importId, error })
      throw error
    }
  }

  /**
   * Find all lines by import ID (handles unlimited rows with chunking)
   */
  async findAllByImportId(importId: string): Promise<PosImportLine[]> {
    try {
      let offset = 0
      const limit = 1000
      let hasMore = true
      const allLines: PosImportLine[] = []

      while (hasMore) {
        const { data, error } = await supabase
          .from('pos_import_lines')
          .select('*')
          .eq('pos_import_id', importId)
          .order('row_number', { ascending: true })
          .range(offset, offset + limit - 1)

        if (error) throw error

        if (!data || data.length === 0) {
          hasMore = false
          break
        }

        allLines.push(...data)
        hasMore = data.length === limit
        offset += limit
      }

      return allLines
    } catch (error) {
      logError('PosImportLinesRepository findAllByImportId error', { importId, error })
      throw error
    }
  }

  /**
   * Check for existing transactions using database function
   */
  async findExistingTransactions(
    transactions: Array<{ bill_number: string; sales_number: string; sales_date: string }>
  ): Promise<Array<{ bill_number: string; sales_number: string; sales_date: string; pos_import_id: string }>> {
    try {
      if (transactions.length === 0) return []

      // Try RPC function first (optimal)
      try {
        const { data, error } = await supabase
          .rpc('check_duplicate_transactions', { transactions })

        if (!error && data) {
          return data
        }
      } catch {
        // Fall through to fallback
      }

      // Fallback: Fetch by bill_numbers and filter in memory
      const billNumbers = [...new Set(transactions.map(t => t.bill_number))]
      
      const { data, error } = await supabase
        .from('pos_import_lines')
        .select('bill_number, sales_number, sales_date, pos_import_id')
        .in('bill_number', billNumbers)

      if (error) throw error

      const transactionSet = new Set(
        transactions.map(t => `${t.bill_number}|${t.sales_number}|${t.sales_date}`)
      )

      return (data || []).filter(row => 
        transactionSet.has(`${row.bill_number}|${row.sales_number}|${row.sales_date}`)
      )
    } catch (error) {
      logError('PosImportLinesRepository findExistingTransactions error', { count: transactions.length, error })
      throw error
    }
  }

  /**
   * Delete lines by import ID
   */
  async deleteByImportId(importId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('pos_import_lines')
        .delete()
        .eq('pos_import_id', importId)

      if (error) throw error

      logInfo('PosImportLinesRepository deleteByImportId success', { importId })
    } catch (error) {
      logError('PosImportLinesRepository deleteByImportId error', { importId, error })
      throw error
    }
  }

  /**
   * Count lines by import ID
   */
  async countByImportId(importId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('pos_import_lines')
        .select('*', { count: 'exact', head: true })
        .eq('pos_import_id', importId)

      if (error) throw error

      return count || 0
    } catch (error) {
      logError('PosImportLinesRepository countByImportId error', { importId, error })
      throw error
    }
  }

  /**
   * Get financial summary for import (handles unlimited rows with chunking)
   */
  async getSummaryByImportId(importId: string): Promise<{
    totalAmount: number
    totalTax: number
    totalDiscount: number
    transactionCount: number
  }> {
    try {
      // Try RPC function first (if available)
      try {
        const { data, error } = await supabase
          .rpc('get_pos_import_summary', { import_id: importId })

        if (!error && data && Array.isArray(data) && data.length > 0) {
          return data[0]
        }
      } catch {
        // Fall through to chunking approach
      }

      // Fallback: Fetch in chunks of 1000
      let offset = 0
      const limit = 1000
      let hasMore = true
      const summary = { totalAmount: 0, totalTax: 0, totalDiscount: 0, transactionCount: 0 }

      while (hasMore) {
        const { data, error } = await supabase
          .from('pos_import_lines')
          .select('total, tax, discount')
          .eq('pos_import_id', importId)
          .range(offset, offset + limit - 1)

        if (error) throw error

        if (!data || data.length === 0) {
          hasMore = false
          break
        }

        data.forEach(line => {
          summary.totalAmount += line.total || 0
          summary.totalTax += line.tax || 0
          summary.totalDiscount += line.discount || 0
          summary.transactionCount += 1
        })

        hasMore = data.length === limit
        offset += limit
      }

      return summary
    } catch (error) {
      logError('PosImportLinesRepository getSummaryByImportId error', { importId, error })
      throw error
    }
  }
}

export const posImportLinesRepository = new PosImportLinesRepository()
