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
  branch?: string
  area?: string
  brand?: string
  city?: string
  menuName?: string
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
}

export const posTransactionsService = new PosTransactionsService()
