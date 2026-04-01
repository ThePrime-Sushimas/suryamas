import { salesRepository } from './pos-sync.repository'
import { ImportSalesPayload, ImportSalesResult } from './pos-sync.types'

export const salesService = {
  import: async (payload: ImportSalesPayload): Promise<ImportSalesResult> => {
    const { sales = [], items = [], payments = [] } = payload

    // sequential (lebih aman untuk Supabase upsert)
    if (sales.length > 0) {
      await salesRepository.upsertSales(sales)
    }

    if (items.length > 0) {
      await salesRepository.upsertItems(items)
    }

    if (payments.length > 0) {
      await salesRepository.upsertPayments(payments)
    }

    return {
      success: true,
      sales: sales.length,
      items: items.length,
      payments: payments.length,
    }
  },
}