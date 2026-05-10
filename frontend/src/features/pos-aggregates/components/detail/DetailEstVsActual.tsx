import React from "react";
import { Clock, CheckCircle2, Info } from "lucide-react";
import type { AggregatedTransactionWithDetails } from "../../types";
import { formatCurrency, type ReconciliationType } from "./shared";

interface Props {
  transaction: AggregatedTransactionWithDetails;
  reconciliationType: ReconciliationType;
}

export const DetailEstVsActual: React.FC<Props> = ({ transaction, reconciliationType }) => {
  const hasFeeData = transaction.actual_fee_amount != null;
  const isBulkRecon = reconciliationType === 'settlement' || reconciliationType === 'multi-match';
  const isVarianceNeutral = transaction.fee_discrepancy == null || transaction.fee_discrepancy === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* Estimation (POS) */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
          Estimation (POS)
        </h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-500">Gross</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">{formatCurrency(transaction.gross_amount)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-500">Fee (Est)</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">- {formatCurrency(transaction.total_fee_amount)}</span>
          </div>
          <div className="flex justify-between py-1.5 bg-blue-50 dark:bg-blue-900/20 px-2 rounded border border-blue-100 dark:border-blue-800 mt-1">
            <span className="font-semibold text-blue-800 dark:text-blue-200">= Nett (Est)</span>
            <span className="font-bold text-blue-800 dark:text-blue-200">{formatCurrency(transaction.nett_amount)}</span>
          </div>
        </div>
      </div>

      {/* Actual (Bank) */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          Actual (Bank)
        </h4>
        <div className="space-y-1.5 text-xs">
          {transaction.is_reconciled ? (
            hasFeeData ? (
              <>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500">Gross</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{formatCurrency(transaction.gross_amount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500">Fee (Aktual)</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">- {formatCurrency(transaction.actual_fee_amount!)}</span>
                </div>
                <div className="flex justify-between py-1.5 bg-green-50 dark:bg-green-900/20 px-2 rounded border border-green-100 dark:border-green-800 mt-1">
                  <span className="font-semibold text-green-800 dark:text-green-200">= Nett (Aktual)</span>
                  <span className="font-bold text-green-800 dark:text-green-200">{formatCurrency(transaction.actual_nett_amount)}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-900/20 rounded text-[10px] font-bold text-green-700 dark:text-green-300 mb-2">
                  <CheckCircle2 className="w-3 h-3" />
                  Reconciled
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Fee aktual per-aggregate belum tersedia.
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {reconciliationType === 'settlement'
                    ? 'Bank settle secara bulk — fee individual tidak terpisah.'
                    : 'Dicocokkan ke beberapa mutasi bank.'}
                </p>
              </div>
            )
          ) : (
            <div className="text-center py-4 text-gray-400">
              <Clock className="w-5 h-5 mx-auto mb-1 opacity-50" />
              <p className="text-[11px]">Belum direkonsiliasi</p>
            </div>
          )}
        </div>
      </div>

      {/* Variance */}
      {transaction.is_reconciled && !hasFeeData && isBulkRecon ? (
        <div className="bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
            Variance
          </h4>
          <div className="text-center py-3">
            <div className="text-sm font-bold text-gray-400">N/A</div>
            <p className="text-[10px] text-gray-400 mt-1">
              Fee tidak dapat dihitung — {reconciliationType === 'settlement' ? 'bulk settlement' : 'multi-match'}.
            </p>
          </div>
        </div>
      ) : (
        <div className={`border rounded-lg p-3 ${
          isVarianceNeutral
            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
            : 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
        }`}>
          <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${
            isVarianceNeutral ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isVarianceNeutral ? 'bg-green-500' : 'bg-orange-500'}`} />
            {isVarianceNeutral ? 'Match ✓' : 'Variance ⚠'}
          </h4>
          {transaction.is_reconciled ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Fee Diff</span>
                <span className={`font-bold ${
                  isVarianceNeutral ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'
                }`}>
                  {isVarianceNeutral ? 'Rp 0' : formatCurrency(Math.abs(transaction.fee_discrepancy!))}
                </span>
              </div>
              {transaction.fee_discrepancy != null && transaction.fee_discrepancy !== 0 && (
                <>
                  <div className="text-[10px] text-gray-500 pt-1.5 border-t border-gray-200 dark:border-gray-700">
                    <p className="font-semibold mb-0.5">Possible causes:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-gray-400">
                      <li>Rounding differences</li>
                      <li>MDR percentage mismatch</li>
                      <li>Bank additional fees</li>
                    </ul>
                  </div>
                  {transaction.fee_discrepancy_note && (
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                      <div className="text-[10px] font-semibold text-gray-500 mb-0.5">📝 Note:</div>
                      <p className="text-[10px] text-gray-600 dark:text-gray-300 italic">{transaction.fee_discrepancy_note}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-3 text-gray-400">
              <Info className="w-4 h-4 mx-auto mb-1 opacity-50" />
              <p className="text-[11px]">Verifikasi belum selesai</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
