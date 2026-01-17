/**
 * POS Transactions Service
 * Consolidated view of all POS transactions across imports
 */

import { posImportLinesRepository } from '../pos-import-lines/pos-import-lines.repository'
import type { PaginationParams } from '../../../types/request.types'

export interface PosTransactionFilters {
  dateFrom?: string
  dateTo?: string
  salesNumber?: string
  billNumber?: string
  branches?: string // comma-separated
  area?: string
  brand?: string
  city?: string
  menuName?: string
  paymentMethods?: string // comma-separated
  regularMemberName?: string
  customerName?: string
  visitPurpose?: string
  salesType?: string
  menuCategory?: string
  menuCategoryDetail?: string
  menuCode?: string
  customMenuName?: string
  tableSection?: string
  tableName?: string
}

class PosTransactionsService {
  async list(
    companyId: string,
    pagination: PaginationParams,
    filters: PosTransactionFilters
  ) {
    return posImportLinesRepository.findAllWithFilters(companyId, filters, pagination)
  }

  async exportToExcel(
    companyId: string,
    filters: PosTransactionFilters
  ) {
    // Export with high limit (10000 rows max for Excel)
    return posImportLinesRepository.findAllWithFilters(companyId, filters, { page: 1, limit: 100000 })
  }
}

export const posTransactionsService = new PosTransactionsService()
