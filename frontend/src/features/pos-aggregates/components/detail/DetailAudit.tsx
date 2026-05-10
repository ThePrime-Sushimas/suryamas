import React from "react";
import { History, CheckCircle, Trash2, User } from "lucide-react";
import type { AggregatedTransactionWithDetails } from "../../types";
import { formatDateTime, AccordionSection } from "./shared";

interface Props {
  transaction: AggregatedTransactionWithDetails;
}

export const DetailAudit: React.FC<Props> = ({ transaction }) => (
  <AccordionSection
    title="Audit Trail"
    icon={<History className="w-3.5 h-3.5 text-gray-500" />}
    defaultOpen={false}
  >
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 border border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2 mb-1.5">
          <CheckCircle className="w-3 h-3 text-green-500" />
          <label className="text-[10px] font-semibold text-gray-500 uppercase">Created</label>
        </div>
        <div className="text-xs text-gray-800 dark:text-gray-200 pl-5">{formatDateTime(transaction.created_at)}</div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 border border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2 mb-1.5">
          <History className="w-3 h-3 text-blue-500" />
          <label className="text-[10px] font-semibold text-gray-500 uppercase">Updated</label>
        </div>
        <div className="text-xs text-gray-800 dark:text-gray-200 pl-5">{formatDateTime(transaction.updated_at)}</div>
      </div>
    </div>
    {transaction.deleted_at && (
      <div className="mt-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Trash2 className="w-3 h-3 text-red-500" />
          <label className="text-[10px] font-semibold text-red-600 uppercase">Deleted</label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-5">
          <div>
            <label className="text-[10px] text-red-500">Delete Time</label>
            <div className="text-xs text-red-700 dark:text-red-300">{formatDateTime(transaction.deleted_at)}</div>
          </div>
          {transaction.deleted_by && (
            <div>
              <label className="text-[10px] text-red-500">Deleted By</label>
              <div className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1">
                <User className="w-3 h-3" />
                {transaction.deleted_by}
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </AccordionSection>
);
