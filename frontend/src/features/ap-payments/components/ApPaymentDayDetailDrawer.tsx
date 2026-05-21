import { Link } from 'react-router-dom'
import { X, ArrowRight, Building2, Landmark } from 'lucide-react'
import type { ApDueDatePivotRow, ApPivotLocationGrouping } from '../api/apPayments.api'
import { AP_PAYMENTS_LIST_PATH } from '../constants'
import { formatDayTitle } from '../utils/apCalendar.utils'
import { apTheme } from '../ap-payments.theme'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

interface ApPaymentDayDetailDrawerProps {
  isOpen: boolean
  dateKey: string | null
  rows: ApDueDatePivotRow[]
  totalOutstanding: number
  invoiceCount: number
  locationGrouping: ApPivotLocationGrouping
  onClose: () => void
}

function StatusBadge({ status }: { status: ApDueDatePivotRow['invoice_status'] }) {
  if (status === 'POSTED') return <span className={apTheme.badgeReady}>Siap bayar</span>
  return <span className={apTheme.badgePending}>Menunggu post</span>
}

export function ApPaymentDayDetailDrawer({
  isOpen,
  dateKey,
  rows,
  totalOutstanding,
  invoiceCount,
  locationGrouping,
  onClose,
}: ApPaymentDayDetailDrawerProps) {
  if (!isOpen || !dateKey) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className={apTheme.drawerOverlay}
        aria-label="Tutup"
        onClick={onClose}
      />
      <div className={apTheme.drawerPanel}>
        <div className={`px-5 py-4 border-b ${apTheme.divideBorder} flex items-start justify-between gap-3`}>
          <div>
            <h2 className={apTheme.titleSm}>
              {formatDayTitle(dateKey)}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {fmt(totalOutstanding)} · {invoiceCount} invoice · {rows.length} baris
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${apTheme.btnGhost} shrink-0`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto divide-y ${apTheme.divide}`}>
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">Tidak ada pembayaran di hari ini.</p>
          ) : (
            rows.map((row) => {
              const location =
                locationGrouping === 'branch'
                  ? `${row.branch_name} (${row.branch_code})`
                  : `${row.company_name}${row.company_type ? ` · ${row.company_type}` : ''}`

              const payFrom =
                row.pay_from_bank_name || row.pay_from_account_number
                  ? [
                      row.pay_from_account_holder,
                      row.pay_from_bank_name,
                      row.pay_from_account_number,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : null

              const payTo =
                row.supplier_bank_name || row.supplier_account_number
                  ? [
                      row.supplier_account_holder,
                      row.supplier_bank_name,
                      row.supplier_account_number,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : null

              return (
                <div
                  key={`${row.supplier_id}-${row.branch_id}-${row.invoice_status}`}
                  className="p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {row.supplier_name}
                        {row.supplier_code && (
                          <span className="ml-1.5 text-xs font-normal text-gray-400">
                            {row.supplier_code}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 shrink-0" />
                        {location}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900 dark:text-white tabular-nums">
                        {fmt(row.outstanding)}
                      </p>
                      <p className="text-xs text-gray-400">{row.invoice_count} invoice</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={row.invoice_status} />
                    {row.is_overdue && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800">
                        Overdue
                      </span>
                    )}
                  </div>

                  <div className={`rounded-2xl p-3 space-y-2 text-xs ${apTheme.cardInner}`}>
                    <div className="flex gap-2">
                      <span className="text-gray-500 shrink-0 w-12">Dari</span>
                      <span className="text-gray-800 dark:text-gray-200 flex items-start gap-1">
                        <Landmark className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {payFrom ?? (
                          <span className="text-gray-400">
                            {row.ap_payment_number
                              ? 'Rekening belum di-set di AP'
                              : 'Belum ada draft AP'}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400 ml-12 shrink-0" />
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-500 shrink-0 w-12">Ke</span>
                      <span className="text-gray-800 dark:text-gray-200">
                        {payTo ?? '— (isi rekening di master supplier)'}
                      </span>
                    </div>
                  </div>

                  {row.invoice_count > 1 && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-900/20 rounded-lg px-2 py-1">
                      {row.invoice_count} invoice dalam grup ini — rekening/AP di bawah hanya
                      contoh satu draft, bukan satu pembayaran untuk semua invoice.
                    </p>
                  )}
                  {row.ap_payment_id && (
                    <Link
                      to={`${AP_PAYMENTS_LIST_PATH}/${row.ap_payment_id}`}
                      className="inline-flex text-sm font-medium text-rose-600 dark:text-pink-300 hover:underline"
                      onClick={onClose}
                    >
                      Buka contoh AP: {row.ap_payment_number ?? 'pembayaran'}
                    </Link>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
