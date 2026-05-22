import { useNavigate } from 'react-router-dom'
import { CheckSquare, X, ArrowRight } from 'lucide-react'
import { apTheme } from '../ap-payments.theme'
import type { SessionPayloadItem } from '../types/sessionPayload.types'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(v)

interface BulkSelectionBarProps {
  selectedIds: Set<string>
  totalRemainingAmount: number
  onClearSelection: () => void
  bankAccountAssignments: Map<string, number | null>
}

export function BulkSelectionBar({
  selectedIds,
  totalRemainingAmount,
  onClearSelection,
  bankAccountAssignments,
}: BulkSelectionBarProps) {
  const navigate = useNavigate()

  if (selectedIds.size === 0) return null

  const handleProcessPayment = () => {
    const payload: SessionPayloadItem[] = Array.from(selectedIds).map(id => ({
      invoiceId: id,
      bankAccountId: bankAccountAssignments.get(id) ?? null,
    }))
    sessionStorage.setItem('bulk_selected_invoices', JSON.stringify(payload))
    navigate('/finance/ap-payments/bulk-create')
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-rose-200/85 dark:border-gray-700 bg-[#fff9f7]/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg shadow-rose-200/30 dark:shadow-black/30"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: selection info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={apTheme.headerIcon}>
            <CheckSquare className="w-4 h-4" />
          </div>
          <div className="text-sm font-medium text-rose-950 dark:text-white truncate">
            <span className="font-bold">{selectedIds.size}</span> invoice dipilih
            <span className="mx-2 text-rose-300 dark:text-gray-600">·</span>
            <span>Total: {fmtCurrency(totalRemainingAmount)}</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClearSelection}
            className={apTheme.btnSecondary}
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Batal</span>
          </button>
          <button
            type="button"
            onClick={handleProcessPayment}
            className={apTheme.btnPrimary}
          >
            <span>Proses Pembayaran</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
