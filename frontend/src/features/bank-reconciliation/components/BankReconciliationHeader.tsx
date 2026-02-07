/**
 * BankReconciliationHeader.tsx
 * 
 * Header component for Bank Reconciliation page.
 * Contains title, description, and action buttons.
 */

import { ShieldCheck, Sparkles, RefreshCw } from 'lucide-react'

interface BankReconciliationHeaderProps {
  isLoading: boolean
  isLoadingPreview: boolean
  onAutoMatchPreview: () => void
}

export function BankReconciliationHeader({
  isLoading,
  isLoadingPreview,
  onAutoMatchPreview,
}: BankReconciliationHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
          Bank Reconciliation
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
          Pantau dan cocokkan transaksi bank dengan catatan POS secara
          otomatis dan akurat.
        </p>
      </div>

      <div className="flex items-center gap-3 self-end md:self-auto">
        <button
          onClick={onAutoMatchPreview}
          disabled={isLoading || isLoadingPreview}
          className="group relative flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all overflow-hidden disabled:opacity-50"
        >
          <div className="absolute inset-0 bg-linear-to-r from-blue-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          {isLoadingPreview ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Auto-Match
        </button>
      </div>
    </div>
  )
}

