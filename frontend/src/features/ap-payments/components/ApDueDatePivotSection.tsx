import { ChevronDown, ChevronUp, Building2, Landmark } from 'lucide-react'
import type { ApDueDatePivotGroup, ApDueDatePivotRow } from '../api/apPayments.api'
import { apTheme } from '../ap-payments.theme'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

function StatusBadge({ status }: { status: ApDueDatePivotRow['invoice_status'] }) {
  if (status === 'POSTED') {
    return <span className={apTheme.badgeReady}>Siap bayar</span>
  }
  return <span className={apTheme.badgePending}>Menunggu post</span>
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
  if (group.is_overdue) return apTheme.groupOverdue
  if (group.is_today) return apTheme.groupToday
  if (!group.due_date) return apTheme.groupMuted
  return apTheme.groupDefault
}

function groupTitleClass(group: ApDueDatePivotGroup): string {
  if (group.is_overdue) return apTheme.groupTitleOverdue
  if (group.is_today) return apTheme.groupTitleToday
  return apTheme.groupTitleDefault
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
    <section className={apTheme.cardOverflow}>
      <div className={`px-5 py-4 border-b ${apTheme.divideBorder} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
        <div>
          <h2 className={apTheme.sectionTitle}>
            Payment planning
          </h2>
          <p className={`text-xs mt-0.5 ${apTheme.muted}`}>
            Outstanding per tanggal jatuh tempo · rekening dari master supplier
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={apTheme.pillBorderWrap}>
            <button
              type="button"
              onClick={() => onLocationGroupingChange('branch')}
              className={locationGrouping === 'branch' ? apTheme.pillActive : apTheme.pillInactive}
            >
              Per cabang
            </button>
            <button
              type="button"
              onClick={() => onLocationGroupingChange('entity')}
              className={locationGrouping === 'entity' ? apTheme.pillActive : apTheme.pillInactive}
            >
              Per rek (PT/CV)
            </button>
          </div>
          <button
            type="button"
            onClick={onToggleBankInfo}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-rose-200 dark:border-gray-600 text-xs font-medium ${apTheme.hoverRow}`}
          >
            <Landmark className="w-3.5 h-3.5" />
            {showBankInfo ? 'Sembunyikan bank' : 'Tampilkan bank'}
          </button>
        </div>
      </div>

      <div className={`divide-y ${apTheme.divide}`}>
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
                  <p className={`text-xs mt-0.5 ${apTheme.muted}`}>
                    {group.total_invoice_count} invoice
                  </p>
                </div>
                <p className={`text-sm font-bold tabular-nums shrink-0 ${apTheme.groupTitleDefault}`}>
                  {fmt(group.total_outstanding)}
                </p>
                {open ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </button>

              {open && (
                <div className={`border-t ${apTheme.divideBorder} divide-y ${apTheme.divide}`}>
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
                          <p className={`font-medium truncate ${apTheme.groupTitleDefault}`}>
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
                          <p className={`text-sm font-bold tabular-nums ${apTheme.groupTitleDefault}`}>
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
