/**
 * PosAggregatesDetail.tsx
 * 
 * Detail view component for aggregated transaction.
 * Displays all transaction details in a comprehensive layout with modern UI.
 */

import React from 'react'
import { 
  FileText, Calendar, Building, CreditCard, Clock, 
  CheckCircle, Building2, TrendingUp, 
  Shield, AlertCircle, 
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
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
    case 'FAILED':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
    case 'PENDING':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
    case 'PROCESSING':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    case 'CANCELLED':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600'
  }
}

/**
 * Get status icon
 */
const getStatusIcon = (status: string): React.ReactNode => {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
    case 'FAILED':
      return <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
    case 'PENDING':
      return <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
    case 'PROCESSING':
      return <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
      <div className="bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 rounded-2xl shadow-xl p-6 text-white border border-slate-700 dark:border-slate-600">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          {/* Left Section */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/20 dark:bg-black/30 rounded-lg backdrop-blur-sm">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Detail Transaksi Agregat</h2>
                <p className="text-blue-100 dark:text-slate-300 text-sm mt-1">Informasi lengkap transaksi</p>
              </div>
            </div>
            
            {/* Tags Row */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1.5 bg-white/20 dark:bg-black/30 backdrop-blur-sm rounded-lg text-sm font-mono">
                <span className="opacity-75">ID:</span> {transaction.id}
              </span>
              <span className="px-3 py-1.5 bg-white/20 dark:bg-black/30 backdrop-blur-sm rounded-lg text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(transaction.transaction_date)}
              </span>
              <span className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 bg-white/20 dark:bg-black/30 backdrop-blur-sm ${getStatusColor(transaction.status)}`}>
                {getStatusIcon(transaction.status)}
                {transaction.status}
              </span>
            </div>
          </div>

          {/* Right Section - Amount */}
          <div className="lg:text-right bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-xl p-4 lg:min-w-[280px]">
            <div className="text-sm text-blue-100 dark:text-slate-300 mb-1">Jumlah Settled</div>
            <div className="text-3xl lg:text-4xl font-bold mb-2">
              {formatCurrency(transaction.nett_amount)}
            </div>
            <div className="flex flex-col lg:flex-row gap-2 lg:justify-end text-sm text-blue-100 dark:text-slate-300/80">
              <span>Gross: {formatCurrency(transaction.gross_amount)}</span>
              <span className="hidden lg:inline">•</span>
              <span>Fee: {formatCurrency(transaction.total_fee_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          AMOUNT SUMMARY - SIMPLE CLEAN DESIGN
          ======================================== */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Ringkasan Transaksi</h3>
        
        {/* List Style - Simple & Clean */}
        <div className="space-y-2">
          {/* Gross Amount */}
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Gross Amount</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">Total sebelum potongan</div>
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {formatCurrency(transaction.gross_amount)}
            </div>
          </div>

          {/* Tax */}
          {transaction.tax_amount > 0 && (
            <div className="flex items-center justify-between py-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">Pajak</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                +{formatCurrency(transaction.tax_amount)}
              </div>
            </div>
          )}

          {/* Service Charge */}
          {transaction.service_charge_amount > 0 && (
            <div className="flex items-center justify-between py-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">Service Charge</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                +{formatCurrency(transaction.service_charge_amount)}
              </div>
            </div>
          )}

          {/* Discount */}
          {transaction.discount_amount > 0 && (
            <div className="flex items-center justify-between py-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">Discount</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                -{formatCurrency(transaction.discount_amount)}
              </div>
            </div>
          )}

          {/* Bill After Discount */}
          <div className="flex items-center justify-between py-3 border-t-2 border-gray-200 dark:border-gray-700 mt-2">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Bill After Discount</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white">
              {formatCurrency(transaction.bill_after_discount)}
            </div>
          </div>
        </div>

        {/* Fee Breakdown */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Fee Breakdown</h4>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {feePercentage}% dari gross
            </span>
          </div>
          
          <div className="space-y-2">
            {/* Percentage Fee */}
            <div className="flex items-center justify-between py-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">Percentage Fee</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                -{formatCurrency(transaction.percentage_fee_amount)}
              </div>
            </div>

            {/* Fixed Fee */}
            <div className="flex items-center justify-between py-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">Fixed Fee</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                -{formatCurrency(transaction.fixed_fee_amount)}
              </div>
            </div>

            {/* Total Fee */}
            <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-700 mt-2">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Total Fee</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                -{formatCurrency(transaction.total_fee_amount)}
              </div>
            </div>
          </div>
        </div>

        {/* Amount Settled - Final Result */}
        <div className="mt-6 pt-4 border-t-2 border-gray-300 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-gray-900 dark:text-white">Amount Settled</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Jumlah yang akan disetorkan ke rekening</div>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(transaction.nett_amount)}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================
          TRANSACTION METADATA - 3 COLUMN GRID
          ======================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            Informasi Dasar
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Referensi Transaksi
              </label>
              <div className="mt-1 font-mono text-sm bg-gray-100 dark:bg-gray-700 p-3 rounded-lg break-all text-gray-900 dark:text-white">
                {transaction.source_ref}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tipe
                </label>
                <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{transaction.source_type}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Versi
                </label>
                <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">v{transaction.version}</div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                ID Sumber
              </label>
              <div className="mt-1 font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded-lg break-all text-gray-900 dark:text-white">
                {transaction.source_id}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Mata Uang
              </label>
              <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{transaction.currency}</div>
            </div>
          </div>
        </div>

        {/* Branch & Payment Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Building className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            Lokasi & Pembayaran
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cabang
              </label>
              <div className="mt-1 flex items-center gap-2 text-gray-900 dark:text-white">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{transaction.branch_name || 'Tidak tersedia'}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Metode Pembayaran
              </label>
              <div className="mt-1 flex items-center gap-2 text-gray-900 dark:text-white">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="font-medium">
                  {transaction.payment_method_name || `ID: ${transaction.payment_method_id}`}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status Rekonsiliasi
              </label>
              <div className="mt-1">
                {transaction.is_reconciled ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Sudah Direkonsiliasi</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Belum Direkonsiliasi</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            Status Transaksi
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
              <div className="bg-linear-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div>
                    <label className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
                      Alasan Kegagalan
                    </label>
                    <div className="mt-1 text-sm text-red-800 dark:text-red-300 font-medium">
                      {transaction.failed_reason || 'Tidak diketahui'}
                    </div>
                    {transaction.failed_at && (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-500">
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            Informasi Jurnal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Journal ID
              </label>
              <div className="mt-1 font-mono text-sm text-gray-900 dark:text-white break-all">
                {transaction.journal_id}
              </div>
            </div>
            {transaction.journal_number && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Nomor Jurnal
                </label>
                <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                  {transaction.journal_number}
                </div>
              </div>
            )}
            {transaction.journal_status && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status Jurnal
                </label>
                <div className="mt-1">
                  <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                    transaction.journal_status === 'POSTED' 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                      : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300'
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
            <Building2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          Rekonsiliasi Bank
        </h3>
        
        {transaction.is_reconciled ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Bank Info */}
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-900/30 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
                <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                  Nama Bank
                </label>
                <div className="mt-1 text-sm font-bold text-cyan-800 dark:text-cyan-300">
                  {transaction.bank_name || '-'}
                </div>
              </div>

              {/* Account Name */}
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-900/30 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
                <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                  Nama Rekening
                </label>
                <div className="mt-1 text-sm font-medium text-cyan-800 dark:text-cyan-300">
                  {transaction.bank_account_name || '-'}
                </div>
              </div>

              {/* Account Number */}
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-900/30 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
                <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                  Nomor Rekening
                </label>
                <div className="mt-1 font-mono text-sm text-cyan-800 dark:text-cyan-300">
                  {transaction.bank_account_number || '-'}
                </div>
              </div>

              {/* Mutation ID */}
              <div className="bg-linear-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-900/30 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
                <label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                  ID Mutasi Bank
                </label>
                <div className="mt-1 font-mono text-sm text-cyan-800 dark:text-cyan-300 break-all">
                  {transaction.bank_mutation_id || '-'}
                </div>
              </div>
            </div>

            {/* Dates and Reconciled By */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tanggal Mutasi Bank
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {transaction.bank_mutation_date ? formatDate(transaction.bank_mutation_date) : '-'}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tanggal Rekonsiliasi
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {transaction.reconciled_at ? formatDateTime(transaction.reconciled_at) : '-'}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Direkonsiliasi Oleh
                </label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  {transaction.reconciled_by || '-'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <div className="p-3 bg-gray-200 dark:bg-gray-600 rounded-full">
              <Clock className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Belum Direkonsiliasi</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Transaksi ini belum dicocokkan dengan mutasi bank</div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================
          AUDIT INFO
          ======================================== */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          Informasi Audit
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Created Info */}
          <div className="bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Dibuat
              </label>
            </div>
            <div className="pl-11 space-y-2">
              <div className="text-sm text-gray-900 dark:text-white font-medium">
                {formatDateTime(transaction.created_at)}
              </div>
            </div>
          </div>

          {/* Updated Info */}
          <div className="bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Diperbarui
              </label>
            </div>
            <div className="pl-11 space-y-2">
              <div className="text-sm text-gray-900 dark:text-white font-medium">
                {formatDateTime(transaction.updated_at)}
              </div>
            </div>
          </div>
        </div>

        {/* Deleted Info - If applicable */}
        {transaction.deleted_at && (
          <div className="mt-4 bg-linear-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-200 dark:bg-red-900/50 rounded-lg">
                <Trash2 className="w-4 h-4 text-red-700 dark:text-red-400" />
              </div>
              <label className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
                Dihapus
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-11">
              <div>
                <label className="text-xs text-red-600 dark:text-red-400">Tanggal Penghapusan</label>
                <div className="text-sm text-red-800 dark:text-red-300 font-medium">
                  {formatDateTime(transaction.deleted_at)}
                </div>
              </div>
              {transaction.deleted_by && (
                <div>
                  <label className="text-xs text-red-600 dark:text-red-400">Dihapus Oleh</label>
                  <div className="text-sm text-red-800 dark:text-red-300 font-medium flex items-center gap-2">
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
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
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

