
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, FileText, CheckCircle2, TrendingUp, Banknote, List, RefreshCcw } from 'lucide-react'
import { useGeneralInvoiceDashboard } from '../api/generalApi.api'
import {
  formatRupiah,
  EXPENSE_TYPE_LABELS,
} from '../constants'
import type { ExpenseType } from '../api/generalApi.api'

const INVOICES_PATH = '/finance/general-invoices'
const PAYMENTS_PATH = '/finance/general-invoices/payments'

export default function GeneralApDashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useGeneralInvoiceDashboard()

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const { summary, by_expense_type } = data

  const goInvoices = (params: Record<string, string>) => {
    const q = new URLSearchParams(params)
    navigate(`${INVOICES_PATH}?${q.toString()}`)
  }

  const statCards = [
    {
      label: 'Total Belum Bayar',
      value: formatRupiah(summary.total_unpaid),
      sub: `${summary.total_unpaid_count} invoice`,
      icon: FileText,
      iconClass: 'text-blue-600 bg-blue-50',
      cardClass: 'border-blue-200',
      onClick: () => goInvoices({ status: 'POSTED' }),
    },
    {
      label: 'Jatuh Tempo',
      value: formatRupiah(summary.overdue_amount),
      sub: `${summary.overdue_count} invoice`,
      icon: AlertTriangle,
      iconClass: 'text-red-600 bg-red-50',
      cardClass: 'border-red-200',
      onClick: () => goInvoices({ status: 'POSTED', overdue: '1' }),
    },
    {
      label: 'Due Minggu Ini',
      value: formatRupiah(summary.due_this_week),
      sub: `${summary.due_this_week_count} invoice`,
      icon: Clock,
      iconClass: 'text-amber-600 bg-amber-50',
      cardClass: 'border-amber-200',
    },
    {
      label: 'Draft',
      value: summary.draft_count.toString(),
      sub: 'invoice',
      icon: CheckCircle2,
      iconClass: 'text-gray-600 bg-gray-50',
      cardClass: 'border-gray-200',
      onClick: () => goInvoices({ status: 'DRAFT' }),
    },
  ]

  const maxAmount = Math.max(...by_expense_type.map((r) => r.total_amount), 1)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">General AP — Dashboard</h1>
          <p className="text-sm text-gray-500">
            Ringkasan hutang operasional (listrik, sewa, jasa). Workflow bayar ada di halaman Payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={INVOICES_PATH}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            <List size={14} /> Semua Invoice
          </Link>
          <Link
            to="/finance/general-invoices/templates"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            <RefreshCcw size={14} />
            Template & COA
          </Link>
          <Link
            to={PAYMENTS_PATH}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            <Banknote size={14} /> Payments
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            onClick={card.onClick}
            className={`
              bg-white rounded-xl border p-4 sm:p-5 space-y-2
              ${card.cardClass}
              ${card.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
            `}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-gray-500 font-medium">{card.label}</span>
              <span className={`p-2 rounded-lg ${card.iconClass}`}>
                <card.icon size={14} />
              </span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 leading-none">{card.value}</p>
            <p className="text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {by_expense_type.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Breakdown per Kategori Beban</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Kategori ini untuk pelaporan; akun jurnal tetap dari COA per baris invoice.
          </p>
          <div className="space-y-3">
            {by_expense_type.map((row) => {
              const label = EXPENSE_TYPE_LABELS[row.expense_type as ExpenseType] ?? row.expense_type
              const pct = Math.round((row.total_amount / maxAmount) * 100)

              return (
                <div key={row.expense_type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">
                      {label}
                      <span className="ml-1 text-gray-400">({row.invoice_count} inv)</span>
                    </span>
                    <span className="text-gray-900 font-semibold">{formatRupiah(row.total_amount)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
