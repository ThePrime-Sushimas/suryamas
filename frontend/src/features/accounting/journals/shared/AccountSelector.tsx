import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { useChartOfAccountsStore } from '../../chart-of-accounts/store/chartOfAccounts.store'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import type { ChartOfAccount } from '@/features/accounting/chart-of-accounts/types/chart-of-account.types'

interface Props {
  value: string
  onChange: (accountId: string) => void
  disabled?: boolean
  placeholder?: string
  /**
   * Optional account info passed directly for cases where account is not in the cache
   * (e.g., when editing a journal with non-postable accounts)
   */
  accountInfo?: {
    account_code: string
    account_name: string
    account_type: string
  } | null
}

export function AccountSelector({ value, onChange, disabled, placeholder, accountInfo }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Use global store for accounts data
  const {
    postableAccounts: accounts,
    isLoadingPostable: loading,
    fetchPostableAccounts
  } = useChartOfAccountsStore()

  // Debounced search for better performance
  const debouncedSearch = useDebounce(search, 300)

  // Fetch accounts on first mount
  useEffect(() => {
    fetchPostableAccounts()
  }, [fetchPostableAccounts])

  // Get local search filter for postable accounts
  const filteredAccounts = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return accounts
    }
    const searchLower = debouncedSearch.toLowerCase()
    return accounts.filter(
      (acc) =>
        acc.account_code.toLowerCase().includes(searchLower) ||
        acc.account_name.toLowerCase().includes(searchLower)
    )
  }, [accounts, debouncedSearch])

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 300),
        zIndex: 9999
      })
    }
  }, [isOpen])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get selected account - prefer accountInfo prop if provided, otherwise search in cache
  const selectedAccount = useMemo(() => {
    if (accountInfo) {
      return {
        id: value,
        ...accountInfo
      } as ChartOfAccount
    }
    return accounts.find((acc) => acc.id === value)
  }, [accounts, value, accountInfo])

  const handleSelect = (accountId: string) => {
    onChange(accountId)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full border rounded px-3 py-2 text-left flex items-center justify-between hover:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <span className={selectedAccount ? 'text-gray-900' : 'text-gray-400'}>
          {selectedAccount
            ? `${selectedAccount.account_code} - ${selectedAccount.account_name}`
            : placeholder || 'Select account...'}
        </span>
        <ChevronDown size={16} className="text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-9998" onClick={() => setIsOpen(false)} />
          <div ref={dropdownRef} style={dropdownStyle} className="bg-white border rounded-lg shadow-lg max-h-80 overflow-hidden">
            <div className="p-2 border-b bg-white sticky top-0">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search account..."
                  className="w-full pl-9 pr-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-64 bg-white">
              {loading ? (
                <div className="p-4 text-center text-gray-500 text-sm">Loading accounts...</div>
              ) : filteredAccounts.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No accounts found</div>
              ) : (
                filteredAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => handleSelect(account.id)}
                    className={`w-full px-3 py-2 text-left hover:bg-blue-50 flex flex-col border-b last:border-b-0 ${
                      value === account.id ? 'bg-blue-100' : ''
                    }`}
                  >
                    <span className="font-medium text-sm">{account.account_code}</span>
                    <span className="text-xs text-gray-600">{account.account_name}</span>
                    <span className="text-xs text-gray-400">{account.account_type}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
