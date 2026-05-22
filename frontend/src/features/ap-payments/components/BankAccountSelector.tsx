import { useMemo } from 'react'
import { type CompanyBankAccount } from '../hooks/useCompanyBankAccounts'
import { apTheme } from '../ap-payments.theme'

interface BankAccountSelectorProps {
  accounts: CompanyBankAccount[]
  value: number | null
  onChange: (id: number | null) => void
  disabled?: boolean
  canViewBalance: boolean
  totalAssigned?: number // for sufficiency indicator
  error?: boolean
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(v)

/**
 * Dropdown selector for company bank accounts.
 *
 * - When canViewBalance=true: shows bank name + account number + balance (IDR) per option
 * - When canViewBalance=false: shows bank name + account number only per option
 * - When canViewBalance=true and an account is selected: shows balance sufficiency indicator below
 * - When canViewBalance=false and an account is selected: shows "🔒 Saldo tidak ditampilkan"
 * - Supports disabled state and error highlighting
 */
export function BankAccountSelector({
  accounts,
  value,
  onChange,
  disabled = false,
  canViewBalance,
  totalAssigned = 0,
  error = false,
}: BankAccountSelectorProps) {
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === value) ?? null,
    [accounts, value],
  )

  const selectClassName = [
    apTheme.select,
    'w-full',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    error
      ? 'border-red-300 bg-red-50/50 dark:bg-red-900/10'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1">
      <select
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value
          onChange(val ? Number(val) : null)
        }}
        disabled={disabled}
        className={selectClassName}
        aria-label="Pilih rekening bank"
        aria-invalid={error || undefined}
      >
        <option value="">Pilih rekening...</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.bank_name} - {account.account_number}
            {canViewBalance && account.balance != null
              ? ` (${fmtCurrency(account.balance)})`
              : ''}
          </option>
        ))}
      </select>

      {/* Balance info below dropdown (only when canViewBalance is enabled) */}
      {canViewBalance && value != null && selectedAccount && (
        <BalanceInfo
          account={selectedAccount}
          totalAssigned={totalAssigned}
        />
      )}
    </div>
  )
}

// --- Balance info sub-component ---

interface BalanceInfoProps {
  account: CompanyBankAccount
  totalAssigned: number
}

function BalanceInfo({ account, totalAssigned }: BalanceInfoProps) {
  const balance = account.balance ?? 0
  const isSufficient = balance >= totalAssigned

  return (
    <span
      className={`text-xs font-medium ${
        isSufficient
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-amber-600 dark:text-amber-400'
      }`}
    >
      Saldo: {fmtCurrency(balance)}{' '}
      {isSufficient ? '✓' : '⚠️'}
    </span>
  )
}
