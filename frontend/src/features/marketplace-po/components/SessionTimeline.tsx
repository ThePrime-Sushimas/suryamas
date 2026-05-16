import { Check, X } from 'lucide-react'
import { TIMELINE_STEPS } from '../utils/constants'
import type { MarketplaceSessionStatus } from '../types/marketplacePo.types'

const STEP_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ORDERED: 'Ordered',
  SHIPPED: 'Shipped',
  RECEIVED: 'Received',
  SETTLED: 'Settled',
}

export function SessionTimeline({ status }: { status: MarketplaceSessionStatus }) {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        {TIMELINE_STEPS.map((step) => (
          <div key={step} className="flex flex-col items-center flex-1">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 border-2 border-red-400 flex items-center justify-center">
              <X className="w-4 h-4 text-red-600" />
            </div>
            <span className="text-[10px] mt-1 text-red-600 font-medium">{STEP_LABELS[step]}</span>
          </div>
        ))}
      </div>
    )
  }

  const currentIdx = TIMELINE_STEPS.indexOf(status as (typeof TIMELINE_STEPS)[number])

  return (
    <div className="flex items-center w-full px-2 py-2">
      {TIMELINE_STEPS.map((step, idx) => {
        const done = idx < currentIdx
        const current = idx === currentIdx
        const upcoming = idx > currentIdx
        return (
          <div key={step} className="flex flex-col items-center flex-1 relative">
            {idx > 0 && (
              <div
                className={`absolute right-1/2 top-4 h-0.5 -translate-y-1/2 ${
                  done || current ? 'bg-teal-500' : 'bg-gray-200 dark:bg-gray-700'
                }`}
                style={{ width: 'calc(100% - 2rem)', left: 'calc(-50% + 1rem)' }}
              />
            )}
            <div
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                done
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : current
                    ? 'bg-teal-600 border-teal-600 text-white ring-4 ring-teal-100 dark:ring-teal-900/40'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
              }`}
            >
              {done ? (
                <Check className="w-4 h-4" />
              ) : (
                <span className={`text-xs font-bold ${current ? 'text-white' : 'text-gray-400'}`}>
                  {idx + 1}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] sm:text-xs mt-2 text-center ${
                current
                  ? 'font-bold text-teal-700 dark:text-teal-400'
                  : upcoming
                    ? 'text-gray-400'
                    : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {STEP_LABELS[step]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

