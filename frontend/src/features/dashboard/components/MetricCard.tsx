interface MetricCardProps {
  label: string
  value: string
  loading: boolean
  color?: 'warn' | 'danger' | 'success'
  icon?: React.ReactNode
  error?: boolean
}

export function MetricCard({ label, value, loading, color, icon, error }: MetricCardProps) {
  const vc = error
    ? 'text-gray-400 dark:text-gray-500'
    : color === 'danger' ? 'text-rose-600 dark:text-rose-400'
    : color === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : color === 'success' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-gray-900 dark:text-white'
  return (
    <div className="bg-gray-100 dark:bg-gray-800/60 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      </div>
      {loading ? (
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      ) : error ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">Gagal memuat</p>
      ) : (
        <p className={`text-base font-semibold ${vc}`}>{value}</p>
      )}
    </div>
  )
}
