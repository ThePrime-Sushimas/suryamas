import { supabase } from "@/config/supabase";
import { toSaleRow, toSaleItemRow, toSalePaymentRow } from "./pos-sync.mapper";
import { SaleInput, SaleItemInput, SalePaymentInput } from "./pos-sync.types";

export const salesRepository = {
  async upsertSales(sales: SaleInput[]): Promise<void> {
    const payload = sales.map(toSaleRow);
    console.log(`📤 Upserting ${payload.length} sales...`); // ✅

    const { error } = await supabase
      .from("tr_saleshead") // ✅ FIXED
      .upsert(payload, { onConflict: "sales_num" }); // ✅ FIXED: camelCase → snake_case

    if (error) {
      console.error("❌ SUPABASE SALES ERROR:", JSON.stringify(error)); // ✅ stringify
      throw error;
    }
    console.log(`✅ Sales upsert done`); // ✅
  },

  async upsertItems(items: SaleItemInput[]): Promise<void> {
    const payload = items.map(toSaleItemRow);
    console.log(`📤 Upserting ${payload.length} items...`)
    
    // ✅ Log sample payload untuk cek field
    console.log('📦 Sample item payload:', JSON.stringify(payload[0]))

    const { data, error } = await supabase
      .from("tr_salesmenu")
      .upsert(payload, { onConflict: "external_id" })
      .select() // ✅ tambah .select() agar error lebih verbose

    if (error) {
      console.error("❌ SUPABASE ITEMS ERROR:", JSON.stringify(error))
      throw new Error(JSON.stringify(error)) // ✅ throw dengan detail
    }
    console.log(`✅ Items upsert done: ${data?.length} rows`)
  },

  async upsertPayments(payments: SalePaymentInput[]): Promise<void> {
    const payload = payments.map(toSalePaymentRow);
    console.log(`📤 Upserting ${payload.length} payments...`); // ✅

    const { error } = await supabase
      .from("tr_salespayment")
      .upsert(payload, { onConflict: "external_id" });

    if (error) {
      console.error("❌ SUPABASE PAYMENTS ERROR:", JSON.stringify(error)); // ✅
      throw error;
    }
    console.log(`✅ Payments upsert done`); // ✅
  },
};
