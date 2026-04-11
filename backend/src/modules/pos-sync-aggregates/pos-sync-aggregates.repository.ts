import { supabase } from "@/config/supabase";
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
      has_journal,
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

    if (has_journal !== undefined && has_journal !== "") {
      const boolVal = has_journal === "true" || has_journal === true;
      if (boolVal) {
        query = query.not("journal_id", "is", null);
      } else {
        query = query.is("journal_id", null);
      }
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

  async supersedeManualEntries(params: {
    supersededById: string;
    transactionDate: string;
    paymentMethodId: number;
    branchId: string;
  }) {
    const { data, error } = await supabase
      .from("aggregated_transactions")
      .update({
        superseded_by: params.supersededById,
        status: "SUPERSEDED",
        updated_at: new Date().toISOString(),
      })
      .eq("source_type", "POS")
      .eq("transaction_date", params.transactionDate)
      .eq("payment_method_id", params.paymentMethodId)
      .eq("branch_id", params.branchId)
      .eq("is_reconciled", false)
      .is("superseded_by", null)
      .is("deleted_at", null)
      .select("id");

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Find aggregated_transactions record linked to a pos_sync_aggregate.
   * Returns null if not yet synced.
   */
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

  async getBankStatementById(statementId: number) {
    const { data, error } = await supabase
      .from("bank_statements")
      .select("id, credit_amount, debit_amount, is_reconciled")
      .eq("id", statementId)
      .single();

    if (error) throw error;
    return data;
  },

  async markPosSyncReconciled(id: string, update: {
    bank_statement_id: number;
    actual_fee_amount: number;
    fee_discrepancy: number;
    fee_discrepancy_note: string | null;
    reconciled_by: string | null;
  }) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("pos_sync_aggregates")
      .update({
        is_reconciled: true,
        bank_statement_id: update.bank_statement_id,
        actual_fee_amount: update.actual_fee_amount,
        fee_discrepancy: update.fee_discrepancy,
        fee_discrepancy_note: update.fee_discrepancy_note,
        reconciled_at: now,
        reconciled_by: update.reconciled_by,
        updated_at: now,
      })
      .eq("id", id);

    if (error) throw error;
  },

  async resetPosSyncReconciliation(id: string) {
    const { error } = await supabase
      .from("pos_sync_aggregates")
      .update({
        is_reconciled: false,
        bank_statement_id: null,
        actual_fee_amount: null,
        fee_discrepancy: null,
        fee_discrepancy_note: null,
        reconciled_at: null,
        reconciled_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
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
        actual_fee_amount: null,
        fee_discrepancy: null,
        fee_discrepancy_note: null,
        updated_at: new Date().toISOString(),
      })
      .eq("pos_sync_aggregate_id", posSyncAggregateId)
      .eq("source_type", "POS_SYNC");

    if (error) throw error;
  },
};
