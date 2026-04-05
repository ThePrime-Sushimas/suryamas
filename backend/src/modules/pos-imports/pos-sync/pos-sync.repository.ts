import { supabase } from "@/config/supabase";
import { toSaleRow, toSaleItemRow, toSalePaymentRow } from "./pos-sync.mapper";
import { SaleInput, SaleItemInput, SalePaymentInput, MasterBranchInput, MasterPaymentMethodInput, MasterMenuCategoryInput, MasterMenuGroupInput, MasterMenuInput } from "./pos-sync.types";

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

export const masterRepository = {
  async upsertBranches(branches: MasterBranchInput[]): Promise<void> {
    console.log(`📤 Upserting ${branches.length} staging branches...`)
    const { error } = await supabase
      .from('pos_staging_branches')
      .upsert(branches, { onConflict: 'pos_id' })
    if (error) {
      console.error('❌ STAGING BRANCHES ERROR:', JSON.stringify(error))
      throw error
    }
    console.log(`✅ Staging branches upsert done`)
  },

  async upsertPaymentMethods(payments: MasterPaymentMethodInput[]): Promise<void> {
    console.log(`📤 Upserting ${payments.length} staging payment methods...`)
    const { error } = await supabase
      .from('pos_staging_payment_methods')
      .upsert(payments, { onConflict: 'pos_id' })
    if (error) {
      console.error('❌ STAGING PAYMENTS ERROR:', JSON.stringify(error))
      throw error
    }
    console.log(`✅ Staging payment methods upsert done`)
  },

  async upsertMenuCategories(categories: MasterMenuCategoryInput[]): Promise<void> {
    console.log(`📤 Upserting ${categories.length} staging menu categories...`)
    const { error } = await supabase
      .from('pos_staging_menu_categories')
      .upsert(categories, { onConflict: 'pos_id' })
    if (error) {
      console.error('❌ STAGING MENU CATEGORIES ERROR:', JSON.stringify(error))
      throw error
    }
    console.log(`✅ Staging menu categories upsert done`)
  },

  async upsertMenuGroups(groups: MasterMenuGroupInput[]): Promise<void> {
    console.log(`📤 Upserting ${groups.length} staging menu groups...`)
    const { error } = await supabase
      .from('pos_staging_menu_groups')
      .upsert(groups, { onConflict: 'pos_id' })
    if (error) {
      console.error('❌ STAGING MENU GROUPS ERROR:', JSON.stringify(error))
      throw error
    }
    console.log(`✅ Staging menu groups upsert done`)
  },

  async upsertMenus(menus: MasterMenuInput[]): Promise<void> {
    console.log(`📤 Upserting ${menus.length} staging menus...`)
    const { error } = await supabase
      .from('pos_staging_menus')
      .upsert(menus, { onConflict: 'pos_id' })
    if (error) {
      console.error('❌ STAGING MENUS ERROR:', JSON.stringify(error))
      throw error
    }
    console.log(`✅ Staging menus upsert done`)
  },
};

