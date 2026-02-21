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
  
  // Active tab state
  activeTab: "errors" | "audit";
  
  // Pagination - flat structure like pos-aggregates
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;

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
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setActiveTab: (tab: "errors" | "audit") => void;
  clearError: () => void;
}

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  errorLogs: [],
  auditLogs: [],
  stats: null,
  loading: false,
  error: null,
  
  // Pagination - flat structure like pos-aggregates
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
  activeTab: "errors",

  fetchErrorLogs: async (page = 1, limit = 10, filters?: MonitoringFilters) => {
    set({ loading: true, error: null });
    try {
      const res = await monitoringApi.getErrorLogs(page, limit, filters);
      set({
        errorLogs: res.data,
        loading: false,
        page: res.pagination.page,
        limit: res.pagination.limit,
        total: res.pagination.total,
        totalPages: res.pagination.totalPages,
        hasNext: res.pagination.hasNext ?? false,
        hasPrev: res.pagination.hasPrev ?? false,
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
        page: res.pagination.page,
        limit: res.pagination.limit,
        total: res.pagination.total,
        totalPages: res.pagination.totalPages,
        hasNext: res.pagination.hasNext ?? false,
        hasPrev: res.pagination.hasPrev ?? false,
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
      const { page, limit } = get();
      await get().fetchErrorLogs(page, limit);
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
      const { page, limit } = get();
      await get().fetchAuditLogs(page, limit);
    } catch (error: any) {
      set({
        error:
          error?.response?.data?.message || "Failed to process bulk action",
        loading: false,
      });
    }
  },

  setPage: (page: number) => {
    const { limit, fetchErrorLogs, fetchAuditLogs, activeTab } = get();
    if (activeTab === "audit") {
      fetchAuditLogs(page, limit);
    } else {
      fetchErrorLogs(page, limit);
    }
  },

  setLimit: (limit: number) => {
    const { fetchErrorLogs, fetchAuditLogs, activeTab } = get();
    if (activeTab === "audit") {
      fetchAuditLogs(1, limit);
    } else {
      fetchErrorLogs(1, limit);
    }
  },

  setActiveTab: (tab: "errors" | "audit") => {
    set({ activeTab: tab });
  },

  clearError: () => set({ error: null }),
}));
