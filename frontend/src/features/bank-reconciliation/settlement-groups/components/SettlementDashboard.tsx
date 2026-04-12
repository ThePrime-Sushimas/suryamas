import React, { useState } from 'react';
import { Search, Filter, Plus, Download, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { useSettlementGroupsPaginated, useDeleteSettlementGroup } from '../hooks/useSettlementGroups';
import { SettlementStatusBadge } from './SettlementStatusBadge';
import { DifferenceIndicator } from './DifferenceIndicator';
import { ConfirmModal } from '@/features/pos-imports/components/ConfirmModal';
import { Pagination } from '@/components/ui/Pagination';
import type { SettlementGroup, SettlementGroupQueryDto } from '../types/settlement-groups.types';

interface SettlementDashboardProps {
  onCreateNew?: () => void;
  onViewDetails?: (id: string) => void;
}

export const SettlementDashboard: React.FC<SettlementDashboardProps> = ({
  onCreateNew,
  onViewDetails,
}) => {
  const [filters, setFilters] = useState<SettlementGroupQueryDto>({ limit: 10, offset: 0 });
  const [sort, setSort] = useState<{ field: string; order: 'asc' | 'desc' }>({ field: 'created_at', order: 'desc' });
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [showFilters, setShowFilters] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<SettlementGroup | null>(null);

  const {
    data: settlementGroupsData,
    isLoading,
    refetch,
    pagination,
    setPage,
    setPageSize,
  } = useSettlementGroupsPaginated({ ...filters, search: searchTerm || undefined });

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
    const newOrder = sort.order === 'asc' ? 'desc' : 'asc';
    setSort({ field, order: newOrder });
    setFilters({ ...filters, sort: { field, order: newOrder } });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingGroup) return;
    try {
      await deleteMutation.mutateAsync(deletingGroup.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Gagal menghapus settlement: ${msg}`);
    } finally {
      setDeletingGroup(null);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settlement Groups</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
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
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Filter size={16} />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
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
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="RECONCILED">Reconciled</option>
                <option value="DISCREPANCY">Discrepancy</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bank Account</label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors">
                <option value="">All Accounts</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {[
                  { key: 'settlement_number', label: 'Settlement Number', sortable: true },
                  { key: 'settlement_date', label: 'Date', sortable: true },
                  { key: 'bank_statement', label: 'Bank Statement', sortable: false },
                  { key: 'amount', label: 'Amount', sortable: false },
                  { key: 'difference', label: 'Difference', sortable: false },
                  { key: 'status', label: 'Status', sortable: false },
                  { key: 'actions', label: 'Actions', sortable: false },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                    <div className="mt-2">Loading settlement groups...</div>
                  </td>
                </tr>
              ) : settlementGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="text-lg font-medium">No settlement groups found</div>
                    <div className="mt-1">Create your first settlement group to get started.</div>
                  </td>
                </tr>
              ) : (
                settlementGroups.map((group: SettlementGroup) => (
                  <tr key={group.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{group.settlement_number}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{group.aggregates?.length || 0} aggregates</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatDate(group.settlement_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{group.bank_statement?.description || 'N/A'}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{group.bank_name || 'Unknown Bank'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatCurrency(group.total_statement_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <DifferenceIndicator difference={group.difference} totalAmount={group.total_statement_amount} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <SettlementStatusBadge status={group.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewDetails?.(group.id)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingGroup(group)}
                          disabled={deleteMutation.isPending}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50"
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
          <Pagination
            pagination={pagination}
            onPageChange={setPage}
            onLimitChange={setPageSize}
            currentLength={settlementGroups.length}
          />
        )}
      </div>

      {/* Delete Confirmation — Global ConfirmModal with Audit */}
      <ConfirmModal
        isOpen={!!deletingGroup}
        title="Hapus Settlement Group"
        message={`Apakah Anda yakin ingin menghapus settlement group ${deletingGroup?.settlement_number}? Aggregate dan bank statement akan dikembalikan ke status UNRECONCILED. Tindakan ini permanen.`}
        confirmText="Hapus Permanen"
        cancelText="Batal"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingGroup(null)}
        actionType="DELETE"
        entityType="settlement_group"
        contextData={{
          id: deletingGroup?.id,
          name: deletingGroup?.settlement_number,
          type: 'settlement_group',
          date: deletingGroup?.settlement_date,
          amount: deletingGroup?.total_statement_amount,
        }}
        requireReason
        reasonPlaceholder="Alasan menghapus settlement group ini..."
        financialImpact={deletingGroup ? {
          affectedTransactions: deletingGroup.aggregates?.length || 0,
          totalAmount: deletingGroup.total_statement_amount,
          reconciliationImpact: 'Aggregate dan bank statement akan kembali ke status unreconciled',
        } : undefined}
      />
    </div>
  );
};
