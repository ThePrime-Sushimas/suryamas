import api from "@/lib/axios";
import type {
  PosSyncAggregate,
  PosSyncAggregateLine,
  ListAggregatesParams,
} from "../types/pos-sync-aggregates.types";

interface ListResponse {
  success: boolean;
  data: PosSyncAggregate[];
  total: number;
  page: number;
  limit: number;
}

export const posSyncAggregatesApi = {
  list: async (params?: ListAggregatesParams): Promise<ListResponse> => {
    const formattedParams: Record<string, any> = { ...params };
    if (params?.branch_ids && Array.isArray(params.branch_ids)) {
      formattedParams.branch_ids = params.branch_ids.join(",");
    }
    if (
      params?.payment_method_ids &&
      Array.isArray(params.payment_method_ids)
    ) {
      formattedParams.payment_method_ids = params.payment_method_ids.join(",");
    }

    const res = await api.get("/pos-sync-aggregates", {
      params: formattedParams,
    });
    return res.data;
  },

  getById: async (id: string): Promise<PosSyncAggregate> => {
    const res = await api.get(`/pos-sync-aggregates/${id}`);
    return res.data.data;
  },
  recalculateByDate: async (salesDate: string): Promise<void> => {
    await api.post("/pos-sync/recalculate", { sales_date: salesDate });
  },

  getLines: async (id: string): Promise<PosSyncAggregateLine[]> => {
    const res = await api.get(`/pos-sync-aggregates/${id}/lines`);
    return res.data.data;
  },
};
