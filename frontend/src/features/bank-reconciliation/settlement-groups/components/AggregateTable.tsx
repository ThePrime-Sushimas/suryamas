/**
 * Aggregate Table Component
 * Displays aggregates within a settlement group
 */

import React from 'react';
import { Eye, Trash2 } from 'lucide-react';
import { DifferenceIndicator } from './DifferenceIndicator.tsx';
import type { SettlementAggregate } from '../types/settlement-groups.types';

interface AggregateTableProps {
  aggregates: SettlementAggregate[];
  onViewAggregate?: (aggregateId: string) => void;
  onRemoveAggregate?: (aggregateId: string) => void;
  showActions?: boolean;
  isLoading?: boolean;
}

export const AggregateTable: React.FC<AggregateTableProps> = ({
  aggregates,
  onViewAggregate,
  onRemoveAggregate,
  showActions = true,
  isLoading = false,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading aggregates...</p>
      </div>
    );
  }

  if (aggregates.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">No aggregates found in this settlement group.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          Aggregates ({aggregates.length})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transaction Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Branch
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Original Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Allocated Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Difference
              </th>
              {showActions && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {aggregates.map((aggregate) => {
              const difference = aggregate.allocated_amount - aggregate.original_amount;

              return (
                <tr key={aggregate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(aggregate.aggregate?.transaction_date || aggregate.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {aggregate.branch_name || aggregate.aggregate?.branch_name || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {aggregate.branch_code || aggregate.aggregate?.branch_code}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {aggregate.aggregate?.payment_method_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(aggregate.original_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(aggregate.allocated_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <DifferenceIndicator
                      difference={difference}
                      totalAmount={aggregate.original_amount}
                      size="sm"
                    />
                  </td>
                  {showActions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewAggregate?.(aggregate.aggregate_id)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="View Aggregate Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onRemoveAggregate?.(aggregate.aggregate_id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="Remove from Settlement"
                        >
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
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-gray-700">Total:</span>
          <div className="flex gap-6">
            <span className="text-gray-600">
              Original: {formatCurrency(aggregates.reduce((sum, agg) => sum + agg.original_amount, 0))}
            </span>
            <span className="text-gray-600">
              Allocated: {formatCurrency(aggregates.reduce((sum, agg) => sum + agg.allocated_amount, 0))}
            </span>
            <DifferenceIndicator
              difference={aggregates.reduce((sum, agg) => sum + (agg.allocated_amount - agg.original_amount), 0)}
              totalAmount={aggregates.reduce((sum, agg) => sum + agg.original_amount, 0)}
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
