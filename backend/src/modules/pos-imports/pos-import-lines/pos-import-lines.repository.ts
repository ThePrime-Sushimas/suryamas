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
   * Find lines by import ID
   */
  async findByImportId(importId: string): Promise<PosImportLine[]> {
    try {
      const { data, error } = await supabase
        .from('pos_import_lines')
        .select('*')
        .eq('pos_import_id', importId)
        .order('row_number', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      logError('PosImportLinesRepository findByImportId error', { importId, error })
      throw error
    }
  }

  /**
   * Check for existing transactions (bulk)
   */
  async findExistingTransactions(
    transactions: Array<{ bill_number: string; sales_number: string; sales_date: string }>
  ): Promise<Array<{ bill_number: string; sales_number: string; sales_date: string; pos_import_id: string }>> {
    try {
      if (transactions.length === 0) return []

      // Build OR conditions for bulk check
      const orConditions = transactions
        .map(t => `(bill_number.eq.${t.bill_number},sales_number.eq.${t.sales_number},sales_date.eq.${t.sales_date})`)
        .join(',')

      const { data, error } = await supabase
        .from('pos_import_lines')
        .select('bill_number, sales_number, sales_date, pos_import_id')
        .or(orConditions)

      if (error) throw error

      return data || []
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
}

export const posImportLinesRepository = new PosImportLinesRepository()
