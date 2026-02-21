import React, { useEffect, useState, useCallback } from "react";
import {
  Activity,
  ShieldAlert,
  History,
  RefreshCcw,
  Search,
  Filter,
  Trash2,
  Archive,
  Calendar,
  X,
} from "lucide-react";
import { useMonitoringStore } from "../store/monitoring.store";
import { ErrorTable } from "../components/ErrorTable";
import { AuditTable } from "../components/AuditTable";
import { ErrorStatsCard } from "../components/ErrorStatsCard";
import { ErrorDetailModal } from "../components/ErrorDetailModal";
import { AuditDetailModal } from "../components/AuditDetailModal";
import type { ErrorLogRecord, AuditLogRecord } from "../types";

export const MonitoringPage: React.FC = () => {
  const {
    errorLogs,
    auditLogs,
    stats,
    loading,
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
    activeTab,
    fetchErrorLogs,
    fetchAuditLogs,
    fetchStats,
    bulkActionErrors,
    bulkActionAudit,
    setActiveTab,
  } = useMonitoringStore();

  const [selectedError, setSelectedError] = useState<ErrorLogRecord | null>(
    null,
  );
  const [selectedAudit, setSelectedAudit] = useState<AuditLogRecord | null>(
    null,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filters state
  const [severityFilter, setSeverityFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Clear selection when changing tabs
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  // Fetch when debounced search changes
  useEffect(() => {
    const filters = {
      severity: severityFilter || undefined,
      search: debouncedSearch || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    if (activeTab === "errors") {
      fetchErrorLogs(1, limit, filters);
    } else {
      fetchAuditLogs(1, limit, filters);
    }
  }, [debouncedSearch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const filters = {
      severity: severityFilter || undefined,
      search: debouncedSearch || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    if (activeTab === "errors") {
      await fetchErrorLogs(1, 10, filters);
      await fetchStats();
    } else {
      await fetchAuditLogs(1, 10, filters);
    }
    setIsRefreshing(false);
  }, [
    activeTab,
    fetchErrorLogs,
    fetchAuditLogs,
    fetchStats,
    severityFilter,
    debouncedSearch,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    handleRefresh();
  }, [activeTab, handleRefresh]);

  const handleBulkAction = async (action: "delete" | "soft-delete") => {
    if (selectedIds.length === 0) return;

    const confirmMsg =
      action === "delete"
        ? `Are you sure you want to permanently delete ${selectedIds.length} logs?`
        : `Are you sure you want to soft delete ${selectedIds.length} logs?`;

    if (!window.confirm(confirmMsg)) return;

    if (activeTab === "errors") {
      await bulkActionErrors(selectedIds, action);
    } else {
      await bulkActionAudit(selectedIds, action);
    }
    setSelectedIds([]);
  };

  const onPageChange = (newPage: number) => {
    const filters = {
      severity: severityFilter || undefined,
      search: debouncedSearch || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    if (activeTab === "errors") {
      fetchErrorLogs(newPage, 10, filters);
    } else {
      fetchAuditLogs(newPage, 10, filters);
    }
  };

  const onLimitChange = (newLimit: number) => {
    const filters = {
      severity: severityFilter || undefined,
      search: debouncedSearch || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    if (activeTab === "errors") {
      fetchErrorLogs(1, newLimit, filters);
    } else {
      fetchAuditLogs(1, newLimit, filters);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200 dark:shadow-none">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  System Monitoring
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Track system health, errors, and audit trails
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
              >
                <RefreshCcw
                  className={`w-4 h-4 ${isRefreshing || loading ? "animate-spin" : ""}`}
                />
                Refresh Data
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-6">
            <button
              onClick={() => setActiveTab("errors")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "errors"
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Error Logs
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === "audit"
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <History className="w-4 h-4" />
              Audit Trail
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats only for errors tab */}
        {activeTab === "errors" && <ErrorStatsCard stats={stats} />}

        {/* Toolbar */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6 flex flex-col sm:flex-row gap-4 items-center">
          {selectedIds.length > 0 ? (
            <div className="flex-1 w-full flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/30 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3 px-2">
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                  {selectedIds.length} items selected
                </span>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Deselect all
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction("soft-delete")}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Soft Delete
                </button>
                <button
                  onClick={() => handleBulkAction("delete")}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-lg text-xs font-medium text-white hover:bg-red-700 transition-all shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Permanently
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab === "errors" ? "error message..." : "action or entity..."}`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-48">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={severityFilter}
                    onChange={(e) => {
                      setSeverityFilter(e.target.value);
                      // Fetch with new filter starting from page 1
                      const filters = {
                        severity: e.target.value || undefined,
                        search: debouncedSearch || undefined,
                        startDate: startDate || undefined,
                        endDate: endDate || undefined,
                      };
                      if (activeTab === "errors") {
                        fetchErrorLogs(1, limit, filters);
                      } else {
                        fetchAuditLogs(1, limit, filters);
                      }
                    }}
                    disabled={activeTab === "audit"}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                  >
                    <option value="">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      // Fetch with new filter starting from page 1
                      const filters = {
                        severity: severityFilter || undefined,
                        search: debouncedSearch || undefined,
                        startDate: e.target.value || undefined,
                        endDate: endDate || undefined,
                      };
                      if (activeTab === "errors") {
                        fetchErrorLogs(1, limit, filters);
                      } else {
                        fetchAuditLogs(1, limit, filters);
                      }
                    }}
                    className="bg-transparent text-xs text-gray-600 dark:text-gray-300 outline-none w-28"
                  />
                  <span className="text-gray-400 text-xs">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      // Fetch with new filter starting from page 1
                      const filters = {
                        severity: severityFilter || undefined,
                        search: debouncedSearch || undefined,
                        startDate: startDate || undefined,
                        endDate: e.target.value || undefined,
                      };
                      if (activeTab === "errors") {
                        fetchErrorLogs(1, limit, filters);
                      } else {
                        fetchAuditLogs(1, limit, filters);
                      }
                    }}
                    className="bg-transparent text-xs text-gray-600 dark:text-gray-300 outline-none w-28"
                  />
                  {(startDate || endDate) && (
                    <button
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                        // Fetch with cleared dates starting from page 1
                        const filters = {
                          severity: severityFilter || undefined,
                          search: debouncedSearch || undefined,
                          startDate: undefined,
                          endDate: undefined,
                        };
                        if (activeTab === "errors") {
                          fetchErrorLogs(1, limit, filters);
                        } else {
                          fetchAuditLogs(1, limit, filters);
                        }
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dynamic Content */}
        <div className="animate-in fade-in duration-500">
          {activeTab === "errors" ? (
            <ErrorTable
              logs={errorLogs}
              loading={loading}
              pagination={{ page, limit, total, totalPages, hasNext, hasPrev }}
              onPageChange={onPageChange}
              onLimitChange={onLimitChange}
              onViewDetail={setSelectedError}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          ) : (
            <AuditTable
              logs={auditLogs}
              loading={loading}
              pagination={{ page, limit, total, totalPages, hasNext, hasPrev }}
              onPageChange={onPageChange}
              onLimitChange={onLimitChange}
              onViewDetail={setSelectedAudit}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          )}
        </div>
      </div>

      {/* Modal */}
      <ErrorDetailModal
        log={selectedError}
        onClose={() => setSelectedError(null)}
      />

      {/* Audit Modal */}
      <AuditDetailModal
        log={selectedAudit}
        onClose={() => setSelectedAudit(null)}
      />
    </div>
  );
};
