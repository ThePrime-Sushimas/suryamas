import { supabase } from "@/config/supabase";
import { logError } from "@/config/logger";
import { ListAggregatesParams } from "./pos-sync-aggregates.types";

export const posSyncAggregatesRepository = {
  async list(params: ListAggregatesParams = {}) {
    const {
      date_from,
      date_to,
      branch_id,
      branch_ids,
      payment_method_id,
      payment_method_ids,
      status,
      is_reconciled,
      search,
      page = 1,
      limit = 50,
    } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("pos_sync_aggregates")
      .select(
        `
      *,
      payment_methods ( id, name, payment_type )
    `,
        { count: "exact" },
      )
      .order("sales_date", { ascending: false })
      .order("branch_name", { ascending: true })
      .range(from, to);

    if (date_from) query = query.gte("sales_date", date_from);
    if (date_to) query = query.lte("sales_date", date_to);
    if (branch_id) query = query.eq("branch_id", branch_id);
    
    if (branch_ids) {
      const ids = branch_ids.split(",");
      query = query.in("branch_id", ids);
    }
    
    if (payment_method_id) {
      query = query.eq("payment_method_id", payment_method_id);
    }

    if (payment_method_ids) {
      const ids = payment_method_ids.split(",").map(Number);
      query = query.in("payment_method_id", ids);
    }

    if (status) query = query.eq("status", status);

    if (is_reconciled !== undefined && is_reconciled !== "") {
      const boolVal = is_reconciled === "true" || is_reconciled === true;
      query = query.eq("is_reconciled", boolVal);
    }

    if (search) {
      // Basic search on branch name, or other fields if needed. Note: ilike is case insensitive
      query = query.or(`branch_name.ilike.%${search}%,id.eq.${search}`);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0, page, limit };
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("pos_sync_aggregates")
      .select(
        `
      *,
      payment_methods ( id, name, payment_type )
    `,
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async getLines(aggregateId: string) {
    const { data, error } = await supabase
      .from("pos_sync_aggregate_lines")
      .select("*")
      .eq("aggregate_id", aggregateId)
      .order("sales_num", { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  async getSummaryByDate(dateFrom: string, dateTo: string) {
    const { data, error } = await supabase
      .from("pos_sync_aggregates")
      .select(
        "sales_date, branch_name, status, grand_total, nett_amount, total_fee_amount, transaction_count",
      )
      .gte("sales_date", dateFrom)
      .lte("sales_date", dateTo)
      .order("sales_date", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async getReadyBySalesDate(salesDate: string) {
    const { data, error } = await supabase
      .from("pos_sync_aggregates")
      .select("*")
      .eq("sales_date", salesDate)
      .in("status", ["READY", "RECALCULATED"]);

    if (error) throw error;
    return data ?? [];
  },

  async getVoidBySalesDate(salesDate: string) {
    const { data, error } = await supabase
      .from("pos_sync_aggregates")
      .select("*")
      .eq("sales_date", salesDate)
      .eq("status", "VOID");

    if (error) throw error;
    return data ?? [];
  },

  async upsertToAggregatedTransactions(row: {
    source_type: string;
    source_id: string;
    source_ref: string;
    transaction_date: string;
    payment_method_id: number | null;
    branch_id: string | null;
    branch_name: string | null;
    gross_amount: number;
    discount_amount: number;
    tax_amount: number;
    nett_amount: number;
    total_fee_amount: number;
    percentage_fee_amount: number;
    fixed_fee_amount: number;
    bill_after_discount: number;
    rounding_amount: number;
    delivery_cost: number;
    order_fee: number;
    voucher_discount_amount: number;
    promotion_discount_amount: number;
    menu_discount_amount: number;
    voucher_payment_amount: number;
    other_vat_amount: number;
    service_charge_amount: number;
    pax_total: number;
    pos_sync_aggregate_id: string;
    status: string;
  }) {
    const { data, error } = await supabase
      .from("aggregated_transactions")
      .upsert(
        { ...row, updated_at: new Date().toISOString() },
        { onConflict: "source_type,source_id,source_ref" },
      )
      .select("id")
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * @deprecated Digantikan oleh sync_pos_aggregates_batch RPC.
   * Retained untuk fallback/debugging. Akan dihapus setelah RPC stabil di production.
   */
  async supersedeManualEntries(params: {
    supersededById: string;
    transactionDate: string;
    paymentMethodId: number;
    branchId: string | null;
    branchName?: string | null;
  }) {
    const { data, error } = await supabase.rpc("supersede_manual_entries", {
      p_superseded_by_id: params.supersededById,
      p_transaction_date: params.transactionDate,
      p_payment_method_id: params.paymentMethodId,
      p_branch_id: params.branchId ?? null,
      p_branch_name: params.branchName ?? null,
    });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * @deprecated Digantikan oleh sync_pos_aggregates_batch RPC.
   * Retained untuk fallback/debugging. Akan dihapus setelah RPC stabil di production.
   */
  async migrateReconciledPosToSync(posId: string, syncId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('migrate_reconciled_pos_to_sync', {
      p_pos_id: posId,
      p_sync_id: syncId,
    });
    if (error) throw error;
    return data ?? false;
  },

  /**
   * Auto-supersede newly inserted manual (POS) entries if POS_SYNC already exists
   * for the same (date, branch, payment_method). Called after bulk CSV import.
   *
   * Before: N+1 queries (fetch chunks + per-record lookup + per-record update)
   * After:  1 RPC call via supersede_manual_if_sync_exists_batch
   */
  async supersedeManualIfPosSyncExists(manualIds: string[]): Promise<number> {
    if (manualIds.length === 0) return 0;

    const { data, error } = await supabase.rpc(
      'supersede_manual_if_sync_exists_batch',
      { p_manual_ids: manualIds }
    );

    if (error) {
      logError('supersedeManualIfPosSyncExists failed', { error: error.message });
      return 0;
    }
    return data ?? 0;
  },

  /**
   * @deprecated Digantikan oleh sync_pos_aggregates_batch RPC.
   * Retained untuk fallback/debugging. Akan dihapus setelah RPC stabil di production.
   */
  async findReconciledPosTwin(params: {
  transactionDate: string;
  paymentMethodId: number;
  branchId: string | null;
  branchName: string | null;
}): Promise<{ id: string } | null> {
  if (!params.branchName && !params.branchId) return null;

  let query = supabase
    .from('aggregated_transactions')
    .select('id')
    .eq('source_type', 'POS')
    .eq('transaction_date', params.transactionDate)
    .eq('payment_method_id', params.paymentMethodId)
    .eq('is_reconciled', true)
    .eq('status', 'READY')
    .is('superseded_by', null)
    .is('deleted_at', null);

  if (params.branchId && params.branchName) {
    query = query.or(`branch_id.eq.${params.branchId},branch_name.eq."${params.branchName}"`);
  } else if (params.branchId) {
    query = query.eq('branch_id', params.branchId);
  } else {
    query = query.eq('branch_name', params.branchName!);
  }

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
},

  async findAggregatedTxByPosSyncId(posSyncAggregateId: string) {
    const { data, error } = await supabase
      .from("aggregated_transactions")
      .select("id")
      .eq("pos_sync_aggregate_id", posSyncAggregateId)
      .eq("source_type", "POS_SYNC")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findBankStatementByReconciliationId(aggregatedTxId: string) {
    const { data, error } = await supabase
      .from("bank_statements")
      .select("id")
      .eq("reconciliation_id", aggregatedTxId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getBankStatementById(statementId: number) {
    const { data, error } = await supabase
      .from("bank_statements")
      .select("id, credit_amount, debit_amount, is_reconciled")
      .eq("id", statementId)
      .single();

    if (error) throw error;
    return data;
  },


  async markBankStatementReconciled(statementId: number, reconciliationId: string) {
    const { error } = await supabase
      .from("bank_statements")
      .update({
        is_reconciled: true,
        reconciliation_id: reconciliationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", statementId);

    if (error) throw error;
  },

  async resetBankStatementReconciliation(statementId: number) {
    const { error } = await supabase
      .from("bank_statements")
      .update({
        is_reconciled: false,
        reconciliation_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", statementId);

    if (error) throw error;
  },

  async markAggregatedTxReconciled(aggTxId: string, feeData: {
    actual_fee_amount: number;
    fee_discrepancy: number;
    fee_discrepancy_note: string | null;
  }) {
    const { error } = await supabase
      .from("aggregated_transactions")
      .update({
        is_reconciled: true,
        ...feeData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", aggTxId);

    if (error) throw error;
  },

  async resetAggregatedTxReconciliation(posSyncAggregateId: string) {
    const { error } = await supabase
      .from("aggregated_transactions")
      .update({
        is_reconciled: false,
        actual_fee_amount: 0,
        fee_discrepancy: 0,
        fee_discrepancy_note: null,
        updated_at: new Date().toISOString(),
      })
      .eq("pos_sync_aggregate_id", posSyncAggregateId)
      .eq("source_type", "POS_SYNC");

    if (error) throw error;
  },

  async getVoidAggregates(salesDate: string, branchId?: string | null) {
    let query = supabase
      .from("pos_sync_aggregates")
      .select("*")
      .eq("status", "VOID")
      .eq("sales_date", salesDate);

    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getVoidTransactionCount(salesDate: string) {
    const { data, error } = await supabase
      .from("pos_sync_aggregates")
      .select("void_transaction_count")
      .eq("status", "VOID")
      .eq("sales_date", salesDate);

    if (error) throw error;
    return (data ?? []).reduce(
      (sum, row) => sum + (row.void_transaction_count ?? 0),
      0,
    );
  },

  async getVoidSummary(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from("pos_sync_aggregates")
      .select(
        "sales_date, branch_id, branch_name, void_transaction_count, recalculated_count, updated_at",
      )
      .eq("status", "VOID")
      .gte("sales_date", startDate)
      .lte("sales_date", endDate)
      .order("sales_date", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async getRecentVoidActivity(daysBack: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data, error } = await supabase
      .from("pos_sync_aggregates")
      .select("*")
      .eq("status", "VOID")
      .gte("updated_at", startDate.toISOString())
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },
};
