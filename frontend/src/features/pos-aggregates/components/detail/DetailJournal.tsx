import React from "react";
import { FileText, CheckCircle2 } from "lucide-react";
import type { AggregatedTransactionWithDetails } from "../../types";
import { TraceableId } from "./shared";

interface Props {
  transaction: AggregatedTransactionWithDetails;
}

export const DetailJournal: React.FC<Props> = ({ transaction }) => {
  if (!transaction.journal_id) return null;

  return (
    <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
      <h4 className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" />
        Journal Entry (Accounting)
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Journal ID</label>
          <TraceableId value={transaction.journal_id} label="Journal ID" context="GL reference" />
        </div>
        {transaction.journal_number && (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Journal Number</label>
            <div className="text-xs font-bold text-purple-800 dark:text-purple-200">{transaction.journal_number}</div>
          </div>
        )}
        {transaction.journal_status && (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">Status</label>
            {transaction.journal_status === "POSTED" ? (
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="font-bold">Posted</span>
              </div>
            ) : (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {transaction.journal_status}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
