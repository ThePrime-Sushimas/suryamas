import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { apTheme } from '../ap-payments.theme'

export interface BankAccountUsageItem {
  bankAccountId: number
  bankName: string
  accountNumber: string
  usedAmount: number
  balance?: number
}

export interface BulkSummaryPanelProps {
  supplierCount: number
  invoiceCount: number
  grandTotal: number
  paymentCount: number
  bankAccountUsage: BankAccountUsageItem[]
  canViewBalance: boolean
  hasInsufficientBalance: boolean
  onSubmit: () => void
  isSubmitting: boolean
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

/**
 * Summary panel for the Bulk Create page.
 *
 * Displays:
 * - Total suppliers, invoices, and grand total
 * - Bank account usage breakdown (only assigned accounts)
 * - Balance + sufficiency indicator when canViewBalance
 * - Submit button with payment count
 *
 * Sticky at lg+ breakpoint, normal flow below.
 */
export function BulkSummaryPanel({
  supplierCount,
  invoiceCount,
  grandTotal,
  paymentCount,
  bankAccountUsage,
  canViewBalance,
  hasInsufficientBalance,
  onSubmit,
  isSubmitting,
}: BulkSummaryPanelProps) {
  const isSubmitDisabled =
    paymentCount === 0 ||
    (canViewBalance && hasInsufficientBalance) ||
    isSubmitting

  return (
    <div className={`${apTheme.card} p-5 lg:sticky lg:top-4`}>
      {/* Title */}
      <h2 className={`${apTheme.titleSm} mb-4`}>Ringkasan Pembayaran</h2>

      {/* Stats */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between">
          <span className={apTheme.muted}>Total supplier</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {supplierCount}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={apTheme.muted}>Total invoice dipilih</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {invoiceCount}
          </span>
        </div>
        <div className={`flex items-center justify-between pt-2 border-t ${apTheme.divideBorder}`}>
          <span className={`text-sm font-medium ${apTheme.label}`}>Total pembayaran</span>
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {fmtCurrency(grandTotal)}
          </span>
        </div>
      </div>

      {/* Bank account usage section */}
      {bankAccountUsage.length > 0 && (
        <div className={`pt-4 border-t ${apTheme.divideBorder}`}>
          <h3 className={`${apTheme.sectionTitle} mb-3`}>Penggunaan per Rekening</h3>
          <div className="space-y-3">
            {bankAccountUsage.map((account) => {
              const isOverBalance =
                canViewBalance &&
                account.balance != null &&
                account.usedAmount > account.balance

              return (
                <div
                  key={account.bankAccountId}
                  className={`p-3 rounded-xl border ${
                    isOverBalance
                      ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-900/20'
                      : `${apTheme.divideBorder} bg-transparent`
                  }`}
                >
                  {/* Bank name + account number */}
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {account.bankName}
                  </p>
                  <p className={`text-xs ${apTheme.muted}`}>{account.accountNumber}</p>

                  {/* Used amount */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-xs ${apTheme.label}`}>Digunakan</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {fmtCurrency(account.usedAmount)}
                    </span>
                  </div>

                  {/* Balance (only when canViewBalance) */}
                  {canViewBalance && account.balance != null && (
                    <div className="mt-1 flex items-center justify-between">
                      <span className={`text-xs ${apTheme.label}`}>Saldo</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {fmtCurrency(account.balance)}
                        </span>
                        {isOverBalance ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="Saldo tidak mencukupi" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-label="Saldo mencukupi" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Submit button */}
      <div className={`mt-5 pt-4 border-t ${apTheme.divideBorder}`}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitDisabled}
          className={`w-full justify-center ${apTheme.btnPrimaryLg}`}
          aria-label={`Buat ${paymentCount} Pembayaran`}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Buat {paymentCount} Pembayaran
        </button>
      </div>
    </div>
  )
}
