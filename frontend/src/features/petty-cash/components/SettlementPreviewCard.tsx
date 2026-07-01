import { fmtCurrency } from '@/lib/formatters'

type SettlementPreviewCardProps = {
  remaining: number
  amountReturned: number
  carriedToAmount: number
  refillAmount: number
  totalDanaBaru: number
}

export function SettlementPreviewCard({
  remaining,
  amountReturned,
  carriedToAmount,
  refillAmount,
  totalDanaBaru,
}: SettlementPreviewCardProps) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50 p-5 space-y-2 text-sm">
      <h4 className="font-medium text-blue-800 dark:text-blue-300">
        Preview Kalkulasi
      </h4>
      <div className="grid grid-cols-2 gap-1">
        <span className="text-gray-600 dark:text-gray-400">
          Saldo tersisa:
        </span>
        <span className="text-right font-medium">
          {fmtCurrency(remaining)}
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          Dikembalikan:
        </span>
        <span className="text-right font-medium text-red-600">
          - {fmtCurrency(amountReturned)}
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          Carry ke request baru:
        </span>
        <span className="text-right font-medium text-blue-600">
          {fmtCurrency(carriedToAmount)}
        </span>
        {refillAmount > 0 && (
          <>
            <span className="text-gray-600 dark:text-gray-400">
              Tambahan refill:
            </span>
            <span className="text-right font-medium text-green-600">
              + {fmtCurrency(refillAmount)}
            </span>
          </>
        )}
        <span className="font-medium text-gray-900 dark:text-white pt-1 border-t border-blue-200/50">
          Total dana request baru:
        </span>
        <span className="text-right font-semibold text-gray-900 dark:text-white pt-1 border-t border-blue-200/50">
          {fmtCurrency(totalDanaBaru)}
        </span>
      </div>
      {carriedToAmount === 0 && refillAmount === 0 && (
        <p className="text-xs text-gray-500 pt-1">
          Request akan ditutup total tanpa request baru.
        </p>
      )}
    </div>
  )
}
