import React from "react";
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
import { tailwindTheme } from "@/lib/tailwind-theme";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  themeVariant: "success" | "warning" | "danger" | "info" | "accent";
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
  themeVariant,
  trend,
  suffix,
}: StatCardProps) {
  const TrendIcon = trend?.isPositive ? TrendingUp : TrendingDown;
  const colorConfig = tailwindTheme.colors[themeVariant];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-800 shadow-xs hover:shadow-md transition-all duration-300 group flex items-center gap-3">
      <div
        className={`p-2 rounded-lg ${colorConfig.bg} transition-transform group-hover:scale-105 duration-300 shrink-0`}
      >
        <Icon className={`w-4 h-4 ${colorConfig.icon}`} />
      </div>
      
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-widest leading-none mb-1">
          {title}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-black text-gray-900 dark:text-white truncate">
            {typeof value === "number" ? value.toLocaleString() : value}
          </span>
          {suffix && (
            <span className="text-[10px] font-bold text-gray-400">
              {suffix}
            </span>
          )}
          {trend && (
            <div className="flex items-center gap-0.5 ml-auto">
              <TrendIcon className={`w-2.5 h-2.5 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`} />
              <span className={`text-[9px] font-black ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {trend.value}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ReconciliationSummaryProps {
  summary: ReconciliationSummary | null;
}

export function ReconciliationSummaryCards({
  summary,
}: ReconciliationSummaryProps) {
  if (!summary) {
    return null;
  }

  const safeSummary = {
    totalStatements: summary.totalStatements ?? 0,
    percentageReconciled: summary.percentageReconciled ?? 0,
    discrepancies: summary.discrepancies ?? 0,
    unreconciled: summary.unreconciled ?? 0,
    totalDifference: summary.totalDifference ?? 0,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <StatCard
        title="Total Items"
        value={safeSummary.totalStatements}
        icon={FileText}
        themeVariant="info"
        suffix="pcs"
      />
      <StatCard
        title="Reconciled"
        value={safeSummary.percentageReconciled.toFixed(1)}
        icon={CheckCircle}
        themeVariant="success"
        suffix="%"
        trend={{ value: 5, isPositive: true }}
      />
      <StatCard
        title="Discrepant"
        value={safeSummary.discrepancies}
        icon={AlertCircle}
        themeVariant="danger"
        suffix="pcs"
      />
      <StatCard
        title="Pending"
        value={safeSummary.unreconciled}
        icon={HelpCircle}
        themeVariant="warning"
        suffix="pcs"
      />
      <StatCard
        title="Net Diff"
        value={safeSummary.totalDifference.toLocaleString("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0
        })}
        icon={DollarSign}
        themeVariant="accent"
      />
    </div>
  );
}
