import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { useChartOfAccountsStore } from '@/features/accounting/chart-of-accounts/store/chartOfAccounts.store'
import { useDebounce } from '@/hooks/_shared/useDebounce'

interface Props {
  value: string[] // array of account IDs
  onChange: (accountIds: string[]) => void
  disabled?: boolean
  placeholder?: string
  maxDisplay?: number
}

export function MultiAccountSelector({ value, onChange, disabled, placeholder, maxDisplay = 3 }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const {
    postableAccounts: accounts,
    isLoadingPostable: loading,
    fetchPostableAccounts
  } = useChartOfAccountsStore()

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    fetchPostableAccounts()
  }, [fetchPostableAccounts])

  const filteredAccounts = useMemo(() => {
    if (!debouncedSearch.trim()) return accounts
    const searchLower = debouncedSearch.toLowerCase()
    return accounts.filter(
      (acc) =>
        acc.account_code.toLowerCase().includes(searchLower) ||
        acc.account_name.toLowerCase().includes(searchLower)
    )
  }, [accounts, debouncedSearch])

  const selectedAccounts = useMemo(() => {
    return accounts.filter(acc => value.includes(acc.id))
  }, [accounts, value])

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 360),
        zIndex: 9999
      })
    }
  }, [isOpen])

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

  const toggleAccount = (accountId: string) => {
    if (value.includes(accountId)) {
      onChange(value.filter(id => id !== accountId))
    } else {
      onChange([...value, accountId])
    }
  }

  const removeAccount = (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter(id => id !== accountId))
  }

  const displayText = useMemo(() => {
    if (selectedAccounts.length === 0) return null
    if (selectedAccounts.length <= maxDisplay) {
      return selectedAccounts.map(a => `${a.account_code}`).join(', ')
    }
    return `${selectedAccounts.slice(0, maxDisplay).map(a => a.account_code).join(', ')} +${selectedAccounts.length - maxDisplay}`
  }, [selectedAccounts, maxDisplay])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-left flex items-center justify-between hover:border-gray-400 dark:hover:border-gray-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-700 min-h-[38px]"
      >
        <div className="flex-1 flex flex-wrap gap-1 items-center">
          {selectedAccounts.length === 0 ? (
            <span className="text-gray-400 dark:text-gray-500 text-sm">
              {placeholder || 'Pilih akun...'}
            </span>
          ) : selectedAccounts.length <= 2 ? (
            selectedAccounts.map(acc => (
              <span key={acc.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] font-medium">
                {acc.account_code}
                <X size={10} className="cursor-pointer hover:text-red-500" onClick={(e) => removeAccount(acc.id, e)} />
              </span>
            ))
          ) : (
            <span className="text-gray-900 dark:text-gray-100 text-sm">{displayText}</span>
          )}
        </div>
        <ChevronDown size={16} className="text-gray-400 dark:text-gray-500 shrink-0 ml-2" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div ref={dropdownRef} style={dropdownStyle} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari akun..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {value.length > 0 && (
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{value.length} akun dipilih</span>
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="text-[10px] text-red-500 hover:text-red-700"
                  >
                    Hapus semua
                  </button>
                </div>
              )}
            </div>

            {/* Account list */}
            <div className="overflow-y-auto max-h-56 bg-white dark:bg-gray-800">
              {loading ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Loading...</div>
              ) : filteredAccounts.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Tidak ditemukan</div>
              ) : (
                filteredAccounts.map((account) => {
                  const isSelected = value.includes(account.id)
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => toggleAccount(account.id)}
                      className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{account.account_code}</span>
                        <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">{account.account_name}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">{account.account_type}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
