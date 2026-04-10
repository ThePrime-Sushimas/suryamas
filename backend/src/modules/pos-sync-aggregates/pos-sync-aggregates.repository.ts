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
};
