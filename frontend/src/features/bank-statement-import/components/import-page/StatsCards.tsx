import { FileText, CheckCircle, RefreshCw, XCircle, TrendingUp, TrendingDown } from 'lucide-react'
import type { BankStatementImport } from '../../types/bank-statement-import.types'

interface StatsCardsProps {
  imports: BankStatementImport[]
  totalItems: number
}

interface StatCardProps {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBgColor: string
  trend?: {
    value: number
    isPositive: boolean
  }
  suffix?: string
}

function StatCard({ title, value, icon: Icon, iconColor, iconBgColor, trend, suffix }: StatCardProps) {
  const TrendIcon = trend?.isPositive ? TrendingUp : TrendingDown
  const trendColor = trend?.isPositive ? 'text-emerald-600' : 'text-rose-600'
  const trendBg = trend?.isPositive ? 'bg-emerald-50' : 'bg-rose-50'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${iconBgColor} transition-transform group-hover:scale-110 duration-300`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {trend !== undefined ? (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${trendBg}`}>
            <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
            <span className={`text-xs font-semibold ${trendColor}`}>
              {trend.value}%
            </span>
          </div>
        ) : (
          <div className="w-8 h-1 bg-gray-50 dark:bg-gray-700/50 rounded-full" />
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="text-sm font-medium text-gray-500 ml-1.5">{suffix}</span>}
        </p>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{title}</p>
      </div>
    </div>
  )
}

export function StatsCards({ imports, totalItems }: StatsCardsProps) {
  const completedCount = imports.filter((imp) => imp.status === 'COMPLETED').length
  const processingCount = imports.filter((imp) => 
    ['IMPORTING', 'PENDING', 'ANALYZED'].includes(imp.status)
  ).length
  const failedCount = imports.filter((imp) => imp.status === 'FAILED').length

  // Calculate total rows
  const totalRows = imports.reduce((sum, imp) => sum + (imp.total_rows || 0), 0)

  // Mock trend data (in real app, this would come from comparing with previous period)
  const totalRowsTrend = 12.8

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total File"
        value={totalItems}
        icon={FileText}
        iconColor="text-blue-600"
        iconBgColor="bg-blue-100 dark:bg-blue-900/30"
        suffix="file"
      />
      <StatCard
        title="Total Baris"
        value={totalRows.toLocaleString()}
        icon={FileText}
        iconColor="text-purple-600"
        iconBgColor="bg-purple-100 dark:bg-purple-900/30"
        trend={{ value: totalRowsTrend, isPositive: true }}
      />
      <StatCard
        title="Selesai"
        value={completedCount}
        icon={CheckCircle}
        iconColor="text-green-600"
        iconBgColor="bg-green-100 dark:bg-green-900/30"
      />
      <StatCard
        title="Diproses"
        value={processingCount}
        icon={RefreshCw}
        iconColor="text-blue-600"
        iconBgColor="bg-blue-100 dark:bg-blue-900/30"
      />
      <StatCard
        title="Gagal"
        value={failedCount}
        icon={XCircle}
        iconColor="text-red-600"
        iconBgColor="bg-red-100 dark:bg-red-900/30"
      />
    </div>
  )
}

// Compact stats for mobile
export function StatsCardsCompact({ imports }: { imports: BankStatementImport[] }) {
  const completedCount = imports.filter((imp) => imp.status === 'COMPLETED').length
  const processingCount = imports.filter((imp) => 
    ['IMPORTING', 'PENDING', 'ANALYZED'].includes(imp.status)
  ).length
  const failedCount = imports.filter((imp) => imp.status === 'FAILED').length

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <FileText className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium">{imports.length}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium">{completedCount}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
        <RefreshCw className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium">{processingCount}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
        <XCircle className="w-4 h-4 text-red-600" />
        <span className="text-sm font-medium">{failedCount}</span>
      </div>
    </div>
  )
}

