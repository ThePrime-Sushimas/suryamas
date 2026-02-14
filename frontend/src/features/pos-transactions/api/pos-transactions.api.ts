import axios from '@/lib/axios'

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

export const posTransactionsApi = {
  list: async (params: { page?: number; limit?: number } & PosTransactionFilters, options?: { signal?: AbortSignal }) => {
    const config = options?.signal ? { signal: options.signal } : {}
    const response = await axios.get('/pos-transactions', { params, ...config })
    return response.data
  },
  
  export: async (params: PosTransactionFilters) => {
    const response = await axios.get('/pos-transactions/export', { params })
    return response.data
  }
}
