import { useState, useEffect, useRef, useCallback } from 'react'
import { Building2, Loader2, ChevronDown, Search, CheckCircle, Banknote, CreditCard, X } from 'lucide-react'
import { bankAccountsApi } from '../../../bank-accounts/api/bankAccounts.api'
import { useBranchContextStore } from '../../../branch_context'

interface BankAccount {
  id: number
  bank_id: number
  account_name: string
  account_number: string
  bank_name?: string
}

interface BankAccountSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: string
}

export function BankAccountSelect({
  value,
  onChange,
  disabled = false,
  error,
}: BankAccountSelectProps) {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  const currentBranch = useBranchContextStore((state) => state.currentBranch)
  const companyId = currentBranch?.company_id

  const fetchBankAccounts = useCallback(async () => {
    if (!companyId) {
      setBankAccounts([])
      return
    }

    setLoading(true)
    try {
      const accounts = await bankAccountsApi.getByOwner('company', companyId)
      setBankAccounts(accounts || [])
    } catch {
      // Error handled silently - UI will show empty state
      setBankAccounts([])
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (isOpen && companyId) {
      fetchBankAccounts()
    }
  }, [isOpen, companyId, fetchBankAccounts])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const filteredAccounts = bankAccounts.filter((account) => {
    const searchLower = search.toLowerCase()
    return (
      account.account_name.toLowerCase().includes(searchLower) ||
      account.account_number.includes(searchLower) ||
      account.bank_name?.toLowerCase().includes(searchLower)
    )
  })

  const selectedAccount = bankAccounts.find((acc) => String(acc.id) === value)

  const handleToggleDropdown = () => {
    if (!disabled && !loading) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <label className="label mb-1.5 px-1">
        <span className="label-text font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <span>Pilih Akun Bank</span>
        </span>
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={handleToggleDropdown}
          disabled={disabled || !companyId}
          className={`
            w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left
            transition-all duration-200 outline-none cursor-pointer
            ${error
              ? 'border-red-300 dark:border-red-600 bg-red-50/50 dark:bg-red-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-blue-400/50'
            }
            ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-500' : ''}
            ${disabled 
              ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' 
              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }
          `}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`
              p-2.5 rounded-xl shrink-0
              ${selectedAccount 
                ? 'bg-linear-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20' 
                : 'bg-gray-100 dark:bg-gray-700'
              }
            `}>
              {selectedAccount ? (
                <Banknote className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <CreditCard className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div className="flex flex-col items-start min-w-0">
              {selectedAccount ? (
                <>
                  <span className="font-semibold text-gray-900 dark:text-white truncate w-full">
                    {selectedAccount.account_name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                      {selectedAccount.account_number}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedAccount.bank_name || 'Bank'}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">Pilih akun bank tujuan...</span>
              )}
            </div>
          </div>
          
          <div className="shrink-0 ml-3">
            {loading ? (
              <div className="relative">
                <div className="w-5 h-5 border-2 border-blue-200 rounded-full animate-spin" />
                <div className="absolute top-0 left-0 w-5 h-5 border-2 border-blue-600 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
              </div>
            ) : (
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
            )}
          </div>
        </button>

        {/* Dropdown dengan Backdrop Blur */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-2">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/10 backdrop-blur-sm -z-10"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown Content */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Search Input with Icon */}
              <div className="p-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-700/30">
                <div className="relative group">
                  <div className={`
                    absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors
                    ${search ? 'text-blue-500' : 'text-gray-400 group-focus-within:text-blue-500'}
                  `}>
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Cari nama bank atau nomor rekening..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                    </button>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 p-1.5">
                {!companyId ? (
                  <div className="p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full mb-3">
                      <Building2 className="w-6 h-6 text-amber-500" />
                    </div>
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                      Company belum dipilih
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Silakan pilih branch terlebih dahulu
                    </p>
                  </div>
                ) : loading ? (
                  <div className="p-8 text-center">
                    <div className="relative inline-block">
                      <div className="w-10 h-10 border-3 border-blue-100 dark:border-blue-900/30 rounded-full animate-spin" />
                      <div className="absolute top-0 left-0 w-10 h-10 border-3 border-blue-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                      Memuat akun bank...
                    </p>
                  </div>
                ) : filteredAccounts.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                      <Banknote className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {search ? 'Tidak ada hasil pencarian' : 'Belum ada akun bank'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {search ? 'Coba kata kunci lain' : 'Buat akun bank di menu Bank Accounts'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredAccounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => {
                          onChange(String(account.id))
                          setIsOpen(false)
                          setSearch('')
                        }}
                        className={`
                          w-full px-3 py-3 text-left rounded-lg transition-all duration-200 group
                          ${String(account.id) === value 
                            ? 'bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`
                              p-2 rounded-lg shrink-0 transition-colors
                              ${String(account.id) === value 
                                ? 'bg-blue-100 dark:bg-blue-800/30' 
                                : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                              }
                            `}>
                              <Banknote className={`w-4 h-4 ${String(account.id) === value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                            </div>
                            <div className="min-w-0">
                              <p className={`font-semibold truncate ${String(account.id) === value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                                {account.account_name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`
                                  text-xs font-mono px-1.5 py-0.5 rounded
                                  ${String(account.id) === value 
                                    ? 'bg-blue-100 dark:bg-blue-800/30 text-blue-600 dark:text-blue-300' 
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                  }
                                `}>
                                  {account.account_number}
                                </span>
                                {account.bank_name && (
                                  <>
                                    <span className="text-gray-300 dark:text-gray-600">•</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {account.bank_name}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          {String(account.id) === value && (
                            <div className="shrink-0 ml-2">
                              <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <CheckCircle className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer dengan Stats */}
              {companyId && bankAccounts.length > 0 && !loading && (
                <div className="px-4 py-3 bg-gray-50/80 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Menampilkan {filteredAccounts.length} dari {bankAccounts.length} akun
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                      <span>Tersedia</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 px-1 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <p className="text-xs font-medium text-red-500">{error}</p>
        </div>
      )}
    </div>
  )
}

// Simple select version
export function BankAccountSelectSimple({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(false)
  
  const currentBranch = useBranchContextStore((s) => s.currentBranch)
  const companyId = currentBranch?.company_id

  useEffect(() => {
    const fetchAccounts = async () => {
      if (!companyId) {
        setBankAccounts([])
        return
      }
      setLoading(true)
      try {
        const accounts = await bankAccountsApi.getByOwner('company', companyId)
        setBankAccounts(accounts || [])
      } catch {
        setBankAccounts([])
      } finally {
        setLoading(false)
      }
    }
    fetchAccounts()
  }, [companyId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 p-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        Memuat...
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !companyId}
      className="select select-bordered w-full"
    >
      <option value="">-- Pilih Akun Bank --</option>
      {bankAccounts.map((account) => (
        <option key={account.id} value={String(account.id)}>
          {account.account_name} - {account.account_number}
        </option>
      ))}
    </select>
  )
}

