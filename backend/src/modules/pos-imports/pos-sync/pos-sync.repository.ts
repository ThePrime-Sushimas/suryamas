import { supabase } from "@/config/supabase"
import { toSaleRow, toSaleItemRow, toSalePaymentRow } from './pos-sync.mapper'
import { SaleInput, SaleItemInput, SalePaymentInput } from './pos-sync.types'

export const salesRepository = {
  async getBranchMap(): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from("branches")
      .select("id, branch_code")

    if (error) throw error

    const map: Record<string, string> = {}

    data?.forEach((b: any) => {
      map[b.branch_code] = b.id
    })

    return map
  },

  async upsertSales(sales: SaleInput[]): Promise<void> {
    const payload = sales.map(toSaleRow)

    const { error } = await supabase
      .from("sales")
      .upsert(payload, { onConflict: "sales_num, branch_id" })

    if (error) throw error
  },

  async upsertItems(items: SaleItemInput[]): Promise<void> {
    const payload = items.map(toSaleItemRow)

    const { error } = await supabase
      .from("sales_items")
      .upsert(payload, { onConflict: "external_id" })

    if (error) throw error
  },

  async upsertPayments(payments: SalePaymentInput[]): Promise<void> {
    const payload = payments.map(toSalePaymentRow)

    const { error } = await supabase
      .from("sales_payments")
      .upsert(payload, { onConflict: "external_id" })

    if (error) throw error
  },
}