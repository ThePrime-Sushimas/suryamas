/**
 * Settlement Detail Modal Component
 * Modal for viewing settlement group details
 */

import React from 'react';
import { X, Calendar, CreditCard, Building, FileText, User } from 'lucide-react';
import { useSettlementGroup } from '../hooks/useSettlementGroups';
import { SettlementStatusBadge } from './SettlementStatusBadge';
import { DifferenceIndicator } from './DifferenceIndicator';
import { AggregateTable } from './AggregateTable.tsx';

interface SettlementDetailModalProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SettlementDetailModal: React.FC<SettlementDetailModalProps> = ({
  groupId,
  isOpen,
  onClose,
}) => {
  const { data: settlementGroup, isLoading, error } = useSettlementGroup(groupId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              Settlement Group Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading settlement details...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600">Error loading settlement details</p>
                <p className="text-gray-500 text-sm mt-1">{error.message}</p>
              </div>
            ) : settlementGroup ? (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Settlement Number</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900 ml-7">
                      {settlementGroup.settlement_number}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Settlement Date</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900 ml-7">
                      {formatDate(settlementGroup.settlement_date)}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Status</span>
                    </div>
                    <div className="ml-7">
                      <SettlementStatusBadge status={settlementGroup.status} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Bank</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900 ml-7">
                      {settlementGroup.bank_name || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Bank Statement Information */}
                {settlementGroup.bank_statement && (
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Bank Statement</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-gray-500">Description</span>
                          <p className="text-sm font-medium text-gray-900">
                            {settlementGroup.bank_statement.description}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Amount</span>
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(settlementGroup.bank_statement.amount || 0)}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Transaction Date</span>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(settlementGroup.bank_statement.transaction_date)}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Reference</span>
                          <p className="text-sm font-medium text-gray-900">
                            {settlementGroup.bank_statement.reference_number || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount Summary */}
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-4">Amount Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-blue-600 font-medium">Statement Amount</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {formatCurrency(settlementGroup.total_statement_amount)}
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm text-green-600 font-medium">Allocated Amount</div>
                      <div className="text-2xl font-bold text-green-900">
                        {formatCurrency(settlementGroup.total_allocated_amount)}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 font-medium">Difference</div>
                      <div className="mt-1">
                        <DifferenceIndicator
                          difference={settlementGroup.difference}
                          totalAmount={settlementGroup.total_statement_amount}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {settlementGroup.notes && (
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="text-md font-medium text-gray-900 mb-2">Notes</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {settlementGroup.notes}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Created by</span>
                  </div>
                  <div className="text-sm text-gray-600 ml-6">
                    {settlementGroup.created_by || 'System'} on {formatDate(settlementGroup.created_at)}
                  </div>
                  {settlementGroup.confirmed_at && (
                    <div className="text-sm text-gray-600 ml-6 mt-1">
                      Confirmed on {formatDate(settlementGroup.confirmed_at)}
                    </div>
                  )}
                </div>

                {/* Aggregates Table */}
                {settlementGroup.aggregates && settlementGroup.aggregates.length > 0 && (
                  <div className="border-t border-gray-200 pt-6">
                    <AggregateTable
                      aggregates={settlementGroup.aggregates}
                      showActions={false}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">Settlement group not found</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
