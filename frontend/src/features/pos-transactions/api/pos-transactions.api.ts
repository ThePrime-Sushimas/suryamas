import axios from '@/lib/axios'

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

export const posTransactionsApi = {
  list: async (params: { page?: number; limit?: number } & PosTransactionFilters) => {
    const response = await axios.get('/pos-transactions', { params })
    return response.data
  }
}
