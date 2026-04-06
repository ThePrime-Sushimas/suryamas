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
    const res = await api.get("/pos-sync-aggregates", { params });
    return res.data;
  },

  getById: async (id: string): Promise<PosSyncAggregate> => {
    const res = await api.get(`/pos-sync-aggregates/${id}`);
    return res.data.data;
  },

  getLines: async (id: string): Promise<PosSyncAggregateLine[]> => {
    const res = await api.get(`/pos-sync-aggregates/${id}/lines`);
    return res.data.data;
  },

  reconcile: async (
    id: string,
    statementId: number,
    notes?: string,
  ): Promise<void> => {
    await api.post(`/pos-sync-aggregates/${id}/reconcile`, {
      statementId,
      notes,
    });
  },

  undoReconcile: async (id: string): Promise<void> => {
    await api.post(`/pos-sync-aggregates/${id}/undo-reconcile`);
  },
};
