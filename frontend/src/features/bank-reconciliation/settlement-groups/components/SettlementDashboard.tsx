/**
 * Settlement Dashboard Component
 * Main dashboard displaying settlement groups with filters and table
 */

import React, { useState } from 'react';
import { Search, Filter, Plus, Download, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { useSettlementGroups, useDeleteSettlementGroup } from '../hooks/useSettlementGroups';
import { SettlementStatusBadge } from './SettlementStatusBadge';
import { DifferenceIndicator } from './DifferenceIndicator';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import type { SettlementGroup, SettlementGroupQueryDto } from '../types/settlement-groups.types';

interface SettlementDashboardProps {
  onCreateNew?: () => void;
  onViewDetails?: (id: string) => void;
}

export const SettlementDashboard: React.FC<SettlementDashboardProps> = ({
  onCreateNew,
  onViewDetails,
}) => {
  // Local state for filters and sort
  const [filters, setFilters] = useState<SettlementGroupQueryDto>({
    limit: 10,
    offset: 0,
  });
  const [sort, setSort] = useState<{ field: string; order: 'asc' | 'desc' }>({
    field: 'created_at',
    order: 'desc'
  });

  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [showFilters, setShowFilters] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Active groups query
  const { data: settlementGroupsData, isLoading, refetch } = useSettlementGroups({
    ...filters,
    search: searchTerm || undefined,
  });

  const deleteMutation = useDeleteSettlementGroup();

  const settlementGroups = settlementGroupsData?.data || [];
  const total = settlementGroupsData?.total || 0;

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setFilters({ ...filters, search: value || undefined });
  };

  const handleFilterChange = (key: keyof SettlementGroupQueryDto, value: string | undefined) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleSort = (field: string) => {
    const currentOrder = sort.order;
    const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
    setSort({ field, order: newOrder });
    setFilters({ ...filters, sort: { field, order: newOrder } });
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleDeleteClick = (groupId: string) => {
    setDeletingId(groupId);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      await deleteMutation.mutateAsync(deletingId);
      setDeletingId(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`Gagal menghapus settlement: ${errorMessage}`);
      setDeletingId(null);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settlement Groups</h1>
          <p className="text-gray-600 mt-1">
            Manage bulk settlements by grouping multiple POS aggregates to bank statements
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Settlement
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            <Filter size={16} />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search settlement groups..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="RECONCILED">Reconciled</option>
                <option value="DISCREPANCY">Discrepancy</option>
              </select>
            </div>

            {/* Bank Account Filter - Placeholder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Account
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                <option value="">All Accounts</option>
                {/* TODO: Populate with actual bank accounts */}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('settlement_number')}
                >
                  Settlement Number
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('settlement_date')}
                >
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bank Statement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Difference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                    <div className="mt-2">
                      Loading settlement groups...
                    </div>
                  </td>
                </tr>
              ) : settlementGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="text-lg font-medium">
                      No settlement groups found
                    </div>
                    <div className="mt-1">
                      Create your first settlement group to get started.
                    </div>
                  </td>
                </tr>
              ) : (
                settlementGroups.map((group: SettlementGroup) => (
                  <tr key={group.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {group.settlement_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {group.aggregates?.length || 0} aggregates
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(group.settlement_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {group.bank_statement?.description || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {group.bank_name || 'Unknown Bank'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(group.total_statement_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <DifferenceIndicator
                        difference={group.difference}
                        totalAmount={group.total_statement_amount}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <SettlementStatusBadge 
                        status={group.status} 
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewDetails?.(group.id)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(group.id)}
                          disabled={deleteMutation.isPending}
                          className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50"
                          title="Delete Settlement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {settlementGroups.length} of {total} settlement groups
              </div>
              <div className="flex items-center gap-2">
                <button 
                  className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={true}
                >
                  Previous
                </button>
                <button 
                  className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={true}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <DeleteConfirmationModal
          isOpen={!!deletingId}
          onClose={() => setDeletingId(null)}
          onConfirm={handleDeleteConfirm}
          settlementNumber={
            settlementGroups.find(g => g.id === deletingId)?.settlement_number || ''
          }
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
};

