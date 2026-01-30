import {
  FileText,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  DollarSign,
} from "lucide-react";
import type { ReconciliationSummary } from "../../types/bank-reconciliation.types";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBgColor: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  suffix?: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBgColor,
  trend,
  suffix,
}: StatCardProps) {
  const TrendIcon = trend?.isPositive ? TrendingUp : TrendingDown;
  const trendColor = trend?.isPositive ? "text-emerald-600" : "text-rose-600";
  const trendBg = trend?.isPositive
    ? "bg-emerald-50 dark:bg-emerald-900/20"
    : "bg-rose-50 dark:bg-rose-900/20";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <div
          className={`p-2.5 rounded-xl ${iconBgColor} transition-transform group-hover:scale-110 duration-300`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {trend !== undefined ? (
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${trendBg}`}
          >
            <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
            <span className={`text-xs font-semibold ${trendColor}`}>
              {trend.value}%
            </span>
          </div>
        ) : (
          <div className="w-8 h-1 bg-gray-50 dark:bg-gray-700/50 rounded-full" />
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
          {suffix && (
            <span className="text-sm font-medium text-gray-500 ml-1.5">
              {suffix}
            </span>
          )}
        </p>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
          {title}
        </p>
      </div>
    </div>
  );
}

interface ReconciliationSummaryProps {
  summary: ReconciliationSummary;
}

export function ReconciliationSummaryCards({
  summary,
}: ReconciliationSummaryProps) {
  // Provide default values to prevent undefined errors
  const safeSummary = {
    totalStatements: summary.totalStatements ?? 0,
    percentageReconciled: summary.percentageReconciled ?? 0,
    discrepancies: summary.discrepancies ?? 0,
    unreconciled: summary.unreconciled ?? 0,
    totalDifference: summary.totalDifference ?? 0,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Transaksi"
        value={safeSummary.totalStatements}
        icon={FileText}
        iconColor="text-blue-600"
        iconBgColor="bg-blue-100 dark:bg-blue-900/30"
        suffix="item"
      />
      <StatCard
        title="Terekonsiliasi"
        value={safeSummary.percentageReconciled.toFixed(1)}
        icon={CheckCircle}
        iconColor="text-green-600"
        iconBgColor="bg-green-100 dark:bg-green-900/30"
        suffix="%"
        trend={{ value: 5.2, isPositive: true }} // Mock trend
      />
      <StatCard
        title="Discrepancies"
        value={safeSummary.discrepancies}
        icon={AlertCircle}
        iconColor="text-rose-600"
        iconBgColor="bg-rose-100 dark:bg-rose-900/30"
        suffix="item"
      />
      <StatCard
        title="Belum Cocok"
        value={safeSummary.unreconciled}
        icon={HelpCircle}
        iconColor="text-amber-600"
        iconBgColor="bg-amber-100 dark:bg-amber-900/30"
        suffix="item"
      />
      <StatCard
        title="Selisih Total"
        value={safeSummary.totalDifference.toLocaleString("id-ID", {
          style: "currency",
          currency: "IDR",
        })}
        icon={DollarSign}
        iconColor="text-purple-600"
        iconBgColor="bg-purple-100 dark:bg-purple-900/30"
      />
    </div>
  );
}
