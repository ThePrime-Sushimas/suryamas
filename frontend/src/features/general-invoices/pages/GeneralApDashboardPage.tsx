
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, FileText, CheckCircle2, Banknote, List, RefreshCcw } from 'lucide-react'
import { useGeneralInvoiceDashboard } from '../api/generalApi.api'
import {
  formatRupiah,
} from '../constants'

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

  const { summary, pending_amortizations } = data

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
            Template
          </Link>
          <Link
            to="/finance/general-invoices/amortizations"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            <Clock size={14} />
            Amortisasi
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

      {pending_amortizations > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {pending_amortizations} amortisasi prepaid menunggu eksekusi
            </span>
          </div>
          <p className="text-xs text-amber-600 mt-1">
            Ada entri amortisasi yang sudah jatuh tempo tapi belum dijalankan.
          </p>
        </div>
      )}
    </div>
  )
}
