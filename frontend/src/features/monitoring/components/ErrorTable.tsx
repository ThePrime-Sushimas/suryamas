import React from "react";
import { Eye, Clock, ShieldAlert } from "lucide-react";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import type { ErrorLogRecord } from "../types";

interface ErrorTableProps {
  logs: ErrorLogRecord[];
  loading?: boolean;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onViewDetail: (log: ErrorLogRecord) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

const SeverityBadge = ({ severity }: { severity: string }) => {
  const styles = {
    LOW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    MEDIUM:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  const style = styles[severity as keyof typeof styles] || styles.LOW;
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>
      {severity}
    </span>
  );
};

export const ErrorTable: React.FC<ErrorTableProps> = ({
  logs,
  loading,
  pagination,
  onPageChange,
  onViewDetail,
  selectedIds,
  onSelectionChange,
}) => {
  if (loading) {
    return <TableSkeleton rows={8} columns={7} />;
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <ShieldAlert className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          No error logs found
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          System is running smoothly!
        </p>
      </div>
    );
  }

  const toggleAll = () => {
    if (selectedIds.length === logs.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(logs.map((l) => l.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={
                    logs.length > 0 && selectedIds.length === logs.length
                  }
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Error Message
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Module
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {logs.map((log) => (
              <tr
                key={log.id}
                className={`transition-colors ${
                  selectedIds.includes(log.id)
                    ? "bg-blue-50/50 dark:bg-blue-900/10"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(log.id)}
                    onChange={() => toggleOne(log.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {new Date(log.created_at).toLocaleString("id-ID")}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <SeverityBadge severity={log.severity} />
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                    {log.error_message}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {log.error_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {log.module}
                  {log.submodule && (
                    <span className="text-xs ml-1">({log.submodule})</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {log.user_email || log.user_id || "Guest"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onViewDetail(log)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          pagination={pagination}
          onPageChange={onPageChange}
          currentLength={logs.length}
        />
      )}
    </div>
  );
};
