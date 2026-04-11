/**
 * PosAggregatesDetail.tsx - FINANCE-GRADE VERSION
 *
 * Premium finance system component following ERP/Payment Gateway standards.
 *
 * Key Features:
 * ✅ Alert System (error, warning, info)
 * ✅ Key Metrics Strip (Nett | Gross | Fee | Diff)
 * ✅ Est vs Actual Reconciliation Comparison
 * ✅ Variance Explanation
 * ✅ Traceability (clickable IDs with context)
 * ✅ Confidence Scoring
 * ✅ Journal Prominence
 * ✅ Audit Trail
 */

import React, { useState, useCallback } from "react";
import {
  FileText,
  Calendar,
  Building,
  CreditCard,
  Clock,
  CheckCircle,
  Building2,
  TrendingUp,
  Shield,
  AlertCircle,
  History,
  Trash2,
  User,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingDown,
} from "lucide-react";
import type { AggregatedTransactionWithDetails } from "../types";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

const formatDateTime = (dateString: string): string =>
  new Date(dateString).toLocaleString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const getStatusColor = (status: string): string => {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800";
    case "FAILED":
      return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800";
    case "PENDING":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    case "PROCESSING":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "CANCELLED":
      return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600";
    default:
      return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600";
  }
};

const getStatusIcon = (status: string): React.ReactNode => {
  switch (status) {
    case "COMPLETED":
      return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
    case "FAILED":
      return <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
    case "PENDING":
      return <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
    case "PROCESSING":
      return <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    default:
      return null;
  }
};

// =============================================================================
// CONFIDENCE SCORING
// =============================================================================

interface ConfidenceResult {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  reasons: string[];
}

const getConfidenceScore = (tx: AggregatedTransactionWithDetails): ConfidenceResult => {
  let score = 100;
  const reasons: string[] = [];

  if (!tx.is_reconciled) {
    score -= 40;
    reasons.push('Belum direkonsiliasi');
  } else {
    reasons.push('✓ Sudah direkonsiliasi');
  }
  
  if (tx.fee_discrepancy !== 0) {
    score -= 30;
    reasons.push(`Selisih fee ${formatCurrency(Math.abs(tx.fee_discrepancy ?? 0))}`);
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

// =============================================================================
// ALERT SYSTEM
// =============================================================================

interface AlertState {
  type: 'error' | 'warning' | 'info';
  icon: React.ReactNode;
  title: string;
  message: string;
  details?: string[];
}

const getAlerts = (tx: AggregatedTransactionWithDetails): AlertState[] => {
  const alerts: AlertState[] = [];

  // Status checks
  if (tx.status === 'FAILED') {
    alerts.push({
      type: 'error',
      icon: <AlertCircle className="w-5 h-5" />,
      title: 'Transaksi Gagal',
      message: tx.failed_reason || 'Transaksi mengalami kegagalan sistem',
      details: tx.failed_at ? [`Waktu: ${formatDateTime(tx.failed_at)}`] : undefined,
    });
  }

  if (tx.status === 'CANCELLED') {
    alerts.push({
      type: 'error',
      icon: <AlertCircle className="w-5 h-5" />,
      title: 'Transaksi Dibatalkan',
      message: 'Transaksi ini telah dibatalkan dan tidak dapat diproses lebih lanjut',
    });
  }

  // Reconciliation checks
  if (!tx.is_reconciled && tx.bank_mutation_id) {
    alerts.push({
      type: 'warning',
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'Verifikasi Final Tertunda',
      message: 'Mutasi bank sudah dicocokkan tapi belum dikonfirmasi rekonsiliasi final',
    });
  }

  // Discrepancy checks
  if (tx.fee_discrepancy !== 0 && tx.is_reconciled) {
    const discrepancyAbs = Math.abs(tx.fee_discrepancy ?? 0);
    const isUnderpayment = (tx.fee_discrepancy ?? 0) > 0;
    alerts.push({
      type: 'warning',
      icon: <TrendingDown className="w-5 h-5" />,
      title: `Selisih Fee ${isUnderpayment ? '(Kurang Bayar)' : '(Lebih Bayar)'}`,
      message: `Fee berbeda sebesar ${formatCurrency(discrepancyAbs)} dari estimasi`,
      details: [
        `Est: ${formatCurrency(tx.total_fee_amount)} | Aktual: ${formatCurrency(tx.actual_fee_amount || 0)}`,
        'Penyebab kemungkinan: rounding, MDR berbeda, atau biaya tambahan bank',
        tx.fee_discrepancy_note ? `📝 ${tx.fee_discrepancy_note}` : null,
      ].filter(Boolean) as string[],
    });
  }

  return alerts;
};

// =============================================================================
// COPY BUTTON COMPONENT
// =============================================================================

const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
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
      className="ml-1.5 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shrink-0"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
};

// =============================================================================
// TRACEABLE ID COMPONENT (Clickable with context)
// =============================================================================

interface TraceableIdProps {
  value: string;
  label: string;
  context?: string;
  onClick?: () => void;
}

const TraceableId: React.FC<TraceableIdProps> = ({ value, label, context, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2.5 rounded-lg text-gray-900 dark:text-white min-w-0 ${onClick ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600' : ''}`}
  >
    <div className="flex-1 min-w-0">
      <div className="break-all flex-1">{value}</div>
      {context && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{context}</div>}
    </div>
    <CopyButton value={value} label={label} />
  </div>
);

// =============================================================================
// ACCORDION SECTION COMPONENT
// =============================================================================

const AccordionSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, iconBg, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
          {title}
        </h3>
        {open ? (
          <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
        )}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
};

// =============================================================================
// RECONCILIATION STEPPER
// =============================================================================

const ReconciliationStepper: React.FC<{
  isReconciled: boolean;
  hasBankMutation: boolean;
  status: string;
}> = ({ isReconciled, hasBankMutation, status }) => {
  const isCancelled = status === "CANCELLED";

  const steps = [
    { label: "Diterima", done: true },
    { label: "Cocok Mutasi", done: hasBankMutation || isReconciled },
    { label: "Verifikasi", done: isReconciled },
  ];

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <AlertCircle className="w-5 h-5 text-gray-400 shrink-0" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Transaksi dibatalkan
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, idx) => (
        <React.Fragment key={idx}>
          <div className="flex flex-col items-center">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                step.done
                  ? "bg-green-500 border-green-500 text-white"
                  : "bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400"
              }`}
            >
              {step.done ? <Check className="w-3 h-3" /> : idx + 1}
            </div>
            <span className={`text-xs font-semibold mt-1 ${step.done ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 ${step.done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// =============================================================================
// PROPS
// =============================================================================

interface PosAggregatesDetailProps {
  transaction: AggregatedTransactionWithDetails;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const PosAggregatesDetail: React.FC<PosAggregatesDetailProps> = ({
  transaction,
}) => {
  const alerts = getAlerts(transaction);
  const confidence = getConfidenceScore(transaction);
  const hasBankMutation = !!(
    transaction.bank_mutation_id || transaction.settlement_group_id || transaction.multi_match_group_id
  );

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* ── HEADER CARD ─────────────────────────────────────────────────── */}
      <div className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-6 pb-6 border-b border-blue-200 dark:border-slate-700">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 dark:bg-slate-800 rounded-lg text-blue-600 dark:text-blue-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Detail Transaksi Agregat</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">Informasi lengkap dan terverifikasi</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-xs sm:text-sm font-mono flex items-center gap-1 truncate shadow-sm">
                <span className="opacity-75">ID:</span>
                <span className="truncate">{transaction.id}</span>
                <CopyButton value={transaction.id} label="ID" />
              </span>
              <span className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap shadow-sm">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">{formatDate(transaction.transaction_date)}</span>
              </span>
              <span
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 shadow-sm border ${getStatusColor(transaction.status)}`}
              >
                {getStatusIcon(transaction.status)}
                <span className="hidden sm:inline">{transaction.status}</span>
              </span>
            </div>
          </div>
          
          {/* Confidence Badge */}
          <div className={`px-4 py-3 rounded-xl text-center shrink-0 ${
            confidence.level === 'HIGH' 
              ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-800'
              : confidence.level === 'MEDIUM'
              ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-800'
              : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800'
          }`}>
            <div className={`text-xs font-bold uppercase ${
              confidence.level === 'HIGH' 
                ? 'text-green-800 dark:text-green-300'
                : confidence.level === 'MEDIUM'
                ? 'text-yellow-800 dark:text-yellow-300'
                : 'text-red-800 dark:text-red-300'
            }`}>
              {confidence.level === 'HIGH' ? '✓ HIGH' : confidence.level === 'MEDIUM' ? '⚠ MEDIUM' : '✗ LOW'}
            </div>
            <div className="text-sm font-bold mt-1">Confidence</div>
          </div>
        </div>

        {/* Embedded Stepper */}
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Alur Rekonsiliasi</h3>
          <ReconciliationStepper
            isReconciled={transaction.is_reconciled}
            hasBankMutation={hasBankMutation}
            status={transaction.status}
          />
        </div>
      </div>

      {/* ── ALERT BAR (if any issues) ──────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`rounded-xl border p-4 ${
                alert.type === 'error'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                  : alert.type === 'warning'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-800'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800'
              }`}
            >
              <div className="flex gap-3">
                <div
                  className={`${
                    alert.type === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : alert.type === 'warning'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-blue-600 dark:text-blue-400'
                  } shrink-0 mt-0.5`}
                >
                  {alert.icon}
                </div>
                <div className="flex-1">
                  <div
                    className={`font-semibold ${
                      alert.type === 'error'
                        ? 'text-red-900 dark:text-red-200'
                        : alert.type === 'warning'
                        ? 'text-yellow-900 dark:text-yellow-200'
                        : 'text-blue-900 dark:text-blue-200'
                    }`}
                  >
                    {alert.title}
                  </div>
                  <p
                    className={`text-sm mt-0.5 ${
                      alert.type === 'error'
                        ? 'text-red-800 dark:text-red-300'
                        : alert.type === 'warning'
                        ? 'text-yellow-800 dark:text-yellow-300'
                        : 'text-blue-800 dark:text-blue-300'
                    }`}
                  >
                    {alert.message}
                  </p>
                  {alert.details && (
                    <div className="mt-2 space-y-1 text-xs">
                      {alert.details.map((detail, i) => (
                        <div
                          key={i}
                          className={
                            alert.type === 'error'
                              ? 'text-red-700 dark:text-red-400'
                              : alert.type === 'warning'
                              ? 'text-yellow-700 dark:text-yellow-400'
                              : 'text-blue-700 dark:text-blue-400'
                          }
                        >
                          {detail}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── KEY METRICS STRIP ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Nett Amount - BIGGEST */}
        <div className="bg-linear-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border-2 border-green-300 dark:border-green-700">
          <div className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">
            Nett Received
          </div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100 mt-2">
            {formatCurrency(transaction.nett_amount)}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            {transaction.is_reconciled ? 'Aktual Bank' : 'Estimasi'}
          </div>
        </div>

        {/* Gross */}
        <div className="bg-linear-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 border-2 border-blue-300 dark:border-blue-700">
          <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
            Gross Amount
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-2">
            {formatCurrency(transaction.gross_amount)}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Sebelum potongan
          </div>
        </div>

        {/* Total Fee */}
        <div className={`bg-linear-to-br rounded-xl p-4 border-2 ${
          transaction.fee_discrepancy === 0
            ? 'from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-300 dark:border-gray-700'
            : 'from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-300 dark:border-orange-700'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wider ${
            transaction.fee_discrepancy === 0
              ? 'text-gray-700 dark:text-gray-400'
              : 'text-orange-700 dark:text-orange-400'
          }`}>
            Total Fee
          </div>
          <div className={`text-2xl font-bold mt-2 ${
            transaction.fee_discrepancy === 0
              ? 'text-gray-900 dark:text-gray-100'
              : 'text-orange-900 dark:text-orange-100'
          }`}>
            {transaction.is_reconciled && transaction.actual_fee_amount != null
              ? formatCurrency(transaction.actual_fee_amount!)
              : formatCurrency(transaction.total_fee_amount)}
          </div>
          <div className={`text-xs mt-1 ${
            transaction.fee_discrepancy === 0
              ? 'text-gray-600 dark:text-gray-400'
              : 'text-orange-600 dark:text-orange-400'
          }`}>
            {transaction.is_reconciled ? 'Aktual' : 'Estimasi'}
          </div>
        </div>

        {/* Discrepancy */}
        <div className={`bg-linear-to-br rounded-xl p-4 border-2 ${
          transaction.fee_discrepancy === 0
            ? 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700'
            : 'from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-300 dark:border-red-700'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wider ${
            transaction.fee_discrepancy === 0
              ? 'text-green-700 dark:text-green-400'
              : 'text-red-700 dark:text-red-400'
          }`}>
            Fee Discrepancy
          </div>
          <div className={`text-2xl font-bold mt-2 ${
            transaction.fee_discrepancy === 0
              ? 'text-green-900 dark:text-green-100'
              : 'text-red-900 dark:text-red-100'
          }`}>
            {transaction.fee_discrepancy === 0
              ? 'Match ✓'
              : formatCurrency(Math.abs(transaction.fee_discrepancy ?? 0))}
          </div>
          <div className={`text-xs mt-1 ${
            transaction.fee_discrepancy === 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {transaction.fee_discrepancy === 0 ? 'Sempurna' : 'Perhatian'}
          </div>
        </div>
      </div>

      {/* ── RECONCILIATION SUMMARY: EST vs ACTUAL ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Estimation (POS) */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-l-4 border-blue-500 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            Estimation (POS)
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Gross</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(transaction.gross_amount)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Fee (Est)</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                - {formatCurrency(transaction.total_fee_amount)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 bg-blue-50 dark:bg-blue-900/20 px-3 rounded-lg border border-blue-200 dark:border-blue-800 mt-3">
              <span className="text-sm font-bold text-blue-900 dark:text-blue-100">= Nett (Est)</span>
              <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                {formatCurrency(transaction.nett_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Actual (Bank) */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-l-4 border-green-500 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            Actual (Bank)
          </h3>
          <div className="space-y-3">
            {transaction.is_reconciled ? (
              <>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Gross</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(transaction.gross_amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Fee (Aktual)</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    - {formatCurrency(transaction.actual_fee_amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 bg-green-50 dark:bg-green-900/20 px-3 rounded-lg border border-green-200 dark:border-green-800 mt-3">
                  <span className="text-sm font-bold text-green-900 dark:text-green-100">= Nett (Aktual)</span>
                  <span className="text-lg font-bold text-green-900 dark:text-green-100">
                    {formatCurrency(transaction.nett_amount - (transaction.fee_discrepancy || 0))}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Belum direkonsiliasi</p>
              </div>
            )}
          </div>
        </div>

        {/* Difference / Variance */}
        <div className={`rounded-2xl shadow-lg border-l-4 p-6 ${
          transaction.fee_discrepancy === 0
            ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-500'
        }`}>
          <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${
            transaction.fee_discrepancy === 0
              ? 'text-green-900 dark:text-green-100'
              : 'text-orange-900 dark:text-orange-100'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              transaction.fee_discrepancy === 0 ? 'bg-green-500' : 'bg-orange-500'
            }`} />
            {transaction.fee_discrepancy === 0 ? 'Match ✓' : 'Variance ⚠'}
          </h3>
          {transaction.is_reconciled ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Fee Diff</span>
                <span className={`font-bold ${
                  transaction.fee_discrepancy === 0
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-orange-700 dark:text-orange-300'
                }`}>
                  {transaction.fee_discrepancy === 0
                    ? 'Rp 0'
                    : formatCurrency(Math.abs(transaction.fee_discrepancy ?? 0))}
                </span>
              </div>
              {transaction.fee_discrepancy !== 0 && (
                <>
                  <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="font-semibold mb-1">Possible causes:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Rounding differences</li>
                      <li>MDR percentage mismatch</li>
                      <li>Bank additional fees</li>
                      <li>Currency conversion</li>
                    </ul>
                  </div>
                  {transaction.fee_discrepancy_note && (
                    <div className="bg-white dark:bg-gray-800 p-2.5 rounded border border-gray-200 dark:border-gray-700 mt-2">
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">📝 Note:</div>
                      <p className="text-xs text-gray-700 dark:text-gray-300 italic">
                        {transaction.fee_discrepancy_note}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Verifikasi belum selesai</p>
            </div>
          )}
        </div>
      </div>

      {/* ── METADATA — 3 COLUMN GRID ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            Informasi Dasar
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Referensi Transaksi
              </label>
              <TraceableId 
                value={transaction.source_ref} 
                label="Referensi Transaksi"
                context="Source: POS System"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                  Tipe
                </label>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {transaction.source_type}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                  Versi
                </label>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  v{transaction.version}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                ID Sumber
              </label>
              <TraceableId 
                value={transaction.source_id} 
                label="ID Sumber"
                context="Internal tracking"
              />
            </div>
          </div>
        </div>

        {/* Branch & Payment */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Building className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            Lokasi & Pembayaran
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Cabang
              </label>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{transaction.branch_name || "Tidak tersedia"}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Metode Pembayaran
              </label>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="font-medium">
                  {transaction.payment_method_name || `ID: ${transaction.payment_method_id}`}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Status Rekonsiliasi
              </label>
              <div className="flex items-center gap-2">
                {transaction.is_reconciled ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Reconciled</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Pending</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            Status Transaksi
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
                Status Saat Ini
              </label>
              <span
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${getStatusColor(transaction.status)}`}
              >
                {getStatusIcon(transaction.status)}
                {transaction.status}
              </span>
            </div>
            {transaction.status === "FAILED" && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <label className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase">
                      Alasan Kegagalan
                    </label>
                    <div className="mt-1 text-sm text-red-800 dark:text-red-300">
                      {transaction.failed_reason || "Tidak diketahui"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BANK RECONCILIATION DETAILS ────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-l-4 border-cyan-500 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-3">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
            <Building2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          Bank Reconciliation
        </h3>
        {transaction.is_reconciled ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4 border border-cyan-200 dark:border-cyan-800">
                <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase block mb-2">
                  Bank Name
                </label>
                <div className="text-sm font-bold text-cyan-900 dark:text-cyan-200">
                  {transaction.bank_name || "-"}
                </div>
              </div>
              <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4 border border-cyan-200 dark:border-cyan-800">
                <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase block mb-2">
                  Account Name
                </label>
                <div className="text-sm font-bold text-cyan-900 dark:text-cyan-200">
                  {transaction.bank_account_name || "-"}
                </div>
              </div>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4 border border-cyan-200 dark:border-cyan-800">
              <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase block mb-2">
                Account Number (Traceable)
              </label>
              <TraceableId 
                value={transaction.bank_account_number || "-"} 
                label="Bank Account"
                context="Bank settlement"
              />
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4 border border-cyan-200 dark:border-cyan-800">
              <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase block mb-2">
                Bank Mutation ID (Source)
              </label>
              <TraceableId 
                value={transaction.bank_mutation_id || "-"} 
                label="Bank Mutation ID"
                context="Bank statement reference"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase block mb-2">
                  Mutation Date
                </label>
                <div className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {transaction.bank_mutation_date ? formatDate(transaction.bank_mutation_date) : "-"}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase block mb-2">
                  Reconciled Date
                </label>
                <div className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {transaction.reconciled_at ? formatDate(transaction.reconciled_at) : "-"}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase block mb-2">
                  Reconciled By
                </label>
                <div className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  {transaction.reconciled_by || "-"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
            <Clock className="w-8 h-8 text-gray-400 mb-2" />
            <div className="font-medium text-gray-900 dark:text-white">Reconciliation Pending</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Awaiting bank mutation matching
            </div>
          </div>
        )}
      </div>

      {/* ── JOURNAL INFO (HIGHLIGHTED) ────────────────────────────────── */}
      {transaction.journal_id && (
        <div className="bg-linear-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-2xl shadow-lg border-l-4 border-purple-500 p-6">
          <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-5 flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            Journal Entry (Accounting)
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <label className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase block mb-2">
                  Journal ID
                </label>
                <TraceableId 
                  value={transaction.journal_id} 
                  label="Journal ID"
                  context="GL reference"
                />
              </div>
              {transaction.journal_number && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <label className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase block mb-2">
                    Journal Number
                  </label>
                  <div className="text-sm font-bold text-purple-900 dark:text-purple-100">
                    {transaction.journal_number}
                  </div>
                </div>
              )}
              {transaction.journal_status && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <label className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase block mb-2">
                    Status
                  </label>
                  <div className="flex items-center gap-2">
                    {transaction.journal_status === "POSTED" ? (
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-bold">Posted</span>
                      </div>
                    ) : (
                      <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                        {transaction.journal_status}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SETTLEMENT GROUP (accordion) ────────────────────────────────── */}
      {transaction.settlement_group_id && (
        <AccordionSection
          title="Settlement Batch"
          icon={<Building2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-100 dark:bg-violet-900/30"
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 border border-violet-200 dark:border-violet-800">
              <label className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase block mb-2">
                Settlement Number
              </label>
              <div className="font-mono text-sm font-bold text-violet-800 dark:text-violet-300">
                {transaction.settlement_number || "-"}
              </div>
            </div>
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 border border-violet-200 dark:border-violet-800">
              <label className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase block mb-2">
                Settlement Date
              </label>
              <div className="text-sm text-violet-800 dark:text-violet-300">
                {transaction.settlement_date ? formatDate(transaction.settlement_date) : "-"}
              </div>
            </div>
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 border border-violet-200 dark:border-violet-800">
              <label className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase block mb-2">
                Status
              </label>
              <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                {transaction.settlement_status || "RECONCILED"}
              </span>
            </div>
          </div>
        </AccordionSection>
      )}

      {/* ── MULTI-MATCH (accordion) ───────────────────────────────────── */}
      {transaction.multi_match_group_id && (
        <AccordionSection
          title="Multi-Match Group"
          icon={<Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <label className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase block mb-2">
                Status
              </label>
              <span
                className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                  transaction.multi_match_status === "RECONCILED"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                    : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                }`}
              >
                {transaction.multi_match_status || "-"}
              </span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <label className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase block mb-2">
                Total Bank Amount
              </label>
              <div className="text-sm font-bold text-amber-800 dark:text-amber-300">
                {transaction.multi_match_total_bank_amount != null
                  ? formatCurrency(transaction.multi_match_total_bank_amount)
                  : "-"}
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <label className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase block mb-2">
                Difference
              </label>
              <div
                className={`text-sm font-bold ${
                  transaction.multi_match_difference === 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {transaction.multi_match_difference != null
                  ? formatCurrency(Math.abs(transaction.multi_match_difference))
                  : "-"}
              </div>
            </div>
          </div>
        </AccordionSection>
      )}

      {/* ── AUDIT LOG ──────────────────────────────────────────────────── */}
      <AccordionSection
        title="Audit Trail"
        icon={<History className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
        iconBg="bg-gray-100 dark:bg-gray-700"
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                Created
              </label>
            </div>
            <div className="pl-11 text-sm text-gray-900 dark:text-white font-medium">
              {formatDateTime(transaction.created_at)}
            </div>
          </div>
          <div className="bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                Updated
              </label>
            </div>
            <div className="pl-11 text-sm text-gray-900 dark:text-white font-medium">
              {formatDateTime(transaction.updated_at)}
            </div>
          </div>
        </div>
        {transaction.deleted_at && (
          <div className="mt-4 bg-linear-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-200 dark:bg-red-900/50 rounded-lg">
                <Trash2 className="w-4 h-4 text-red-700 dark:text-red-400" />
              </div>
              <label className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase">
                Deleted
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-11">
              <div>
                <label className="text-xs text-red-600 dark:text-red-400">Delete Time</label>
                <div className="text-sm text-red-800 dark:text-red-300 font-medium">
                  {formatDateTime(transaction.deleted_at)}
                </div>
              </div>
              {transaction.deleted_by && (
                <div>
                  <label className="text-xs text-red-600 dark:text-red-400">Deleted By</label>
                  <div className="text-sm text-red-800 dark:text-red-300 font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {transaction.deleted_by}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </AccordionSection>

    </div>
  );
};

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesDetail;
