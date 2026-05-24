import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'

interface OverdueWarningProps {
  overdueDays: number
  triggerProduct: string | null
}

export function OverdueWarning({ overdueDays, triggerProduct }: OverdueWarningProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => { e.stopPropagation(); setShowTooltip((v) => !v) }}
    >
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
      {showTooltip && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
          <span className="font-semibold block">Terlambat {overdueDays} hari</span>
          {triggerProduct && (
            <span className="block text-gray-300 mt-0.5">Item: {triggerProduct}</span>
          )}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  )
}
