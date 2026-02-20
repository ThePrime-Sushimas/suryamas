import React from "react";
import { AlertCircle, AlertTriangle, Skull, TrendingUp } from "lucide-react";
import type { ErrorStats } from "../types";

interface ErrorStatsCardProps {
  stats: ErrorStats | null;
}

export const ErrorStatsCard: React.FC<ErrorStatsCardProps> = ({ stats }) => {
  if (!stats) return null;

  const statItems = [
    {
      label: "Total Errors",
      value: stats.total_errors,
      icon: TrendingUp,
      color: "text-gray-600 dark:text-gray-400",
      bg: "bg-gray-100 dark:bg-gray-700/50",
    },
    {
      label: "Critical / High",
      value: (stats.by_severity.CRITICAL || 0) + (stats.by_severity.HIGH || 0),
      icon: Skull,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-900/20",
    },
    {
      label: "Medium Issues",
      value: stats.by_severity.MEDIUM || 0,
      icon: AlertTriangle,
      color: "text-yellow-600 dark:text-yellow-400",
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
    },
    {
      label: "Last 24 Hours",
      value: stats.recent_errors,
      icon: AlertCircle,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statItems.map((item, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-4"
        >
          <div className={`p-3 rounded-lg ${item.bg}`}>
            <item.icon className={`w-6 h-6 ${item.color}`} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {item.label}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
