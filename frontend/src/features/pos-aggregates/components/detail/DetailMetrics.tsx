import React from "react";
import type { AggregatedTransactionWithDetails } from "../../types";
import { formatCurrency, type ReconciliationType } from "./shared";

interface Props {
  transaction: AggregatedTransactionWithDetails;
  reconciliationType: ReconciliationType;
}

export const DetailMetrics: React.FC<Props> = ({ transaction, reconciliationType }) => {
  const hasFeeData = transaction.actual_fee_amount != null;
  const isBulkRecon = reconciliationType === 'settlement' || reconciliationType === 'multi-match';

  const feeLabel = hasFeeData ? 'Aktual' : isBulkRecon ? 'Est (bulk)' : transaction.is_reconciled ? 'Aktual' : 'Estimasi';
  const feeValue = hasFeeData ? transaction.actual_fee_amount! : transaction.total_fee_amount;
  const hasDiscrepancy = hasFeeData && transaction.fee_discrepancy !== 0;

  const isDiscrepancyNeutral = transaction.fee_discrepancy == null || transaction.fee_discrepancy === 0;
  const showDiscrepancyNA = !hasFeeData && isBulkRecon && transaction.is_reconciled;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {/* Nett */}
      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-md px-3 py-2.5">
        <div className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase">Nett Received</div>
        <div className="text-base font-bold text-green-800 dark:text-green-200 mt-1">
          {formatCurrency(transaction.nett_amount)}
        </div>
        <div className="text-[10px] text-green-600 dark:text-green-400">
          {transaction.is_reconciled ? 'Aktual Bank' : 'Estimasi'}
        </div>
      </div>

      {/* Gross */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2.5">
        <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">Gross Amount</div>
        <div className="text-base font-bold text-blue-800 dark:text-blue-200 mt-1">
          {formatCurrency(transaction.gross_amount)}
        </div>
        <div className="text-[10px] text-blue-600 dark:text-blue-400">Sebelum potongan</div>
      </div>

      {/* Fee */}
      <div className={`border rounded-md px-3 py-2.5 ${
        hasDiscrepancy
          ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
        <div className={`text-[10px] font-semibold uppercase ${
          hasDiscrepancy ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'
        }`}>Total Fee</div>
        <div className={`text-base font-bold mt-1 ${
          hasDiscrepancy ? 'text-orange-800 dark:text-orange-200' : 'text-gray-800 dark:text-gray-200'
        }`}>
          {formatCurrency(feeValue)}
        </div>
        <div className={`text-[10px] ${
          hasDiscrepancy ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'
        }`}>{feeLabel}</div>
      </div>

      {/* Discrepancy */}
      {showDiscrepancyNA ? (
        <div className="bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-md px-3 py-2.5">
          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Fee Discrepancy</div>
          <div className="text-sm font-bold text-gray-400 dark:text-gray-500 mt-1">N/A</div>
          <div className="text-[10px] text-gray-400 dark:text-gray-500">Bulk — belum dihitung</div>
        </div>
      ) : (
        <div className={`border rounded-md px-3 py-2.5 ${
          isDiscrepancyNeutral
            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
        }`}>
          <div className={`text-[10px] font-semibold uppercase ${
            isDiscrepancyNeutral ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>Fee Discrepancy</div>
          <div className={`text-base font-bold mt-1 ${
            isDiscrepancyNeutral ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
          }`}>
            {isDiscrepancyNeutral ? 'Match ✓' : formatCurrency(Math.abs(transaction.fee_discrepancy!))}
          </div>
          <div className={`text-[10px] ${
            isDiscrepancyNeutral ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {isDiscrepancyNeutral ? 'Sempurna' : 'Perhatian'}
          </div>
        </div>
      )}
    </div>
  );
};
