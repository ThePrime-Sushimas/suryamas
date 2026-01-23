/**
 * PosAggregatesDetail.tsx
 * 
 * Detail view component for aggregated transaction.
 * Displays all transaction details in a comprehensive layout.
 */

import React from 'react'
import { FileText, Calendar, Building, CreditCard, DollarSign, Clock, CheckCircle } from 'lucide-react'
import type { AggregatedTransactionWithDetails } from '../types'

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
    weekday: 'long',
  })
}

/**
 * Format datetime to Indonesian format
 */
const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// =============================================================================
// PROPS
// =============================================================================

interface PosAggregatesDetailProps {
  transaction: AggregatedTransactionWithDetails
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Detail view component for aggregated transaction
 * Displays all transaction information in a comprehensive layout
 */
export const PosAggregatesDetail: React.FC<PosAggregatesDetailProps> = ({ transaction }) => {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Transaksi Agregat</h2>
            <p className="text-sm text-gray-500 mt-1">ID: {transaction.id}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(transaction.net_amount)}
            </div>
            <div className="text-sm text-gray-500">Jumlah Bersih</div>
          </div>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            Informasi Transaksi
          </h3>
          <dl className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Tanggal</dt>
              <dd className="col-span-2 text-sm text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                {formatDate(transaction.transaction_date)}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Referensi</dt>
              <dd className="col-span-2 text-sm text-gray-900 font-mono">
                {transaction.source_ref}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Tipe Sumber</dt>
              <dd className="col-span-2 text-sm text-gray-900">
                {transaction.source_type}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">ID Sumber</dt>
              <dd className="col-span-2 text-sm text-gray-900 font-mono">
                {transaction.source_id}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Versi</dt>
              <dd className="col-span-2 text-sm text-gray-900">
                {transaction.version}
              </dd>
            </div>
          </dl>
        </div>

        {/* Branch & Payment Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-gray-500" />
            Branch & Pembayaran
          </h3>
          <dl className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Cabang</dt>
              <dd className="col-span-2 text-sm text-gray-900">
                {transaction.branch_name || '-'}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Metode Pembayaran</dt>
              <dd className="col-span-2 text-sm text-gray-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                {transaction.payment_method_name || `ID: ${transaction.payment_method_id}`}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Mata Uang</dt>
              <dd className="col-span-2 text-sm text-gray-900">
                {transaction.currency}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="col-span-2 text-sm text-gray-900">
                {transaction.status}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Rekonsiliasi</dt>
              <dd className="col-span-2 text-sm text-gray-900 flex items-center gap-2">
                {transaction.is_reconciled ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-green-600">Sudah Direkonsiliasi</span>
                  </>
                ) : (
                  <span className="text-gray-500">Belum Direkonsiliasi</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Amount Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-gray-500" />
          Rincian Jumlah
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Jumlah Kotor</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatCurrency(transaction.gross_amount)}
            </div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-sm text-red-600 mb-1">Potongan</div>
            <div className="text-lg font-semibold text-red-700">
              -{formatCurrency(transaction.discount_amount)}
            </div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600 mb-1">Pajak</div>
            <div className="text-lg font-semibold text-blue-700">
              +{formatCurrency(transaction.tax_amount)}
            </div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-purple-600 mb-1">Service Charge</div>
            <div className="text-lg font-semibold text-purple-700">
              +{formatCurrency(transaction.service_charge_amount)}
            </div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <div className="text-sm text-green-700 mb-1">Jumlah Bersih</div>
            <div className="text-xl font-bold text-green-700">
              {formatCurrency(transaction.net_amount)}
            </div>
          </div>
        </div>
      </div>

      {/* Journal Info */}
      {transaction.journal_id && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            Informasi Jurnal
          </h3>
          <dl className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Journal ID</dt>
              <dd className="col-span-2 text-sm text-gray-900 font-mono">
                {transaction.journal_id}
              </dd>
            </div>
            {transaction.journal_number && (
              <div className="grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500">Nomor Jurnal</dt>
                <dd className="col-span-2 text-sm text-gray-900">
                  {transaction.journal_number}
                </dd>
              </div>
            )}
            {transaction.journal_status && (
              <div className="grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500">Status Jurnal</dt>
                <dd className="col-span-2 text-sm text-gray-900">
                  {transaction.journal_status}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Audit Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          Informasi Audit
        </h3>
        <dl className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Dibuat</dt>
              <dd className="col-span-2 text-sm text-gray-900">
                {formatDateTime(transaction.created_at)}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500">Diperbarui</dt>
              <dd className="col-span-2 text-sm text-gray-900">
                {formatDateTime(transaction.updated_at)}
              </dd>
            </div>
          </div>
          {transaction.deleted_at && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500">Dihapus</dt>
                <dd className="col-span-2 text-sm text-red-600">
                  {formatDateTime(transaction.deleted_at)}
                </dd>
              </div>
              {transaction.deleted_by && (
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-sm font-medium text-gray-500">Dihapus Oleh</dt>
                  <dd className="col-span-2 text-sm text-red-600">
                    {transaction.deleted_by}
                  </dd>
                </div>
              )}
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesDetail

