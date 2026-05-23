import { useState, useEffect } from 'react'
import { type CompanyBankAccount } from '../hooks/useCompanyBankAccounts'
import { type InvoiceAssignment } from '../hooks/useBulkCreateState'
import { BankAccountSelector } from './BankAccountSelector'
import { AgingBadge } from './AgingBadge'
import { apTheme } from '../ap-payments.theme'
import { AP_PAYMENT_METHOD_LABELS } from '../constants'
import type { ApPaymentMethod } from '../api/apPayments.api'

export interface SupplierGroupCardProps {
  supplier: {
    id: string
    name: string
    bankAccounts: Array<{ bank_name: string; account_number: string; account_name: string }>
  }
  invoices: InvoiceAssignment[]
  companyBankAccounts: CompanyBankAccount[]
  groupNotes: string
  paymentMethod: ApPaymentMethod
  selectedSupplierBank: string
  onGroupNotesChange: (notes: string) => void
  onPaymentMethodChange: (method: ApPaymentMethod) => void
  onSupplierBankChange: (value: string) => void
  onInvoiceToggle: (invoiceId: string, checked: boolean) => void
  onBankAccountChange: (invoiceId: string, bankAccountId: number | null) => void
  onAmountPaidChange: (invoiceId: string, amount: number) => void
  validationErrors: Set<string>
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

export function SupplierGroupCard({
  supplier,
  invoices,
  companyBankAccounts,
  groupNotes,
  paymentMethod,
  selectedSupplierBank,
  onGroupNotesChange,
  onPaymentMethodChange,
  onSupplierBankChange,
  onInvoiceToggle,
  onBankAccountChange,
  onAmountPaidChange,
  validationErrors,
}: SupplierGroupCardProps) {
  const subtotal = invoices
    .filter((inv) => inv.checked)
    .reduce((sum, inv) => sum + inv.amountPaid, 0)

  return (
    <div className={`${apTheme.card} p-5`}>
      {/* Header: Supplier name */}
      <div className="mb-4">
        <h3 className={apTheme.sectionTitle}>{supplier.name}</h3>
      </div>

      {/* Controls: Metode bayar + Rekening supplier tujuan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className={`block text-xs font-medium mb-1 ${apTheme.label}`}>
            Metode Bayar
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => onPaymentMethodChange(e.target.value as ApPaymentMethod)}
            className={`${apTheme.select} w-full text-sm`}
          >
            {(Object.keys(AP_PAYMENT_METHOD_LABELS) as ApPaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {AP_PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        {supplier.bankAccounts.length > 0 && (
          <div>
            <label className={`block text-xs font-medium mb-1 ${apTheme.label}`}>
              Rekening Supplier Tujuan
            </label>
            <select
              value={selectedSupplierBank}
              onChange={(e) => onSupplierBankChange(e.target.value)}
              className={`${apTheme.select} w-full text-sm`}
            >
              {supplier.bankAccounts.length === 1 ? (
                <option value={`${supplier.bankAccounts[0].bank_name} ${supplier.bankAccounts[0].account_number}`}>
                  {supplier.bankAccounts[0].bank_name} — {supplier.bankAccounts[0].account_number} — {supplier.bankAccounts[0].account_name}
                </option>
              ) : (
                <>
                  <option value="">Pilih rekening tujuan...</option>
                  {supplier.bankAccounts.map((ba, i) => (
                    <option key={i} value={`${ba.bank_name} ${ba.account_number}`}>
                      {ba.bank_name} — {ba.account_number} — {ba.account_name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        )}
      </div>

      {/* Invoice table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${apTheme.divideBorder}`}>
              <th className="px-2 py-2 text-left w-8" />
              <th className={`px-2 py-2 text-left ${apTheme.label}`}>No. Invoice</th>
              <th className={`px-2 py-2 text-right ${apTheme.label}`}>Outstanding</th>
              <th className={`px-2 py-2 text-right ${apTheme.label}`}>Jumlah Bayar</th>
              <th className={`px-2 py-2 text-left ${apTheme.label}`}>Jatuh Tempo</th>
              <th className={`px-2 py-2 text-left ${apTheme.label}`}>Rek. Sumber</th>
            </tr>
          </thead>
          <tbody className={apTheme.divide}>
            {invoices.map((invoice) => (
              <InvoiceLineRow
                key={invoice.invoiceId}
                invoice={invoice}
                companyBankAccounts={companyBankAccounts}
                hasError={validationErrors.has(invoice.invoiceId)}
                onToggle={onInvoiceToggle}
                onBankAccountChange={onBankAccountChange}
                onAmountPaidChange={onAmountPaidChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: Subtotal + Notes */}
      <div className={`mt-4 pt-4 border-t ${apTheme.divideBorder}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-medium ${apTheme.label}`}>Subtotal</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {fmtCurrency(subtotal)}
          </span>
        </div>

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

// --- Invoice Line Row ---

interface InvoiceLineRowProps {
  invoice: InvoiceAssignment
  companyBankAccounts: CompanyBankAccount[]
  hasError: boolean
  onToggle: (invoiceId: string, checked: boolean) => void
  onBankAccountChange: (invoiceId: string, bankAccountId: number | null) => void
  onAmountPaidChange: (invoiceId: string, amount: number) => void
}

function InvoiceLineRow({
  invoice,
  companyBankAccounts,
  hasError,
  onToggle,
  onBankAccountChange,
  onAmountPaidChange,
}: InvoiceLineRowProps) {
  const [localAmount, setLocalAmount] = useState(String(invoice.amountPaid))

  useEffect(() => {
    setLocalAmount(String(invoice.amountPaid))
  }, [invoice.amountPaid])

  const handleAmountBlur = () => {
    const parsed = parseFloat(localAmount.replace(/,/g, ''))
    if (Number.isFinite(parsed) && parsed > 0) {
      const capped = Math.min(parsed, invoice.remainingAmount)
      onAmountPaidChange(invoice.invoiceId, capped)
      setLocalAmount(String(capped))
    } else {
      setLocalAmount(String(invoice.amountPaid))
    }
  }

  const rowClassName = hasError
    ? 'border-red-300 bg-red-50/50 dark:bg-red-900/10'
    : ''

  return (
    <tr
      className={`border-b ${apTheme.divideBorder} ${rowClassName}`}
      data-validation-error={hasError ? 'true' : undefined}
    >
      <td className="px-2 py-2">
        <input
          type="checkbox"
          checked={invoice.checked}
          onChange={(e) => onToggle(invoice.invoiceId, e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-rose-500 focus:ring-rose-400 dark:border-gray-600"
          aria-label={`Pilih invoice ${invoice.invoiceNumber}`}
        />
      </td>

      <td className="px-2 py-2">
        <span className="font-medium text-gray-900 dark:text-white">
          {invoice.invoiceNumber}
        </span>
      </td>

      <td className="px-2 py-2 text-right whitespace-nowrap">
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          {fmtCurrency(invoice.remainingAmount)}
        </span>
      </td>

      <td className="px-2 py-2 text-right">
        <input
          type="text"
          inputMode="decimal"
          value={localAmount}
          onChange={(e) => setLocalAmount(e.target.value)}
          onBlur={handleAmountBlur}
          disabled={!invoice.checked}
          className={`${apTheme.input} w-28 text-right text-sm disabled:opacity-50`}
          aria-label={`Jumlah bayar ${invoice.invoiceNumber}`}
        />
      </td>

      <td className="px-2 py-2 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-gray-700 dark:text-gray-300">
            {fmtDate(invoice.dueDate)}
          </span>
          <AgingBadge dueDate={invoice.dueDate} />
        </div>
      </td>

      <td className="px-2 py-2 min-w-[180px]">
        <BankAccountSelector
          accounts={companyBankAccounts}
          value={invoice.bankAccountId}
          onChange={(id) => onBankAccountChange(invoice.invoiceId, id)}
          disabled={!invoice.checked}
          canViewBalance={false}
          error={hasError}
        />
      </td>
    </tr>
  )
}
