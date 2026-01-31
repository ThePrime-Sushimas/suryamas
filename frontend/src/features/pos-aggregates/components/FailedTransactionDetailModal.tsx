/**
 * FailedTransactionDetailModal.tsx
 * 
 * Modal component for viewing and fixing failed transactions.
 * Shows detailed error information and provides fix options.
 */

import React, { useState, useEffect } from 'react'
import { X, RefreshCw, Trash2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useFailedTransactionsStore } from '../store/failedTransactions.store'

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency to Indonesian Rupiah format
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format date to Indonesian format
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// =============================================================================
// PROPS
// =============================================================================

interface FailedTransactionDetailModalProps {
  transactionId: string
  isOpen: boolean
  onClose: () => void
  onFix: (id: string) => void
  onDelete: (id: string) => void
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Modal component for viewing and fixing failed transactions
 */
export const FailedTransactionDetailModal: React.FC<FailedTransactionDetailModalProps> = ({
  transactionId,
  isOpen,
  onClose,
  onFix,
  onDelete,
}) => {
  const {
    selectedTransaction, 
    fetchTransactionById, 
    isLoading,
    isMutating 
  } = useFailedTransactionsStore()

  const [activeTab, setActiveTab] = useState<'details' | 'error'>('details')

  // Fetch transaction details when modal opens
  useEffect(() => {
    if (isOpen && transactionId) {
      fetchTransactionById(transactionId)
    }
  }, [isOpen, transactionId, fetchTransactionById])

  // Handle fix
  const handleFix = () => {
    onFix(transactionId)
    onClose()
  }

  // Handle delete
  const handleDelete = () => {
    if (confirm('Yakin ingin menghapus transaksi gagal ini secara permanen?')) {
      onDelete(transactionId)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-red-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Detail Transaksi Gagal</h2>
              <p className="text-sm text-gray-500">{selectedTransaction?.source_ref || transactionId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Memuat data...</span>
            </div>
          ) : selectedTransaction ? (
            <>
              {/* Tabs */}
              <div className="border-b mb-4">
                <nav className="-mb-px flex gap-4">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'details'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Detail Transaksi
                  </button>
                  <button
                    onClick={() => setActiveTab('error')}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'error'
                        ? 'border-red-600 text-red-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      Error Info
                      <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs">!</span>
                    </span>
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              {activeTab === 'details' ? (
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase">Transaction Date</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedTransaction.transaction_date)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase">Source Ref</label>
                      <p className="text-sm font-mono text-gray-900">{selectedTransaction.source_ref}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase">Branch</label>
                      <p className="text-sm text-gray-900">{selectedTransaction.branch_name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase">Status</label>
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        {selectedTransaction.status}
                      </span>
                    </div>
                  </div>

                  {/* Amount Details */}
                  <div className="bg-gray-50 rounded-lg p-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Amount Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Sub Total</span>
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(selectedTransaction.gross_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Tax</span>
                        <span className="text-sm text-gray-900">+{formatCurrency(selectedTransaction.tax_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Discount</span>
                        <span className="text-sm text-red-600">-{formatCurrency(selectedTransaction.discount_amount)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between">
                        <span className="text-sm font-medium text-gray-900">Net Amount</span>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(selectedTransaction.nett_amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase">Payment Method</label>
                      <p className="text-sm text-gray-900">{selectedTransaction.payment_method_name || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase">Source ID</label>
                      <p className="text-sm font-mono text-gray-500">{selectedTransaction.source_id}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Error Info */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-red-800">Error Information</h4>
                        <p className="text-sm text-red-700 mt-1">
                          Transaksi ini gagal diproses karena kesalahan validasi atau duplikasi data.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Common Error Messages */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Kemungkinan Penyebab:</h4>
                    <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                      <li>Duplicate source_ref (transaksi sudah ada)</li>
                      <li>Data tidak lengkap atau invalid</li>
                      <li>Koneksi database terputus saat proses</li>
                      <li>Branch atau payment method tidak ditemukan</li>
                    </ul>
                  </div>

                  {/* Solution */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-green-800">Solusi:</h4>
                        <p className="text-sm text-green-700 mt-1">
                          Klik tombol "Fix & Retry" untuk mencoba memproses ulang transaksi ini. 
                          Sistem akan memeriksa dan melewati duplikasi jika diperlukan.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Data transaksi tidak ditemukan</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <button
            onClick={handleDelete}
            disabled={isMutating}
            className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 disabled:opacity-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Hapus Permanen
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Tutup
            </button>
            <button
              onClick={handleFix}
              disabled={isMutating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isMutating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Fix & Retry
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FailedTransactionDetailModal

