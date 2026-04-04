import { supabase } from "@/config/supabase";
import { toSaleRow, toSaleItemRow, toSalePaymentRow } from "./pos-sync.mapper";
import { SaleInput, SaleItemInput, SalePaymentInput } from "./pos-sync.types";

export const salesRepository = {
  async upsertSales(sales: SaleInput[]): Promise<void> {
    const payload = sales.map(toSaleRow);

    const { error } = await supabase
      .from("tr_saleshead") // ✅ FIXED
      .upsert(payload, { onConflict: "sales_num" }); // ✅ FIXED: camelCase → snake_case

    if (error) {
      console.error("❌ SUPABASE SALES ERROR:", error);
      throw error;
    }
  },

  async upsertItems(items: SaleItemInput[]): Promise<void> {
    const payload = items.map(toSaleItemRow);

    const { error } = await supabase
      .from("tr_salesmenu") // ✅ FIXED
      .upsert(payload, { onConflict: "external_id" }); // ✅ external_id = ID dari MySQL

    if (error) {
      console.error("❌ SUPABASE ITEMS ERROR:", error);
      throw error;
    }
  },

  async upsertPayments(payments: SalePaymentInput[]): Promise<void> {
    const payload = payments.map(toSalePaymentRow);

    const { error } = await supabase
      .from("tr_salespayment") // ✅ FIXED
      .upsert(payload, { onConflict: "external_id" }); // ✅ external_id = ID dari MySQL

    if (error) {
      console.error("❌ SUPABASE PAYMENTS ERROR:", error);
      throw error;
    }
  },
};
