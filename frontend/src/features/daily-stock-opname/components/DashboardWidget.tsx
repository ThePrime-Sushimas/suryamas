import { useOpnameDashboard } from '../api/dailyStockOpname'
import { OpnameStatusBadge } from './OpnameStatusBadge'
import type { OpnameDashboardItem } from '../types'
import { ClipboardList } from 'lucide-react'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

function BranchRow({ item }: { item: OpnameDashboardItem }) {
  const showVariance = item.status === 'CONFIRMED' || item.status === 'FLAGGED'
  const showProgress = item.status === 'DRAFT'

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
          {item.branch_name}
        </span>
        <OpnameStatusBadge status={item.status} />
      </div>

      <div className="shrink-0 ml-3 text-right">
        {showVariance && item.total_variance_cost != null && (
          <span className={`text-xs font-medium ${item.total_variance_cost > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
            Var: {fmtCurrency(item.total_variance_cost)}
          </span>
        )}
        {showProgress && item.completion_pct != null && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {Math.round(item.completion_pct)}%
          </span>
        )}
      </div>
    </div>
  )
}

export function DashboardWidget() {
  const { data, isLoading, isError } = useOpnameDashboard()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Stock Opname Hari Ini
        </h3>
      </div>

      {/* Content */}
      <div className="p-2">
        {isLoading && (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-xs text-red-500 dark:text-red-400 text-center py-4">
            Gagal memuat data opname
          </p>
        )}

        {!isLoading && !isError && data && data.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            Tidak ada cabang terdaftar
          </p>
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <div className="space-y-0.5">
            {data.map((item) => (
              <BranchRow key={item.branch_id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
