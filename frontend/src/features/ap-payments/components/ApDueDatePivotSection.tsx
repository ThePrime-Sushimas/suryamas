import { ChevronDown, ChevronUp, Building2, Landmark } from 'lucide-react'
import type { ApDueDatePivotGroup, ApDueDatePivotRow } from '../api/apPayments.api'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

function StatusBadge({ status }: { status: ApDueDatePivotRow['invoice_status'] }) {
  if (status === 'POSTED') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        Siap bayar
      </span>
    )
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
      Menunggu post
    </span>
  )
}

function BankInfo({ row, show }: { row: ApDueDatePivotRow; show: boolean }) {
  if (!show) return null
  const hasBank =
    row.supplier_bank_name || row.supplier_account_number || row.supplier_account_holder
  if (!hasBank) {
    return <span className="text-xs text-gray-400">—</span>
  }
  return (
    <div className="text-xs text-gray-500 dark:text-gray-400">
      {row.supplier_account_holder && <span>{row.supplier_account_holder}</span>}
      {row.supplier_account_holder && row.supplier_bank_name && (
        <span className="mx-1">·</span>
      )}
      {row.supplier_bank_name && <span>{row.supplier_bank_name}</span>}
      {row.supplier_account_number && (
        <>
          <span className="mx-1">·</span>
          <span className="font-mono">{row.supplier_account_number}</span>
        </>
      )}
    </div>
  )
}

export type ApPivotLocationGrouping = 'branch' | 'entity'

interface ApDueDatePivotSectionProps {
  pivot: ApDueDatePivotGroup[]
  expandedDates: Set<string>
  onToggleDate: (key: string) => void
  showBankInfo: boolean
  onToggleBankInfo: () => void
  locationGrouping: ApPivotLocationGrouping
  onLocationGroupingChange: (mode: ApPivotLocationGrouping) => void
}

function groupHeaderClass(group: ApDueDatePivotGroup): string {
  if (group.is_overdue) {
    return 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
  }
  if (group.is_today) {
    return 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
  }
  if (!group.due_date) {
    return 'border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50'
  }
  return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
}

function groupTitleClass(group: ApDueDatePivotGroup): string {
  if (group.is_overdue) return 'text-amber-800 dark:text-amber-200'
  if (group.is_today) return 'text-blue-800 dark:text-blue-200'
  return 'text-gray-900 dark:text-white'
}

export function ApDueDatePivotSection({
  pivot,
  expandedDates,
  onToggleDate,
  showBankInfo,
  onToggleBankInfo,
  locationGrouping,
  onLocationGroupingChange,
}: ApDueDatePivotSectionProps) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Payment planning
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Outstanding per tanggal jatuh tempo · rekening dari master supplier
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-2xl border border-gray-200 dark:border-gray-600 p-0.5">
            <button
              type="button"
              onClick={() => onLocationGroupingChange('branch')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                locationGrouping === 'branch'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Per cabang
            </button>
            <button
              type="button"
              onClick={() => onLocationGroupingChange('entity')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                locationGrouping === 'entity'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Per rek (PT/CV)
            </button>
          </div>
          <button
            type="button"
            onClick={onToggleBankInfo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-gray-200 dark:border-gray-600 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Landmark className="w-3.5 h-3.5" />
            {showBankInfo ? 'Sembunyikan bank' : 'Tampilkan bank'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {pivot.map((group) => {
          const key = group.due_date ?? '__null__'
          const open = expandedDates.has(key)
          return (
            <div key={key} className={`border-l-4 ${groupHeaderClass(group)}`}>
              <button
                type="button"
                onClick={() => onToggleDate(key)}
                className="w-full px-5 py-4 flex items-center gap-3 text-left hover:opacity-90 transition-opacity"
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${groupTitleClass(group)}`}>
                    {group.is_overdue && !group.is_today ? 'OVERDUE — ' : ''}
                    {group.due_date_label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {group.total_invoice_count} invoice
                  </p>
                </div>
                <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white shrink-0">
                  {fmt(group.total_outstanding)}
                </p>
                {open ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </button>

              {open && (
                <div className="border-t border-gray-100 dark:border-gray-700/80 divide-y divide-gray-50 dark:divide-gray-700/50">
                  {group.rows.map((row) => {
                    const locationText =
                      locationGrouping === 'branch'
                        ? `${row.branch_name} (${row.branch_code})`
                        : `${row.company_name}${row.company_type ? ` · ${row.company_type}` : ''}`

                    return (
                      <div
                        key={`${row.supplier_id}-${row.branch_id}-${row.invoice_status}`}
                        className="px-5 py-3 grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] gap-3 items-start sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {row.supplier_name}
                            {row.supplier_code && (
                              <span className="ml-1.5 text-xs font-normal text-gray-400">
                                {row.supplier_code}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span className="truncate">{locationText}</span>
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <BankInfo row={row} show={showBankInfo} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <StatusBadge status={row.invoice_status} />
                          <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                            {fmt(row.outstanding)}
                          </p>
                          <span className="text-xs text-gray-400">
                            {row.invoice_count} inv
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
