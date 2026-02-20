import { create } from "zustand";
import { monitoringApi } from "../api/monitoring.api";
import type {
  ErrorLogRecord,
  AuditLogRecord,
  ErrorStats,
  MonitoringFilters,
} from "../types";

interface MonitoringState {
  errorLogs: ErrorLogRecord[];
  auditLogs: AuditLogRecord[];
  stats: ErrorStats | null;
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  fetchErrorLogs: (
    page?: number,
    limit?: number,
    filters?: MonitoringFilters,
  ) => Promise<void>;
  fetchAuditLogs: (
    page?: number,
    limit?: number,
    filters?: MonitoringFilters,
  ) => Promise<void>;
  fetchStats: () => Promise<void>;
  bulkActionErrors: (
    ids: string[],
    action: "delete" | "soft-delete",
  ) => Promise<void>;
  bulkActionAudit: (
    ids: string[],
    action: "delete" | "soft-delete",
  ) => Promise<void>;
  clearError: () => void;
}

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  errorLogs: [],
  auditLogs: [],
  stats: null,
  loading: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  },

  fetchErrorLogs: async (page = 1, limit = 10, filters?: MonitoringFilters) => {
    set({ loading: true, error: null });
    try {
      const res = await monitoringApi.getErrorLogs(page, limit, filters);
      set({
        errorLogs: res.data,
        loading: false,
        pagination: {
          total: res.pagination.total,
          page: res.pagination.page,
          limit: res.pagination.limit,
          totalPages: res.pagination.totalPages,
        },
      });
    } catch (error: any) {
      set({
        error: error?.response?.data?.message || "Failed to fetch error logs",
        loading: false,
      });
    }
  },

  fetchAuditLogs: async (page = 1, limit = 10, filters?: MonitoringFilters) => {
    set({ loading: true, error: null });
    try {
      const res = await monitoringApi.getAuditLogs(page, limit, filters);
      set({
        auditLogs: res.data,
        loading: false,
        pagination: {
          total: res.pagination.total,
          page: res.pagination.page,
          limit: res.pagination.limit,
          totalPages: res.pagination.totalPages,
        },
      });
    } catch (error: any) {
      set({
        error: error?.response?.data?.message || "Failed to fetch audit logs",
        loading: false,
      });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await monitoringApi.getErrorStats();
      set({ stats });
    } catch (error) {
      console.error("Failed to fetch monitoring stats:", error);
    }
  },

  bulkActionErrors: async (ids, action) => {
    set({ loading: true, error: null });
    try {
      await monitoringApi.bulkActionErrors(ids, action);
      const { pagination } = get();
      await get().fetchErrorLogs(pagination.page, pagination.limit);
    } catch (error: any) {
      set({
        error:
          error?.response?.data?.message || "Failed to process bulk action",
        loading: false,
      });
    }
  },

  bulkActionAudit: async (ids, action) => {
    set({ loading: true, error: null });
    try {
      await monitoringApi.bulkActionAudit(ids, action);
      const { pagination } = get();
      await get().fetchAuditLogs(pagination.page, pagination.limit);
    } catch (error: any) {
      set({
        error:
          error?.response?.data?.message || "Failed to process bulk action",
        loading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
