import { salesRepository, masterRepository } from './pos-sync.repository'
import { ImportSalesPayload, ImportSalesResult, ImportMasterPayload, ImportMasterResult } from './pos-sync.types'

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
};

export const masterService = {
  sync: async (payload: ImportMasterPayload): Promise<ImportMasterResult> => {
    const {
      branches = [],
      payment_methods = [],
      menu_categories = [],
      menu_groups = [],
      menus = [],
    } = payload

    // Urutan penting: parent dulu sebelum child
    if (branches.length > 0) {
      await masterRepository.upsertBranches(branches)
    }

    if (payment_methods.length > 0) {
      await masterRepository.upsertPaymentMethods(payment_methods)
    }

    if (menu_categories.length > 0) {
      await masterRepository.upsertMenuCategories(menu_categories)
    }

    // menu_groups FK ke menu_categories — pastikan categories duluan
    if (menu_groups.length > 0) {
      await masterRepository.upsertMenuGroups(menu_groups)
    }

    // menus FK ke menu_groups — pastikan groups duluan
    if (menus.length > 0) {
      // Chunk 50 rows untuk hindari payload terlalu besar
      const chunkSize = 50
      for (let i = 0; i < menus.length; i += chunkSize) {
        await masterRepository.upsertMenus(menus.slice(i, i + chunkSize))
      }
    }

    return {
      success: true,
      branches: branches.length,
      payment_methods: payment_methods.length,
      menu_categories: menu_categories.length,
      menu_groups: menu_groups.length,
      menus: menus.length,
    }
  },
};