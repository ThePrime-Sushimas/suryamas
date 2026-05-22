import { type CompanyBankAccount } from '../hooks/useCompanyBankAccounts'
import { type InvoiceAssignment } from '../hooks/useBulkCreateState'
import { BankAccountSelector } from './BankAccountSelector'
import { AgingBadge } from './AgingBadge'
import { apTheme } from '../ap-payments.theme'

export interface SupplierGroupCardProps {
  supplier: {
    id: string
    name: string
    bankAccounts: Array<{ bank_name: string; account_number: string }>
  }
  invoices: InvoiceAssignment[]
  companyBankAccounts: CompanyBankAccount[]
  canViewBalance: boolean
  groupNotes: string
  onGroupNotesChange: (notes: string) => void
  onApplyAll: (bankAccountId: number) => void
  onInvoiceToggle: (invoiceId: string, checked: boolean) => void
  onBankAccountChange: (invoiceId: string, bankAccountId: number | null) => void
  validationErrors: Set<string> // invoice IDs with missing bank account
}

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

const NOTES_MAX_LENGTH = 500

/**
 * Card displaying a supplier's invoices for bulk payment assignment.
 *
 * - Header: supplier name + supplier bank account info
 * - "Apply to all" bank account shortcut
 * - Invoice table with checkbox, invoice number, remaining amount, due date, BankAccountSelector
 * - Footer: subtotal + notes input
 */
export function SupplierGroupCard({
  supplier,
  invoices,
  companyBankAccounts,
  canViewBalance,
  groupNotes,
  onGroupNotesChange,
  onApplyAll,
  onInvoiceToggle,
  onBankAccountChange,
  validationErrors,
}: SupplierGroupCardProps) {
  const subtotal = invoices
    .filter((inv) => inv.checked)
    .reduce((sum, inv) => sum + inv.remainingAmount, 0)

  return (
    <div className={`${apTheme.card} p-5`}>
      {/* Header: Supplier name + bank account info */}
      <div className="mb-4">
        <h3 className={apTheme.sectionTitle}>{supplier.name}</h3>
        {supplier.bankAccounts.length > 0 && (
          <p className={`mt-1 ${apTheme.muted} text-xs`}>
            {supplier.bankAccounts.map((ba, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {ba.bank_name} {ba.account_number}
              </span>
            ))}
          </p>
        )}
      </div>

      {/* Apply to all shortcut */}
      <div className="flex items-center gap-3 mb-4">
        <label className={`text-xs font-medium whitespace-nowrap ${apTheme.label}`}>
          Terapkan ke semua invoice:
        </label>
        <div className="flex-1 max-w-xs">
          <BankAccountSelector
            accounts={companyBankAccounts}
            value={null}
            onChange={(id) => {
              if (id != null) onApplyAll(id)
            }}
            canViewBalance={canViewBalance}
          />
        </div>
      </div>

      {/* Invoice table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${apTheme.divideBorder}`}>
              <th className="px-2 py-2 text-left w-8" />
              <th className={`px-2 py-2 text-left ${apTheme.label}`}>No. Invoice</th>
              <th className={`px-2 py-2 text-right ${apTheme.label}`}>Sisa Bayar</th>
              <th className={`px-2 py-2 text-left ${apTheme.label}`}>Jatuh Tempo</th>
              <th className={`px-2 py-2 text-left ${apTheme.label}`}>Rekening Bayar</th>
            </tr>
          </thead>
          <tbody className={apTheme.divide}>
            {invoices.map((invoice) => {
              const hasError = validationErrors.has(invoice.invoiceId)
              const rowClassName = hasError
                ? 'border-red-300 bg-red-50/50 dark:bg-red-900/10'
                : ''

              return (
                <tr
                  key={invoice.invoiceId}
                  className={`border-b ${apTheme.divideBorder} ${rowClassName}`}
                  data-validation-error={hasError ? 'true' : undefined}
                >
                  {/* Checkbox */}
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={invoice.checked}
                      onChange={(e) =>
                        onInvoiceToggle(invoice.invoiceId, e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-rose-500 focus:ring-rose-400 dark:border-gray-600"
                      aria-label={`Pilih invoice ${invoice.invoiceNumber}`}
                    />
                  </td>

                  {/* Invoice number */}
                  <td className="px-2 py-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {invoice.invoiceNumber}
                    </span>
                  </td>

                  {/* Remaining amount */}
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <span className="text-gray-700 dark:text-gray-300">
                      {fmtCurrency(invoice.remainingAmount)}
                    </span>
                  </td>

                  {/* Due date + aging badge */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 dark:text-gray-300">
                        {fmtDate(invoice.dueDate)}
                      </span>
                      <AgingBadge dueDate={invoice.dueDate} />
                    </div>
                  </td>

                  {/* Bank account selector */}
                  <td className="px-2 py-2 min-w-[200px]">
                    <BankAccountSelector
                      accounts={companyBankAccounts}
                      value={invoice.bankAccountId}
                      onChange={(id) =>
                        onBankAccountChange(invoice.invoiceId, id)
                      }
                      disabled={!invoice.checked}
                      canViewBalance={canViewBalance}
                      error={hasError}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: Subtotal + Notes */}
      <div className={`mt-4 pt-4 border-t ${apTheme.divideBorder}`}>
        {/* Subtotal */}
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-medium ${apTheme.label}`}>Subtotal</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {fmtCurrency(subtotal)}
          </span>
        </div>

        {/* Notes input */}
        <div>
          <input
            type="text"
            value={groupNotes}
            onChange={(e) => {
              const value = e.target.value
              if (value.length <= NOTES_MAX_LENGTH) {
                onGroupNotesChange(value)
              }
            }}
            placeholder="Catatan untuk supplier ini (opsional)"
            maxLength={NOTES_MAX_LENGTH}
            className={apTheme.input}
            aria-label={`Catatan untuk ${supplier.name}`}
          />
          {groupNotes.length > 0 && (
            <p className={`mt-1 text-xs ${apTheme.muted}`}>
              {groupNotes.length}/{NOTES_MAX_LENGTH}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
