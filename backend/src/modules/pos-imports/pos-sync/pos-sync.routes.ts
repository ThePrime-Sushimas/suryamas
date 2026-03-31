import { Router } from "express";
import { supabase } from '@/config/supabase'


const router = Router();

router.post("/import", async (req, res) => {
  const apiKey = req.headers["x-api-key"];

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sales = [], items = [], payments = [] } = req.body;
  try {
    // ===== 1) SALES =====
    const salesPayload = sales.map((s: any) => ({
      sales_num: s.salesNum,
      sales_date: s.salesDate,
      grand_total: s.grandTotal,
      payment_total: s.paymentTotal,
      sync_date: s.syncDate,
    }));

    const { error: salesError } = await supabase
      .from("sales")
      .upsert(salesPayload, { onConflict: "sales_num" });

    if (salesError) throw salesError;

    // ===== 2) ITEMS =====
    const itemsPayload = items.map((i: any) => ({
      external_id: i.ID,              // UNIQUE
      sales_num: i.salesNum,
      menu_id: i.menuID,
      custom_menu_name: i.customMenuName,
      qty: i.qty,
      price: i.price,
      total: i.total,
      sync_date: i.syncDate,
    }));

    const { error: itemsError } = await supabase
      .from("sales_items")
      .upsert(itemsPayload, { onConflict: "external_id" });

    if (itemsError) throw itemsError;

    // ===== 3) PAYMENTS =====
    const paymentsPayload = payments.map((p: any) => ({
      external_id: p.ID,              // UNIQUE
      sales_num: p.salesNum,
      payment_method_id: p.paymentMethodID,
      payment_amount: Number(p.paymentAmount),
      trace_number: p.traceNumber,
      sync_date: p.syncDate,
    }));

    const { error: paymentsError } = await supabase
      .from("sales_payments")
      .upsert(paymentsPayload, { onConflict: "external_id" });

    if (paymentsError) throw paymentsError;

    return res.json({
      success: true,
      sales: salesPayload.length,
      items: itemsPayload.length,
      payments: paymentsPayload.length,
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;