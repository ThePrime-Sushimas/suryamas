/**
 * PosAggregatesDetail.tsx
 *
 * Detail view component for aggregated transaction.
 * Displays all transaction details in a comprehensive layout with modern UI.
 *
 * UX Improvements:
 * - Copy button on all ID/ref fields (source_ref, id, journal_id, etc.)
 * - Reconciliation progress stepper so user understands current stage
 * - Accordion/collapsible for secondary sections (Audit, Journal, Multi-match)
 *   to reduce scroll fatigue
 * - Removed orphan Print button (moved to page header)
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
// COPY BUTTON COMPONENT
// =============================================================================

/**
 * Inline copy-to-clipboard button.
 * Shows a checkmark for 1.5s after copying, then resets.
 */
const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers
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
// MONO FIELD COMPONENT (ID / ref fields with copy button)
// =============================================================================

const MonoField: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="flex items-center font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2.5 rounded-lg text-gray-900 dark:text-white min-w-0">
    <span className="break-all flex-1">{value}</span>
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

/**
 * Visual stepper showing where a transaction is in the reconciliation flow:
 * Transaksi Masuk → Cocokkan Mutasi Bank → Rekonsiliasi Selesai
 */
const ReconciliationStepper: React.FC<{
  isReconciled: boolean;
  hasBankMutation: boolean;
  status: string;
}> = ({ isReconciled, hasBankMutation, status }) => {
  const isCancelled = status === "CANCELLED";

  const steps = [
    {
      label: "Transaksi Diterima",
      description: "Data POS masuk ke sistem",
      done: true,
    },
    {
      label: "Cocokkan Mutasi Bank",
      description: "Pilih mutasi bank yang sesuai",
      done: hasBankMutation || isReconciled,
    },
    {
      label: "Rekonsiliasi Selesai",
      description: "Transaksi telah diverifikasi",
      done: isReconciled,
    },
  ];

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
        <AlertCircle className="w-5 h-5 text-gray-400 shrink-0" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Transaksi ini dibatalkan — rekonsiliasi tidak dapat dilanjutkan.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-1">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const isCurrent = !step.done && (idx === 0 || steps[idx - 1].done);

        return (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center min-w-[100px] flex-1">
              {/* Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                  step.done
                    ? "bg-green-500 border-green-500 text-white"
                    : isCurrent
                      ? "bg-white dark:bg-gray-800 border-blue-500 text-blue-500"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-300"
                }`}
              >
                {step.done ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-bold">{idx + 1}</span>
                )}
              </div>
              {/* Label */}
              <div className="mt-2 text-center px-1">
                <div
                  className={`text-xs font-semibold ${
                    step.done
                      ? "text-green-600 dark:text-green-400"
                      : isCurrent
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 hidden sm:block">
                  {step.description}
                </div>
              </div>
            </div>
            {/* Connector line */}
            {!isLast && (
              <div
                className={`flex-1 h-0.5 mt-4 mx-1 transition-colors ${
                  steps[idx + 1].done || (steps[idx].done && !steps[idx + 1].done)
                    ? steps[idx + 1].done
                      ? "bg-green-400"
                      : "bg-blue-300"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
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
// COMPONENT
// =============================================================================

export const PosAggregatesDetail: React.FC<PosAggregatesDetailProps> = ({
  transaction,
}) => {
  const feePercentage =
    transaction.gross_amount > 0
      ? ((transaction.total_fee_amount / transaction.gross_amount) * 100).toFixed(2)
      : "0.00";

  const hasBankMutation = !!(
    transaction.bank_mutation_id || transaction.settlement_group_id || transaction.multi_match_group_id
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── HEADER CARD ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-slate-800 rounded-lg text-blue-600 dark:text-blue-400">
              <Shield className="w-6 h-6" />
            </div>
              <div>
                <h2 className="text-2xl font-bold">Detail Transaksi Agregat</h2>
                <p className="text-black-100 dark:text-slate-300 text-sm mt-1">
                  Informasi lengkap transaksi
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* ID field with copy */}
              <span className="px-3 py-1.5 bg-white/20 dark:bg-black/30 backdrop-blur-sm rounded-lg text-sm font-mono flex items-center gap-1">
                <span className="opacity-75">ID:</span>
                <span>{transaction.id}</span>
                <CopyButton value={transaction.id} label="ID" />
              </span>
              <span className="px-3 py-1.5 bg-white/20 dark:bg-black/30 backdrop-blur-sm rounded-lg text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(transaction.transaction_date)}
              </span>
              <span
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 bg-white/20 dark:bg-black/30 backdrop-blur-sm ${getStatusColor(transaction.status)}`}
              >
                {getStatusIcon(transaction.status)}
                {transaction.status}
              </span>
            </div>
          </div>
          <div className="lg:text-right bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-xl p-4 lg:min-w-[280px]">
            <div className="text-sm text-black-100 dark:text-slate-300 mb-1">Jumlah Settled</div>
            <div className="text-3xl lg:text-4xl font-bold mb-2">
              {formatCurrency(transaction.nett_amount)}
            </div>
            <div className="flex flex-col lg:flex-row gap-2 lg:justify-end text-sm text-black-100 dark:text-slate-300/80">
              <span>Gross: {formatCurrency(transaction.gross_amount)}</span>
              <span className="hidden lg:inline">•</span>
              <span>
                {transaction.is_reconciled && transaction.actual_fee_amount != null
                  ? `Fee (Bank): ${formatCurrency(transaction.actual_fee_amount)}`
                  : `Fee (Est.): ${formatCurrency(transaction.total_fee_amount)}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RECONCILIATION STEPPER ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          Alur Rekonsiliasi
        </h3>
        <ReconciliationStepper
          isReconciled={transaction.is_reconciled}
          hasBankMutation={hasBankMutation}
          status={transaction.status}
        />
      </div>

      {/* ── AMOUNT SUMMARY ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Ringkasan Transaksi
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Gross Amount</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">Total sebelum potongan</div>
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {formatCurrency(transaction.gross_amount)}
            </div>
          </div>
          {transaction.tax_amount > 0 && (
            <div className="flex items-center justify-between py-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">Pajak</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                +{formatCurrency(transaction.tax_amount)}
              </div>
            </div>
          )}
          {transaction.service_charge_amount > 0 && (
            <div className="flex items-center justify-between py-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">Service Charge</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                +{formatCurrency(transaction.service_charge_amount)}
              </div>
            </div>
          )}
          {transaction.discount_amount > 0 && (
            <div className="flex items-center justify-between py-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">Discount</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                -{formatCurrency(transaction.discount_amount)}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between py-3 border-t-2 border-gray-200 dark:border-gray-700 mt-2">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Bill After Discount
            </div>
            <div className="text-base font-semibold text-gray-900 dark:text-white">
              {formatCurrency(transaction.bill_after_discount)}
            </div>
          </div>
        </div>

        {/* Fee Breakdown */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Fee Breakdown</h4>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {feePercentage}% dari gross
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">Percentage Fee</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                -{formatCurrency(transaction.percentage_fee_amount)}
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">Fixed Fee</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                -{formatCurrency(transaction.fixed_fee_amount)}
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-700 mt-2">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Total Fee (Estimated)
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                -{formatCurrency(transaction.total_fee_amount)}
              </div>
            </div>
          </div>
        </div>

        {/* Bank Actuals */}
        {transaction.is_reconciled && transaction.actual_fee_amount != null && (
          <div className="mt-6 pt-4 border-t-2 border-dashed border-indigo-200 dark:border-indigo-900/50">
            <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Realisasi Bank (Actuals)
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">Fee Aktual (dari Bank)</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  -{formatCurrency(transaction.actual_fee_amount)}
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">Selisih Fee</div>
                <div
                  className={`text-sm font-bold ${
                    transaction.fee_discrepancy === 0
                      ? "text-green-600"
                      : transaction.fee_discrepancy && transaction.fee_discrepancy > 0
                        ? "text-red-600"
                        : "text-blue-600"
                  }`}
                >
                  {transaction.fee_discrepancy === 0
                    ? "Tidak ada selisih"
                    : transaction.fee_discrepancy && transaction.fee_discrepancy > 0
                      ? `Kurang Bayar -${formatCurrency(transaction.fee_discrepancy)}`
                      : `Lebih Bayar +${formatCurrency(Math.abs(transaction.fee_discrepancy || 0))}`}
                </div>
              </div>
              {transaction.fee_discrepancy_note && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg mt-2 border border-indigo-100 dark:border-indigo-800">
                  <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase mb-1">
                    Catatan Selisih
                  </div>
                  <div className="text-sm text-indigo-900 dark:text-indigo-200 italic">
                    "{transaction.fee_discrepancy_note}"
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Final settled amount */}
        <div className="mt-6 pt-4 border-t-2 border-gray-300 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-gray-900 dark:text-white">
                {transaction.is_reconciled ? "Actual Amount Received" : "Estimated Amount Settled"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {transaction.is_reconciled
                  ? "Jumlah bersih yang diterima di rekening"
                  : "Jumlah bersih estimasi yang akan disetorkan"}
              </div>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {transaction.is_reconciled && transaction.actual_fee_amount != null
                ? formatCurrency(transaction.nett_amount - (transaction.fee_discrepancy || 0))
                : formatCurrency(transaction.nett_amount)}
            </div>
          </div>
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
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Referensi Transaksi
              </label>
              <div className="mt-1">
                <MonoField value={transaction.source_ref} label="Referensi Transaksi" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tipe
                </label>
                <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {transaction.source_type}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Versi
                </label>
                <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  v{transaction.version}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                ID Sumber
              </label>
              <div className="mt-1">
                <MonoField value={transaction.source_id} label="ID Sumber" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Mata Uang
              </label>
              <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                {transaction.currency}
              </div>
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
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cabang
              </label>
              <div className="mt-1 flex items-center gap-2 text-gray-900 dark:text-white">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{transaction.branch_name || "Tidak tersedia"}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Metode Pembayaran
              </label>
              <div className="mt-1 flex items-center gap-2 text-gray-900 dark:text-white">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="font-medium">
                  {transaction.payment_method_name || `ID: ${transaction.payment_method_id}`}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status Rekonsiliasi
              </label>
              <div className="mt-1">
                {transaction.is_reconciled ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Sudah Direkonsiliasi</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Belum Direkonsiliasi</span>
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
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status Saat Ini
              </label>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${getStatusColor(transaction.status)}`}
                >
                  {getStatusIcon(transaction.status)}
                  {transaction.status}
                </span>
              </div>
            </div>
            {transaction.status === "FAILED" && (
              <div className="bg-linear-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div>
                    <label className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
                      Alasan Kegagalan
                    </label>
                    <div className="mt-1 text-sm text-red-800 dark:text-red-300 font-medium">
                      {transaction.failed_reason || "Tidak diketahui"}
                    </div>
                    {transaction.failed_at && (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-500">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatDateTime(transaction.failed_at)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BANK RECONCILIATION (always visible — primary workflow) ─────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
            <Building2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          Rekonsiliasi Bank
        </h3>
        {transaction.is_reconciled ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-900/30 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
                <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                  Nama Bank
                </label>
                <div className="mt-1 text-sm font-bold text-cyan-800 dark:text-cyan-300">
                  {transaction.bank_name || "-"}
                </div>
              </div>
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-900/30 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
                <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                  Nama Rekening
                </label>
                <div className="mt-1 text-sm font-medium text-cyan-800 dark:text-cyan-300">
                  {transaction.bank_account_name || "-"}
                </div>
              </div>
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-900/30 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
                <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                  Nomor Rekening
                </label>
                <div className="mt-1 font-mono text-sm text-cyan-800 dark:text-cyan-300 flex items-center gap-1">
                  <span>{transaction.bank_account_number || "-"}</span>
                  {transaction.bank_account_number && (
                    <CopyButton value={transaction.bank_account_number} label="Nomor Rekening" />
                  )}
                </div>
              </div>
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-900/30 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
                <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                  ID Mutasi Bank
                </label>
                <div className="mt-1 font-mono text-sm text-cyan-800 dark:text-cyan-300 flex items-center gap-1 min-w-0">
                  <span className="break-all">{transaction.bank_mutation_id || "-"}</span>
                  {transaction.bank_mutation_id && (
                    <CopyButton value={transaction.bank_mutation_id} label="ID Mutasi Bank" />
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tanggal Mutasi Bank
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {transaction.bank_mutation_date ? formatDate(transaction.bank_mutation_date) : "-"}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tanggal Rekonsiliasi
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {transaction.reconciled_at ? formatDateTime(transaction.reconciled_at) : "-"}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Direkonsiliasi Oleh
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  {transaction.reconciled_by || "-"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <div className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full">
              <Clock className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Belum Direkonsiliasi</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Transaksi ini belum dicocokkan dengan mutasi bank
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SETTLEMENT GROUP (accordion — secondary info) ────────────────── */}
      {transaction.settlement_group_id && (
        <AccordionSection
          title="Settlement Group"
          icon={<Building2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-100 dark:bg-violet-900/30"
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 border border-violet-200 dark:border-violet-800">
              <label className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wider">
                Nomor Settlement
              </label>
              <div className="mt-1 font-mono text-sm font-bold text-violet-800 dark:text-violet-300">
                {transaction.settlement_number || "-"}
              </div>
            </div>
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 border border-violet-200 dark:border-violet-800">
              <label className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wider">
                Tanggal Settlement
              </label>
              <div className="mt-1 text-sm text-violet-800 dark:text-violet-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {transaction.settlement_date ? formatDate(transaction.settlement_date) : "-"}
              </div>
            </div>
            <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 border border-violet-200 dark:border-violet-800">
              <label className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wider">
                Status
              </label>
              <div className="mt-1">
                <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                  {transaction.settlement_status || "RECONCILED"}
                </span>
              </div>
            </div>
          </div>
          {transaction.settlement_bank_statement_id && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Bank Statement
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">ID Mutasi</label>
                  <div className="mt-1 font-mono text-sm text-gray-900 dark:text-white">
                    #{transaction.settlement_bank_statement_id}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Deskripsi</label>
                  <div className="mt-1 text-sm text-gray-900 dark:text-white">
                    {transaction.settlement_bank_statement_description || "-"}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Jumlah</label>
                  <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                    {transaction.settlement_bank_statement_amount != null
                      ? formatCurrency(transaction.settlement_bank_statement_amount)
                      : "-"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </AccordionSection>
      )}

      {/* ── MULTI-MATCH (accordion — secondary info) ─────────────────────── */}
      {transaction.multi_match_group_id && (
        <AccordionSection
          title="Multi-Match Bank"
          icon={<Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <label className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Status
              </label>
              <div className="mt-1">
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
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <label className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Total Bank
              </label>
              <div className="mt-1 text-sm font-bold text-amber-800 dark:text-amber-300">
                {transaction.multi_match_total_bank_amount != null
                  ? formatCurrency(transaction.multi_match_total_bank_amount)
                  : "-"}
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <label className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Selisih
              </label>
              <div
                className={`mt-1 text-sm font-bold ${
                  transaction.multi_match_difference === 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {transaction.multi_match_difference != null
                  ? formatCurrency(Math.abs(transaction.multi_match_difference))
                  : "-"}
              </div>
            </div>
          </div>
          {transaction.multi_match_statements && transaction.multi_match_statements.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Bank Statements ({transaction.multi_match_statements.length})
              </div>
              <div className="space-y-2">
                {transaction.multi_match_statements.map((stmt, idx) => (
                  <div
                    key={stmt.id ?? idx}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        #{stmt.id}
                        {stmt.transaction_date && (
                          <span className="ml-2">{formatDate(stmt.transaction_date)}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white truncate mt-0.5">
                        {stmt.description || "-"}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(stmt.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AccordionSection>
      )}

      {/* ── JOURNAL INFO (accordion — secondary info) ────────────────────── */}
      {transaction.journal_id && (
        <AccordionSection
          title="Informasi Jurnal"
          icon={<FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Journal ID
              </label>
              <div className="mt-1">
                <MonoField value={transaction.journal_id} label="Journal ID" />
              </div>
            </div>
            {transaction.journal_number && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Nomor Jurnal
                </label>
                <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                  {transaction.journal_number}
                </div>
              </div>
            )}
            {transaction.journal_status && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status Jurnal
                </label>
                <div className="mt-1">
                  <span
                    className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      transaction.journal_status === "POSTED"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                        : "bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {transaction.journal_status}
                  </span>
                </div>
              </div>
            )}
          </div>
        </AccordionSection>
      )}

      {/* ── AUDIT INFO (accordion — least-used, collapse by default) ─────── */}
      <AccordionSection
        title="Informasi Audit"
        icon={<History className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
        iconBg="bg-gray-100 dark:bg-gray-700"
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Dibuat
              </label>
            </div>
            <div className="pl-11 text-sm text-gray-900 dark:text-white font-medium">
              {formatDateTime(transaction.created_at)}
            </div>
          </div>
          <div className="bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Diperbarui
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
              <label className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
                Dihapus
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-11">
              <div>
                <label className="text-xs text-red-600 dark:text-red-400">Tanggal Penghapusan</label>
                <div className="text-sm text-red-800 dark:text-red-300 font-medium">
                  {formatDateTime(transaction.deleted_at)}
                </div>
              </div>
              {transaction.deleted_by && (
                <div>
                  <label className="text-xs text-red-600 dark:text-red-400">Dihapus Oleh</label>
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
