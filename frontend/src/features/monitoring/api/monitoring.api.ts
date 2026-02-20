import api from "@/lib/axios";
import type {
  ErrorLogRecord,
  AuditLogRecord,
  ErrorStats,
  MonitoringFilters,
  ErrorReport,
} from "../types";

type ApiResponse<T> = { success: boolean; data: T };
type PaginatedResponse<T> = ApiResponse<T[]> & {
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export const monitoringApi = {
  // Error Logs
  getErrorLogs: async (page = 1, limit = 10, filters?: MonitoringFilters) => {
    const res = await api.get<PaginatedResponse<ErrorLogRecord>>(
      "/monitoring/errors",
      {
        params: { page, limit, ...filters },
      },
    );
    return res.data;
  },

  getErrorStats: async () => {
    const res = await api.get<ApiResponse<ErrorStats>>(
      "/monitoring/errors/stats",
    );
    return res.data.data;
  },

  logError: async (report: ErrorReport) => {
    const res = await api.post<ApiResponse<{ message: string }>>(
      "/monitoring/errors",
      report,
    );
    return res.data.data;
  },

  // Audit Logs
  getAuditLogs: async (page = 1, limit = 10, filters?: MonitoringFilters) => {
    const res = await api.get<PaginatedResponse<AuditLogRecord>>(
      "/monitoring/audit",
      {
        params: { page, limit, ...filters },
      },
    );
    return res.data;
  },

  logAudit: async (entry: any) => {
    const res = await api.post<ApiResponse<{ message: string }>>(
      "/monitoring/audit",
      entry,
    );
    return res.data.data;
  },
};
