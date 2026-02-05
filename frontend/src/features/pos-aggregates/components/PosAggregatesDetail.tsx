
/**
 * PosAggregatesDetail.tsx
 * 
 * Detail view component for aggregated transaction.
 * Displays all transaction details in a comprehensive layout with modern UI.
 */

import React from 'react'
import { 
  FileText, Calendar, Building, CreditCard, Clock, 
  CheckCircle, Building2, DollarSign, TrendingUp, 
  TrendingDown, Percent, Shield, AlertCircle, 
  History, Trash2, User, Printer
} from 'lucide-react'
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

/**
 * Get status badge color
 */
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'FAILED':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

/**
 * Get status icon
 */
const getStatusIcon = (status: string): React.ReactNode => {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="w-4 h-4 text-green-600" />
    case 'FAILED':
      return <AlertCircle className="w-4 h-4 text-red-600" />
    case 'PENDING':
      return <Clock className="w-4 h-4 text-yellow-600" />
    case 'PROCESSING':
      return <TrendingUp className="w-4 h-4 text-blue-600" />
    default:
      return null
  }
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
 * Displays all transaction information in a comprehensive layout with modern UI
 */
export const PosAggregatesDetail: React.FC<PosAggregatesDetailProps> = ({ transaction }) => {
  // Hitung persentase untuk visualisasi
  const feePercentage = transaction.gross_amount > 0 
    ? (transaction.total_fee_amount / transaction.gross_amount * 100).toFixed(2)
    : '0.00'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ========================================
          IMPROVED HEADER CARD
          ======================================== */}
      <div className="bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          {/* Left Section */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Detail Transaksi Agregat</h2>
                <p className="text-blue-100 text-sm mt-1">Informasi lengkap transaksi</p>
              </div>
            </div>
            
            {/* Tags Row */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-mono">
                <span className="opacity-75">ID:</span> {transaction.id}
              </span>
              <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(transaction.transaction_date)}
              </span>
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${getStatusColor(transaction.status)}`}>
                {getStatusIcon(transaction.status)}
                {transaction.status}
              </span>
            </div>
          </div>

          {/* Right Section - Amount */}
          <div className="lg:text-right bg-white/10 backdrop-blur-sm rounded-xl p-4 lg:min-w-[280px]">
            <div className="text-sm text-blue-100 mb-1">Jumlah Settled</div>
            <div className="text-3xl lg:text-4xl font-bold mb-2">
              {formatCurrency(transaction.nett_amount)}
            </div>
            <div className="flex flex-col lg:flex-row gap-2 lg:justify-end text-sm text-blue-100/80">
              <span>Gross: {formatCurrency(transaction.gross_amount)}</span>
              <span className="hidden lg:inline">•</span>
              <span>Fee: {formatCurrency(transaction.total_fee_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          AMOUNT SUMMARY - CORRECT FLOW
          ======================================== */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          Ringkasan Transaksi
        </h3>
        
        {/* Gross Amount + Tax - Discount = Bill After Discount */}
        <div className="space-y-3 mb-8">
          {/* Gross Amount */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <div>
                <div className="font-semibold text-gray-900">Gross Amount</div>
                <div className="text-xs text-gray-500">Total sebelum potongan</div>
              </div>
            </div>
            <div className="text-xl font-bold text-gray-900">
              {formatCurrency(transaction.gross_amount)}
            </div>
          </div>

          {/* Tax (+) */}
          {transaction.tax_amount > 0 && (
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg ml-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span className="text-blue-700">Pajak</span>
              </div>
              <span className="font-semibold text-blue-700">
                +{formatCurrency(transaction.tax_amount)}
              </span>
            </div>
          )}

          {/* Service Charge (+) */}
          {transaction.service_charge_amount > 0 && (
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg ml-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                <span className="text-purple-700">Service Charge</span>
              </div>
              <span className="font-semibold text-purple-700">
                +{formatCurrency(transaction.service_charge_amount)}
              </span>
            </div>
          )}

          {/* Discount (-) */}
          {transaction.discount_amount > 0 && (
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg ml-4">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-red-700">Discount</span>
              </div>
              <span className="font-semibold text-red-700">
                -{formatCurrency(transaction.discount_amount)}
              </span>
            </div>
          )}

          {/* Bill After Discount */}
          <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border-2 border-amber-300">
            <div className="font-bold text-amber-800">Bill After Discount</div>
            <div className="text-xl font-bold text-amber-800">
              {formatCurrency(transaction.bill_after_discount)}
            </div>
          </div>
        </div>

        {/* Fee Breakdown */}
        <div className="border-t border-gray-200 pt-6 mb-8">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Percent className="w-4 h-4 text-indigo-600" />
            </div>
            Fee Breakdown
            <span className="ml-auto text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {feePercentage}% dari gross
            </span>
          </h4>
          
          <div className="space-y-3">
            {/* Percentage Fee */}
            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <div>
                <div className="font-medium text-indigo-700">Percentage Fee</div>
                <div className="text-xs text-indigo-500">Berdasarkan gross amount</div>
              </div>
              <div className="font-semibold text-indigo-700">
                -{formatCurrency(transaction.percentage_fee_amount)}
              </div>
            </div>

            {/* Fixed Fee */}
            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <div>
                <div className="font-medium text-indigo-700">Fixed Fee</div>
                <div className="text-xs text-indigo-500">Biaya tetap per transaksi</div>
              </div>
              <div className="font-semibold text-indigo-700">
                -{formatCurrency(transaction.fixed_fee_amount)}
              </div>
            </div>

            {/* Total Fee */}
            <div className="flex items-center justify-between p-4 bg-indigo-100 rounded-lg border-2 border-indigo-300">
              <div>
                <div className="font-bold text-indigo-800">Total Fee</div>
                <div className="text-xs text-indigo-600">Total biaya transaksi</div>
              </div>
              <div className="text-xl font-bold text-indigo-800">
                -{formatCurrency(transaction.total_fee_amount)}
              </div>
            </div>
          </div>
        </div>

        {/* Amount Settled - Final Result */}
        <div className="flex items-center justify-between p-5 bg-linear-to-r from-green-50 to-emerald-50 rounded-xl border-l-4 border-green-500 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900">Amount Settled</div>
              <div className="text-sm text-gray-600">Jumlah yang akan disetorkan ke rekening</div>
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-green-700">
            {formatCurrency(transaction.nett_amount)}
          </div>
        </div>
      </div>

      {/* ========================================
          TRANSACTION METADATA - 3 COLUMN GRID
          ======================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            Informasi Dasar
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Referensi Transaksi
              </label>
              <div className="mt-1 font-mono text-sm bg-gray-100 p-3 rounded-lg break-all">
                {transaction.source_ref}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tipe
                </label>
                <div className="mt-1 text-sm font-medium text-gray-900">{transaction.source_type}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Versi
                </label>
                <div className="mt-1 text-sm font-medium text-gray-900">v{transaction.version}</div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                ID Sumber
              </label>
              <div className="mt-1 font-mono text-sm bg-gray-100 p-2 rounded-lg break-all">
                {transaction.source_id}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Mata Uang
              </label>
              <div className="mt-1 text-sm font-bold text-gray-900">{transaction.currency}</div>
            </div>
          </div>
        </div>

        {/* Branch & Payment Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Building className="w-5 h-5 text-green-600" />
            </div>
            Lokasi & Pembayaran
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Cabang
              </label>
              <div className="mt-1 flex items-center gap-2 text-gray-900">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{transaction.branch_name || 'Tidak tersedia'}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Metode Pembayaran
              </label>
              <div className="mt-1 flex items-center gap-2 text-gray-900">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="font-medium">
                  {transaction.payment_method_name || `ID: ${transaction.payment_method_id}`}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status Rekonsiliasi
              </label>
              <div className="mt-1">
                {transaction.is_reconciled ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Sudah Direkonsiliasi</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Belum Direkonsiliasi</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            Status Transaksi
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status Saat Ini
              </label>
              <div className="mt-2">
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${getStatusColor(transaction.status)}`}>
                  {getStatusIcon(transaction.status)}
                  {transaction.status}
                </span>
              </div>
            </div>
            
            {transaction.status === 'FAILED' && (
              <div className="bg-linear-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <label className="text-xs font-semibold text-red-700 uppercase tracking-wider">
                      Alasan Kegagalan
                    </label>
                    <div className="mt-1 text-sm text-red-800 font-medium">
                      {transaction.failed_reason || 'Tidak diketahui'}
                    </div>
                    {transaction.failed_at && (
                      <div className="mt-2 text-xs text-red-600">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatDateTime(transaction.failed_at)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================
          JOURNAL INFO
          ======================================== */}
      {transaction.journal_id && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            Informasi Jurnal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Journal ID
              </label>
              <div className="mt-1 font-mono text-sm text-gray-900 break-all">
                {transaction.journal_id}
              </div>
            </div>
            {transaction.journal_number && (
              <div className="bg-gray-50 rounded-xl p-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nomor Jurnal
                </label>
                <div className="mt-1 text-sm font-bold text-gray-900">
                  {transaction.journal_number}
                </div>
              </div>
            )}
            {transaction.journal_status && (
              <div className="bg-gray-50 rounded-xl p-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status Jurnal
                </label>
                <div className="mt-1">
                  <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                    transaction.journal_status === 'POSTED' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {transaction.journal_status}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================
          BANK RECONCILIATION INFO
          ======================================== */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-lg">
            <Building2 className="w-5 h-5 text-cyan-600" />
          </div>
          Rekonsiliasi Bank
        </h3>
        
        {transaction.is_reconciled ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Bank Info */}
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 border border-cyan-200">
                <label className="text-xs font-semibold text-cyan-700 uppercase tracking-wider">
                  Nama Bank
                </label>
                <div className="mt-1 text-sm font-bold text-cyan-800">
                  {transaction.bank_name || '-'}
                </div>
              </div>

              {/* Account Name */}
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 border border-cyan-200">
                <label className="text-xs font-semibold text-cyan-700 uppercase tracking-wider">
                  Nama Rekening
                </label>
                <div className="mt-1 text-sm font-medium text-cyan-800">
                  {transaction.bank_account_name || '-'}
                </div>
              </div>

              {/* Account Number */}
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 border border-cyan-200">
                <label className="text-xs font-semibold text-cyan-700 uppercase tracking-wider">
                  Nomor Rekening
                </label>
                <div className="mt-1 font-mono text-sm text-cyan-800">
                  {transaction.bank_account_number || '-'}
                </div>
              </div>

              {/* Mutation ID */}
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 border border-cyan-200">
                <label className="text-xs font-semibold text-cyan-700 uppercase tracking-wider">
                  ID Mutasi Bank
                </label>
                <div className="mt-1 font-mono text-sm text-cyan-800 break-all">
                  {transaction.bank_mutation_id || '-'}
                </div>
              </div>
            </div>

            {/* Dates and Reconciled By */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tanggal Mutasi Bank
                </label>
                <div className="mt-1 text-sm text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {transaction.bank_mutation_date ? formatDate(transaction.bank_mutation_date) : '-'}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tanggal Rekonsiliasi
                </label>
                <div className="mt-1 text-sm text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {transaction.reconciled_at ? formatDateTime(transaction.reconciled_at) : '-'}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Direkonsiliasi Oleh
                </label>
                <div className="mt-1 text-sm text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  {transaction.reconciled_by || '-'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-6 bg-gray-50 rounded-xl">
            <div className="p-3 bg-gray-200 rounded-full">
              <Clock className="w-6 h-6 text-gray-500" />
            </div>
            <div>
              <div className="font-medium text-gray-900">Belum Direkonsiliasi</div>
              <div className="text-sm text-gray-500">Transaksi ini belum dicocokkan dengan mutasi bank</div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================
          AUDIT INFO
          ======================================== */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <History className="w-5 h-5 text-gray-600" />
          </div>
          Informasi Audit
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Created Info */}
          <div className="bg-linear-to-br from-gray-50 to-gray-100 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Dibuat
              </label>
            </div>
            <div className="pl-11 space-y-2">
              <div className="text-sm text-gray-900 font-medium">
                {formatDateTime(transaction.created_at)}
              </div>
            </div>
          </div>

          {/* Updated Info */}
          <div className="bg-linear-to-br from-gray-50 to-gray-100 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <History className="w-4 h-4 text-blue-600" />
              </div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Diperbarui
              </label>
            </div>
            <div className="pl-11 space-y-2">
              <div className="text-sm text-gray-900 font-medium">
                {formatDateTime(transaction.updated_at)}
              </div>
            </div>
          </div>
        </div>

        {/* Deleted Info - If applicable */}
        {transaction.deleted_at && (
          <div className="mt-4 bg-linear-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-200 rounded-lg">
                <Trash2 className="w-4 h-4 text-red-700" />
              </div>
              <label className="text-xs font-semibold text-red-700 uppercase tracking-wider">
                Dihapus
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-11">
              <div>
                <label className="text-xs text-red-600">Tanggal Penghapusan</label>
                <div className="text-sm text-red-800 font-medium">
                  {formatDateTime(transaction.deleted_at)}
                </div>
              </div>
              {transaction.deleted_by && (
                <div>
                  <label className="text-xs text-red-600">Dihapus Oleh</label>
                  <div className="text-sm text-red-800 font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {transaction.deleted_by}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Print Button */}
      <div className="flex justify-end">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span className="text-sm font-medium">Cetak Halaman</span>
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesDetail

