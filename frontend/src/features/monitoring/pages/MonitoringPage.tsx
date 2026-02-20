import React, { useEffect, useState, useCallback } from "react";
import {
  Activity,
  ShieldAlert,
  History,
  RefreshCcw,
  Search,
  Filter,
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
    pagination,
    fetchErrorLogs,
    fetchAuditLogs,
    fetchStats,
  } = useMonitoringStore();

  const [activeTab, setActiveTab] = useState<"errors" | "audit">("errors");
  const [selectedError, setSelectedError] = useState<ErrorLogRecord | null>(
    null,
  );
  const [selectedAudit, setSelectedAudit] = useState<AuditLogRecord | null>(
    null,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters state
  const [severityFilter, setSeverityFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const filters = {
      severity: severityFilter || undefined,
      search: debouncedSearch || undefined,
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
  ]);

  useEffect(() => {
    handleRefresh();
  }, [activeTab, handleRefresh]);

  const onPageChange = (page: number) => {
    const filters = {
      severity: severityFilter || undefined,
      search: debouncedSearch || undefined,
    };

    if (activeTab === "errors") {
      fetchErrorLogs(page, 10, filters);
    } else {
      fetchAuditLogs(page, 10, filters);
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
                  fetchErrorLogs(1, 10, { severity: e.target.value });
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
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="animate-in fade-in duration-500">
          {activeTab === "errors" ? (
            <ErrorTable
              logs={errorLogs}
              loading={loading}
              pagination={pagination}
              onPageChange={onPageChange}
              onViewDetail={setSelectedError}
            />
          ) : (
            <AuditTable
              logs={auditLogs}
              loading={loading}
              pagination={pagination}
              onPageChange={onPageChange}
              onViewDetail={setSelectedAudit}
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
