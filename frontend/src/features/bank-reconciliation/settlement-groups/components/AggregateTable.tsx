import React from 'react';
import { Eye, Trash2 } from 'lucide-react';
import { DifferenceIndicator } from './DifferenceIndicator.tsx';
import type { SettlementAggregate } from '../types/settlement-groups.types';

interface AggregateTableProps {
  aggregates: SettlementAggregate[];
  onViewAggregate?: (aggregateId: string) => void;
  onRemoveAggregate?: (aggregateId: string) => void;
  showActions?: boolean;
  showAllocatedColumns?: boolean;
  isLoading?: boolean;
}

export const AggregateTable: React.FC<AggregateTableProps> = ({
  aggregates,
  onViewAggregate,
  onRemoveAggregate,
  showActions = true,
  showAllocatedColumns = true,
  isLoading = false,
}) => {
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading aggregates...</p>
      </div>
    );
  }

  if (aggregates.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No aggregates found in this settlement group.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              {['Transaction Date', 'Branch', 'Payment Method', 'Amount'].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
              {showAllocatedColumns && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Allocated Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Difference</th>
                </>
              )}
              {showActions && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {aggregates.map((agg) => {
              const originalAmount = agg.original_amount || 0;
              const allocatedAmount = agg.allocated_amount || 0;
              const difference = allocatedAmount - originalAmount;

              return (
                <tr key={agg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatDate(agg.aggregate?.transaction_date || agg.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {agg.aggregate?.branch_name || agg.branch_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {agg.aggregate?.payment_method_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatCurrency(originalAmount)}
                  </td>
                  {showAllocatedColumns && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatCurrency(allocatedAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <DifferenceIndicator difference={difference} totalAmount={originalAmount} size="sm" />
                      </td>
                    </>
                  )}
                  {showActions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onViewAggregate?.(agg.aggregate_id)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors" title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => onRemoveAggregate?.(agg.aggregate_id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors" title="Remove">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Total:</span>
          <div className="flex gap-6">
            <span className="text-gray-600 dark:text-gray-400">
              Amount: {formatCurrency(aggregates.reduce((s, a) => s + (a.original_amount || 0), 0))}
            </span>
            {showAllocatedColumns && (
              <>
                <span className="text-gray-600 dark:text-gray-400">
                  Allocated: {formatCurrency(aggregates.reduce((s, a) => s + (a.allocated_amount || 0), 0))}
                </span>
                <DifferenceIndicator
                  difference={aggregates.reduce((s, a) => s + ((a.allocated_amount || 0) - (a.original_amount || 0)), 0)}
                  totalAmount={aggregates.reduce((s, a) => s + (a.original_amount || 0), 0)}
                  size="sm"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
