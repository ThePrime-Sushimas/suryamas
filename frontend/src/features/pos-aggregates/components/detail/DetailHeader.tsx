import React from "react";
import { Calendar, Check, Clock, AlertCircle, Shield } from "lucide-react";
import type { AggregatedTransactionWithDetails } from "../../types";
import {
  formatDate,
  getStatusColor,
  getStatusIcon,
  getConfidenceScore,
  CopyButton,
} from "./shared";

const ReconciliationStepper: React.FC<{
  isReconciled: boolean;
  hasBankMutation: boolean;
  status: string;
}> = ({ isReconciled, hasBankMutation, status }) => {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <AlertCircle className="w-3.5 h-3.5" />
        Transaksi dibatalkan
      </div>
    );
  }

  const steps = [
    { label: "Diterima", done: true },
    { label: "Cocok Mutasi", done: hasBankMutation || isReconciled },
    { label: "Verifikasi", done: isReconciled },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {steps.map((step, idx) => (
        <React.Fragment key={idx}>
          <div className="flex flex-col items-center">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step.done
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
              }`}
            >
              {step.done ? <Check className="w-2.5 h-2.5" /> : idx + 1}
            </div>
            <span className={`text-[10px] mt-0.5 ${step.done ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-px ${step.done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

interface Props {
  transaction: AggregatedTransactionWithDetails;
  hasBankMutation: boolean;
}

export const DetailHeader: React.FC<Props> = ({ transaction, hasBankMutation }) => {
  const confidence = getConfidenceScore(transaction);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Detail Transaksi Agregat</h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 rounded text-[11px] font-mono flex items-center gap-1 border border-gray-200 dark:border-gray-600">
              <span className="text-gray-500">ID:</span>
              <span className="truncate max-w-[180px]">{transaction.id}</span>
              <CopyButton value={transaction.id} label="ID" />
            </span>
            <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 rounded text-[11px] flex items-center gap-1 border border-gray-200 dark:border-gray-600">
              <Calendar className="w-3 h-3 text-gray-400" />
              <span className="hidden sm:inline">{formatDate(transaction.transaction_date)}</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 border ${getStatusColor(transaction.status)}`}>
              {getStatusIcon(transaction.status)}
              {transaction.status}
            </span>
          </div>
        </div>

        {/* Confidence */}
        <div className={`px-3 py-1.5 rounded-md text-center shrink-0 border ${
          confidence.level === 'HIGH'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : confidence.level === 'MEDIUM'
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className={`text-[10px] font-bold uppercase ${
            confidence.level === 'HIGH'
              ? 'text-green-700 dark:text-green-300'
              : confidence.level === 'MEDIUM'
              ? 'text-yellow-700 dark:text-yellow-300'
              : 'text-red-700 dark:text-red-300'
          }`}>
            {confidence.level === 'HIGH' ? '✓ HIGH' : confidence.level === 'MEDIUM' ? '⚠ MEDIUM' : '✗ LOW'}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Confidence</div>
        </div>
      </div>

      {/* Stepper */}
      <div>
        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Alur Rekonsiliasi</span>
        <div className="mt-1.5">
          <ReconciliationStepper
            isReconciled={transaction.is_reconciled}
            hasBankMutation={hasBankMutation}
            status={transaction.status}
          />
        </div>
      </div>
    </div>
  );
};
