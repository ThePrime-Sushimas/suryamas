import React, { useState, useCallback } from "react";
import {
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import type { AggregatedTransactionWithDetails } from "../../types";

// ─── Formatters ───────────────────────────────────────────────────────────────

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

export const formatDateTime = (dateString: string): string =>
  new Date(dateString).toLocaleString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

// ─── Status helpers ───────────────────────────────────────────────────────────

export const getStatusColor = (status: string): string => {
  switch (status) {
    case "COMPLETED":
      return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
    case "FAILED":
      return "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
    case "PENDING":
      return "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    case "PROCESSING":
      return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    default:
      return "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600";
  }
};

export const getStatusIcon = (status: string): React.ReactNode => {
  switch (status) {
    case "COMPLETED":
      return <CheckCircle className="w-3.5 h-3.5" />;
    case "FAILED":
      return <AlertCircle className="w-3.5 h-3.5" />;
    case "PENDING":
      return <Clock className="w-3.5 h-3.5" />;
    case "PROCESSING":
      return <TrendingUp className="w-3.5 h-3.5" />;
    default:
      return null;
  }
};

// ─── Reconciliation type ──────────────────────────────────────────────────────

export type ReconciliationType = 'single' | 'settlement' | 'multi-match' | 'cash-deposit' | 'none';

export const getReconciliationType = (tx: AggregatedTransactionWithDetails): ReconciliationType =>
  tx.bank_mutation_id ? 'single'
  : tx.settlement_group_id ? 'settlement'
  : tx.multi_match_group_id ? 'multi-match'
  : tx.cash_deposit_id ? 'cash-deposit'
  : 'none';

// ─── Confidence ───────────────────────────────────────────────────────────────

export interface ConfidenceResult {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  reasons: string[];
}

export const getConfidenceScore = (tx: AggregatedTransactionWithDetails): ConfidenceResult => {
  let score = 100;
  const reasons: string[] = [];
  const isBulkRecon = !!(tx.settlement_group_id || tx.multi_match_group_id);

  if (!tx.is_reconciled) {
    score -= 40;
    reasons.push('Belum direkonsiliasi');
  } else {
    reasons.push('✓ Sudah direkonsiliasi');
  }

  if (tx.actual_fee_amount == null && isBulkRecon && tx.is_reconciled) {
    score -= 10;
    reasons.push('Fee per-aggregate belum tersedia (bulk)');
  } else if (tx.fee_discrepancy !== 0 && tx.fee_discrepancy != null) {
    score -= 30;
    reasons.push(`Selisih fee ${formatCurrency(Math.abs(tx.fee_discrepancy))}`);
  } else if (tx.is_reconciled) {
    reasons.push('✓ Fee match sempurna');
  }

  if (tx.status !== 'COMPLETED') {
    score -= 20;
    reasons.push(`Status: ${tx.status}`);
  } else {
    reasons.push('✓ Status normal');
  }

  const level: 'HIGH' | 'MEDIUM' | 'LOW' = score >= 80 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';
  return { level, score, reasons };
};

// ─── Alerts ───────────────────────────────────────────────────────────────────

export interface AlertState {
  type: 'error' | 'warning' | 'info';
  icon: React.ReactNode;
  title: string;
  message: string;
  details?: string[];
}

export const getAlerts = (tx: AggregatedTransactionWithDetails): AlertState[] => {
  const alerts: AlertState[] = [];

  if (tx.status === 'FAILED') {
    alerts.push({
      type: 'error',
      icon: <AlertCircle className="w-4 h-4" />,
      title: 'Transaksi Gagal',
      message: tx.failed_reason || 'Transaksi mengalami kegagalan sistem',
      details: tx.failed_at ? [`Waktu: ${formatDateTime(tx.failed_at)}`] : undefined,
    });
  }

  if (tx.status === 'CANCELLED') {
    alerts.push({
      type: 'error',
      icon: <AlertCircle className="w-4 h-4" />,
      title: 'Transaksi Dibatalkan',
      message: 'Transaksi ini telah dibatalkan',
    });
  }

  if (!tx.is_reconciled && tx.bank_mutation_id) {
    alerts.push({
      type: 'warning',
      icon: <AlertCircle className="w-4 h-4" />,
      title: 'Verifikasi Final Tertunda',
      message: 'Mutasi bank sudah dicocokkan tapi belum dikonfirmasi rekonsiliasi final',
    });
  }

  if (tx.fee_discrepancy != null && tx.fee_discrepancy !== 0 && tx.is_reconciled) {
    const isUnderpayment = tx.fee_discrepancy > 0;
    alerts.push({
      type: 'warning',
      icon: <AlertCircle className="w-4 h-4" />,
      title: `Selisih Fee ${isUnderpayment ? '(Kurang Bayar)' : '(Lebih Bayar)'}`,
      message: `Fee berbeda sebesar ${formatCurrency(Math.abs(tx.fee_discrepancy))} dari estimasi`,
      details: [
        `Est: ${formatCurrency(tx.total_fee_amount)} | Aktual: ${formatCurrency(tx.actual_fee_amount || 0)}`,
        'Penyebab: rounding, MDR berbeda, atau biaya tambahan bank',
        tx.fee_discrepancy_note ? `📝 ${tx.fee_discrepancy_note}` : null,
      ].filter(Boolean) as string[],
    });
  }

  return alerts;
};

// ─── CopyButton ───────────────────────────────────────────────────────────────

export const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [value]);

  return (
    <button
      onClick={handleCopy}
      title={`Salin ${label || "nilai"}`}
      className="ml-1 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

// ─── TraceableId ──────────────────────────────────────────────────────────────

export const TraceableId: React.FC<{
  value: string;
  label: string;
  context?: string;
  onClick?: () => void;
}> = ({ value, label, context, onClick }) => (
  <div
    onClick={onClick}
    className={`flex items-center font-mono text-xs bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 min-w-0 ${onClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''}`}
  >
    <div className="flex-1 min-w-0">
      <div className="break-all">{value}</div>
      {context && <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{context}</div>}
    </div>
    <CopyButton value={value} label={label} />
  </div>
);

// ─── AccordionSection ─────────────────────────────────────────────────────────

export const AccordionSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          {icon}
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">{children}</div>}
    </div>
  );
};
