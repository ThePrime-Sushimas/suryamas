import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  User,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  CreditCard,
  Building,
} from 'lucide-react';
import { useSettlementGroup, useDeleteSettlementGroup } from '../hooks/useSettlementGroups';
import { SettlementStatusBadge } from '../components/SettlementStatusBadge';
import { DifferenceIndicator } from '../components/DifferenceIndicator';
import { AggregateTable } from '../components/AggregateTable';
import { ConfirmModal } from '@/features/pos-imports/components/ConfirmModal';

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
};

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatDateTime = (dateString: string | null | undefined) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="font-medium text-gray-900 dark:text-white">{value || '-'}</p>
    </div>
  );
}

function StatusHeader({ status }: { status: string | undefined }) {
  const statusConfig: Record<string, { icon: typeof Clock; bg: string; text: string; label: string }> = {
    PENDING: { icon: Clock, bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: 'Pending' },
    RECONCILED: { icon: CheckCircle, bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: 'Reconciled' },
    DISCREPANCY: { icon: AlertCircle, bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: 'Discrepancy' },
    UNDO: { icon: Clock, bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: 'Undone' },
  };
  const defaultConfig = { icon: Clock, bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: 'Unknown' };
  const config = status ? statusConfig[status] || defaultConfig : defaultConfig;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-4 h-4" />
      {config.label}
    </span>
  );
}

export default function SettlementGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: sg, isLoading, error } = useSettlementGroup(id || '');
  const deleteMutation = useDeleteSettlementGroup();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleBack = useCallback(() => navigate('/bank-reconciliation/settlement-groups'), [navigate]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/bank-reconciliation/settlement-groups');
    } catch (err) {
      console.error('Error deleting settlement group:', err);
    } finally {
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !sg) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400 mb-4">
            {error?.message || 'Settlement group not found'}
          </div>
          <button onClick={handleBack} className="inline-flex items-center gap-2 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-r from-blue-600 to-blue-700 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-lg">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">{sg.settlement_number}</h1>
                  <p className="text-blue-100 mt-1">{formatDate(sg.settlement_date)}</p>
                </div>
              </div>
              <StatusHeader status={sg.status} />
            </div>
            <div className="flex flex-wrap gap-2 mt-6">
              <button onClick={handleBack} className="inline-flex items-center gap-2 bg-white/20 text-white px-6 py-2 rounded-lg hover:bg-white/30 transition-colors font-medium backdrop-blur-sm">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button onClick={() => setShowDeleteModal(true)} className="inline-flex items-center gap-2 bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors font-medium">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 space-y-8">
            {/* Basic Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" /> Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <InfoItem label="Settlement Number" value={sg.settlement_number} />
                <InfoItem label="Settlement Date" value={formatDate(sg.settlement_date)} />
                <InfoItem label="Status" value={<SettlementStatusBadge status={sg.status} />} />
                <InfoItem label="Bank" value={sg.bank_name || '-'} />
                <InfoItem label="Payment Method" value={sg.payment_method || '-'} />
                <InfoItem label="Created By" value={sg.created_by || 'System'} />
              </div>
            </div>

            {/* Amount Summary */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-400" /> Amount Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Statement Amount</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-1">{formatCurrency(sg.total_statement_amount)}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                  <div className="text-sm text-green-600 dark:text-green-400 font-medium">Allocated Amount</div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-200 mt-1">{formatCurrency(sg.total_allocated_amount)}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Difference</div>
                  <div className="mt-1">
                    <DifferenceIndicator difference={sg.difference} totalAmount={sg.total_statement_amount} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Statement */}
            {sg.bank_statement && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5 text-gray-400" /> Bank Statement
                </h2>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <InfoItem label="Description" value={sg.bank_statement.description} />
                    <InfoItem label="Amount" value={formatCurrency(sg.bank_statement.amount || 0)} />
                    <InfoItem label="Transaction Date" value={formatDate(sg.bank_statement.transaction_date)} />
                    <InfoItem label="Reference" value={sg.bank_statement.reference_number || '-'} />
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {sg.notes && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-400" /> Notes
                </h2>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-100 dark:border-yellow-800">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{sg.notes}</p>
                </div>
              </div>
            )}

            {/* Aggregates */}
            {sg.aggregates && sg.aggregates.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-gray-400" /> Aggregates ({sg.aggregates.length})
                </h2>
                <AggregateTable aggregates={sg.aggregates} showActions={false} showAllocatedColumns={false} />
              </div>
            )}

            {/* System Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" /> System Information
              </h2>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoItem label="Created At" value={formatDateTime(sg.created_at)} />
                  <InfoItem label="Updated At" value={formatDateTime(sg.updated_at)} />
                  {sg.confirmed_at && <InfoItem label="Confirmed At" value={formatDateTime(sg.confirmed_at)} />}
                  {sg.deleted_at && <InfoItem label="Deleted At" value={formatDateTime(sg.deleted_at)} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation — Global ConfirmModal with Audit */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Hapus Settlement Group"
        message={`Apakah Anda yakin ingin menghapus settlement group ${sg.settlement_number}? Aggregate dan bank statement akan dikembalikan ke status UNRECONCILED. Tindakan ini permanen.`}
        confirmText="Hapus Permanen"
        cancelText="Batal"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        actionType="DELETE"
        entityType="settlement_group"
        contextData={{
          id: sg.id,
          name: sg.settlement_number,
          type: 'settlement_group',
          date: sg.settlement_date,
          amount: sg.total_statement_amount,
        }}
        requireReason
        reasonPlaceholder="Alasan menghapus settlement group ini..."
        financialImpact={{
          affectedTransactions: sg.aggregates?.length || 0,
          totalAmount: sg.total_statement_amount,
          reconciliationImpact: 'Aggregate dan bank statement akan kembali ke status unreconciled',
        }}
      />
    </div>
  );
}
