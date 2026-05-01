import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { posSyncAggregatesApi } from "../api/pos-sync-aggregates.api";
import { parseApiError } from '@/lib/errorParser';
import type {
  PosSyncAggregate,
  ListAggregatesParams,
} from "../types/pos-sync-aggregates.types";

const initialFilter: ListAggregatesParams = {
  date_from: undefined,
  date_to: undefined,
  status: "",
  branch_ids: undefined,
  payment_method_ids: undefined,
  is_reconciled: undefined,
  search: undefined,
};

interface PosSyncAggregatesState {
  transactions: PosSyncAggregate[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  error: string | null;
  filter: ListAggregatesParams;

  // Actions
  fetchTransactions: (page?: number, limit?: number) => Promise<void>;
  setFilter: (filter: Partial<ListAggregatesParams>) => void;
  clearFilter: () => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  clearError: () => void;
}

export const usePosSyncAggregatesStore = create<PosSyncAggregatesState>()(
  devtools(
    persist(
      (set, get) => ({
        transactions: [],
        total: 0,
        page: 1,
        limit: 50,
        isLoading: false,
        error: null,
        filter: initialFilter,

        fetchTransactions: async (page = 1, limit = 50) => {
          set({ isLoading: true, error: null });
          try {
            const { filter } = get();
            const response = await posSyncAggregatesApi.list({
              ...filter,
              page,
              limit,
            });

            set({
              transactions: response.data,
              total: response.total,
              page: response.page,
              limit: response.limit,
              isLoading: false,
            });
          } catch (error: unknown) {
            set({ isLoading: false, error: parseApiError(error, 'Gagal memuat data agregasi POS') });
          }
        },

        setFilter: (filter: Partial<ListAggregatesParams>) => {
          set((state) => ({
            filter: { ...state.filter, ...filter },
            page: 1, // reset page on filter change
          }));
        },

        clearFilter: () => {
          set({ filter: initialFilter, page: 1 });
        },

        setPage: (page: number) => {
          const { limit } = get();
          set({ page });
          get().fetchTransactions(page, limit);
        },

        setLimit: (limit: number) => {
          set({ limit, page: 1 });
          get().fetchTransactions(1, limit);
        },

        clearError: () => set({ error: null }),
      }),
      {
        name: "pos-sync-aggregates-storage",
        partialize: (state) => ({
          filter: state.filter,
          limit: state.limit,
        }),
      },
    ),
    { name: "pos-sync-aggregates-store" },
  ),
);
