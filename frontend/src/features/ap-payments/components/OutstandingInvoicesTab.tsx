import { useState, useCallback, useMemo, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import { useOutstandingInvoicesPaginated, useAssignBankAccount, type OutstandingInvoiceRow, type OutstandingInvoicesQuery } from '../api/apPayments.api'
import { useCompanyBankAccounts } from '../hooks/useCompanyBankAccounts'
import { AgingBadge } from './AgingBadge'
import { BankAccountSelector } from './BankAccountSelector'
import { BulkSelectionBar } from './BulkSelectionBar'
import { apTheme } from '../ap-payments.theme'

const MAX_SELECTION = 50
const DEFAULT_PAGE_SIZE = 10

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(v)

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

interface OutstandingInvoicesTabProps {
  filters: {
    supplierId: string
    branchId: string
    search: string
    dateFrom: string
    dateTo: string
  }
}

export function OutstandingInvoicesTab({ filters }: OutstandingInvoicesTabProps) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Track remaining_amount for selected invoices across pages
  const [selectedAmounts, setSelectedAmounts] = useState<Map<string, number>>(new Map())
  // V2: Track bank account assignments per invoice
  const [bankAccountAssignments, setBankAccountAssignments] = useState<Map<string, number | null>>(new Map())

  // Fetch company bank accounts for the Rekening Bayar column
  const {
    data: bankAccounts = [],
    isLoading: isBankAccountsLoading,
    isError: isBankAccountsError,
  } = useCompanyBankAccounts()

  // Mutation for auto-saving bank account assignment
  const assignMutation = useAssignBankAccount()

  const query: OutstandingInvoicesQuery = useMemo(
    () => ({
      page,
      limit,
      ...(filters.supplierId ? { supplier_id: filters.supplierId } : {}),
      ...(filters.branchId ? { branch_id: filters.branchId } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
      ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
    }),
    [page, limit, filters],
  )

  const { data, isLoading, isError } = useOutstandingInvoicesPaginated(query)

  const invoices = data?.data ?? []
  const pagination = data?.pagination

  // Sync bankAccountAssignments from API data (persisted assignments)
  useEffect(() => {
    if (!data?.data || data.data.length === 0) return
    setBankAccountAssignments((prev) => {
      const next = new Map(prev)
      for (const inv of data.data) {
        // Only set from API if not already locally overridden
        if (!next.has(inv.id) && inv.assigned_bank_account_id != null) {
          next.set(inv.id, inv.assigned_bank_account_id)
        }
      }
      return next
    })
  }, [data])

  const isMaxReached = selectedIds.size >= MAX_SELECTION

  const handleToggle = useCallback(
    (invoiceId: string, checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (checked) {
          if (next.size >= MAX_SELECTION) return prev
          next.add(invoiceId)
        } else {
          next.delete(invoiceId)
        }
        return next
      })
      // Track remaining_amount for total calculation
      if (checked) {
        const inv = invoices.find((i) => i.id === invoiceId)
        if (inv) {
          setSelectedAmounts((prev) => {
            const next = new Map(prev)
            next.set(invoiceId, inv.remaining_amount)
            return next
          })
        }
      } else {
        setSelectedAmounts((prev) => {
          const next = new Map(prev)
          next.delete(invoiceId)
          return next
        })
        // V2: Reset bank account assignment when unchecking
        setBankAccountAssignments((prev) => {
          const next = new Map(prev)
          next.delete(invoiceId)
          return next
        })
      }
    },
    [invoices],
  )

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (checked) {
          for (const inv of invoices) {
            if (next.size >= MAX_SELECTION) break
            next.add(inv.id)
          }
        } else {
          for (const inv of invoices) {
            next.delete(inv.id)
          }
        }
        return next
      })
      setSelectedAmounts((prev) => {
        const next = new Map(prev)
        if (checked) {
          for (const inv of invoices) {
            if (next.size >= MAX_SELECTION) break
            next.set(inv.id, inv.remaining_amount)
          }
        } else {
          for (const inv of invoices) {
            next.delete(inv.id)
          }
        }
        return next
      })
      // V2: Reset bank account assignments when unchecking all
      if (!checked) {
        setBankAccountAssignments((prev) => {
          const next = new Map(prev)
          for (const inv of invoices) {
            next.delete(inv.id)
          }
          return next
        })
      }
    },
    [invoices],
  )

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit)
    setPage(1)
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setSelectedAmounts(new Map())
    setBankAccountAssignments(new Map())
  }, [])

  // V2: Handle bank account assignment change per invoice (auto-save to DB)
  const handleBankAccountChange = useCallback(
    (invoiceId: string, bankAccountId: number | null) => {
      setBankAccountAssignments((prev) => {
        const next = new Map(prev)
        next.set(invoiceId, bankAccountId)
        return next
      })
      // Auto-save to database
      assignMutation.mutate({ invoiceId, bankAccountId })
    },
    [assignMutation],
  )

  const totalRemainingAmount = useMemo(() => {
    let total = 0
    selectedAmounts.forEach((amount) => {
      total += amount
    })
    return total
  }, [selectedAmounts])

  // Check if all current page invoices are selected
  const allPageSelected =
    invoices.length > 0 && invoices.every((inv) => selectedIds.has(inv.id))
  const somePageSelected =
    invoices.some((inv) => selectedIds.has(inv.id)) && !allPageSelected

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Gagal memuat data invoice outstanding
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Max selection warning */}
      {isMaxReached && (
        <div className="mx-4 sm:mx-6 mt-3 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-700 dark:text-amber-300">
          Maksimal {MAX_SELECTION} invoice dapat dipilih sekaligus.
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={apTheme.skeleton} />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className={`text-center py-16 ${apTheme.card} p-8`}>
            <p className={apTheme.muted}>Tidak ada invoice outstanding</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rose-200/80 dark:border-gray-700">
                  <th className="px-3 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected
                      }}
                      onChange={(e) => handleToggleAll(e.target.checked)}
                      disabled={isMaxReached && !allPageSelected}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-rose-500 focus:ring-rose-400"
                      aria-label="Pilih semua invoice di halaman ini"
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    No. Invoice
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    Supplier
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    Cabang
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    Total
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    Sisa
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    Tgl Terima
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    Jatuh Tempo
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                    Pembayaran
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300 min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <span>Rekening Bayar</span>
                      {isBankAccountsError && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500" title="Gagal memuat data rekening">
                          <AlertCircle className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100 dark:divide-gray-700">
                {invoices.map((inv) => (
                  <InvoiceRow
                    key={inv.id}
                    invoice={inv}
                    selected={selectedIds.has(inv.id)}
                    disabled={isMaxReached && !selectedIds.has(inv.id)}
                    onToggle={handleToggle}
                    bankAccounts={bankAccounts}
                    bankAccountId={bankAccountAssignments.get(inv.id) ?? null}
                    onBankAccountChange={handleBankAccountChange}
                    isBankAccountsLoading={isBankAccountsLoading}
                    isBankAccountsError={isBankAccountsError}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className={`border-t ${apTheme.divideBorder} bg-white/85 dark:bg-gray-800 backdrop-blur-md px-4 py-3`}>
          <Pagination
            pagination={{
              ...pagination,
              hasNext: page < pagination.totalPages,
              hasPrev: page > 1,
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            currentLength={invoices.length}
            loading={isLoading}
            limitOptions={[10, 25, 50]}
          />
        </div>
      )}

      {/* Bottom spacer when sticky bar is visible */}
      {selectedIds.size > 0 && <div className="h-20" />}

      {/* Sticky action bar */}
      <BulkSelectionBar
        selectedIds={selectedIds}
        totalRemainingAmount={totalRemainingAmount}
        onClearSelection={handleClearSelection}
        bankAccountAssignments={bankAccountAssignments}
      />
    </div>
  )
}

// --- Invoice Row sub-component ---

interface InvoiceRowProps {
  invoice: OutstandingInvoiceRow
  selected: boolean
  disabled: boolean
  onToggle: (id: string, checked: boolean) => void
  bankAccounts: import('../hooks/useCompanyBankAccounts').CompanyBankAccount[]
  bankAccountId: number | null
  onBankAccountChange: (invoiceId: string, bankAccountId: number | null) => void
  isBankAccountsLoading: boolean
  isBankAccountsError: boolean
}

function InvoiceRow({
  invoice,
  selected,
  disabled,
  onToggle,
  bankAccounts,
  bankAccountId,
  onBankAccountChange,
  isBankAccountsLoading,
  isBankAccountsError,
}: InvoiceRowProps) {
  const isPartiallyPaid = invoice.remaining_amount < invoice.total_amount

  // Invoice verification status (existing)
  const invoiceStatusLabel =
    invoice.invoice_status === 'APPROVED' ? 'Siap Bayar' : 'Sudah Posting'
  const invoiceStatusColor =
    invoice.invoice_status === 'APPROVED'
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'

  // AP Payment flow status (new column)
  let paymentFlowLabel: string
  let paymentFlowColor: string
  if (isPartiallyPaid) {
    paymentFlowLabel = 'Partial Paid'
    paymentFlowColor = 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  } else {
    paymentFlowLabel = 'Belum Dibayar'
    paymentFlowColor = 'bg-gray-50 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400'
  }

  const isBankDropdownDisabled = isBankAccountsLoading || isBankAccountsError

  return (
    <tr className={`${apTheme.hoverRow} ${selected ? 'bg-rose-50/50 dark:bg-gray-700/40' : ''}`}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled}
          onChange={(e) => onToggle(invoice.id, e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-rose-500 focus:ring-rose-400 disabled:opacity-50"
          aria-label={`Pilih invoice ${invoice.invoice_number}`}
        />
      </td>
      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white max-w-[140px]">
        <span className="block truncate" title={invoice.invoice_number}>
          {invoice.invoice_number}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="text-gray-900 dark:text-white" title={
          invoice.supplier_bank_accounts.length > 0
            ? invoice.supplier_bank_accounts.map(ba => `${ba.bank_name} ${ba.account_number}`).join(' · ')
            : undefined
        }>{invoice.supplier_name}</div>
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {invoice.branch_name}
      </td>
      <td className="px-3 py-3 text-gray-900 dark:text-white whitespace-nowrap">
        {fmtCurrency(invoice.total_amount)}
      </td>
      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
        {fmtCurrency(invoice.remaining_amount)}
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {fmtDate(invoice.earliest_received_date)}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-gray-700 dark:text-gray-300">{fmtDate(invoice.due_date)}</span>
          <AgingBadge dueDate={invoice.due_date} />
        </div>
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${invoiceStatusColor}`}
        >
          {invoiceStatusLabel}
        </span>
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${paymentFlowColor}`}
        >
          {paymentFlowLabel}
        </span>
      </td>
      <td className="px-3 py-3">
        <BankAccountSelector
          accounts={bankAccounts}
          value={bankAccountId}
          onChange={(id) => onBankAccountChange(invoice.id, id)}
          disabled={isBankDropdownDisabled}
          canViewBalance={false}
        />
      </td>
    </tr>
  )
}
