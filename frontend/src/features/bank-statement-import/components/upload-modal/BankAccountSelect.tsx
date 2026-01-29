import { useState, useEffect } from 'react'
import { Building2, Loader2, ChevronDown, Search, CheckCircle } from 'lucide-react'
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
  
  const currentBranch = useBranchContextStore((state) => state.currentBranch)
  const companyId = currentBranch?.company_id

  const fetchBankAccounts = async () => {
    if (!companyId) {
      setBankAccounts([])
      return
    }

    setLoading(true)
    try {
      const accounts = await bankAccountsApi.getByOwner('company', companyId)
      setBankAccounts(accounts || [])
    } catch {
      console.error('Failed to fetch bank accounts')
      setBankAccounts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && companyId) {
      fetchBankAccounts()
    }
  }, [isOpen, companyId, fetchBankAccounts])

  const filteredAccounts = bankAccounts.filter((account) => {
    const searchLower = search.toLowerCase()
    return (
      account.account_name.toLowerCase().includes(searchLower) ||
      account.account_number.includes(searchLower) ||
      account.bank_name?.toLowerCase().includes(searchLower)
    )
  })

  const selectedAccount = bankAccounts.find((acc) => String(acc.id) === value)



  return (
    <div className="relative">
      <label className="label mb-1 px-1">
        <span className="label-text font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Akun Bank
        </span>
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled || !companyId}
          className={`
            w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-left
            transition-all duration-200 outline-none
            ${error
              ? 'border-red-300 dark:border-red-600 bg-red-50/50 dark:bg-red-900/20'
              : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
            }
            ${isOpen ? 'ring-4 ring-blue-500/10 border-blue-500' : ''}
            ${disabled 
              ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-70' 
              : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }
          `}
        >
          <div className="flex flex-col items-start min-w-0">
            {selectedAccount ? (
              <>
                <span className="font-medium text-gray-900 dark:text-white truncate w-full">
                  {selectedAccount.account_name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 truncate w-full">
                  {selectedAccount.account_number} • {selectedAccount.bank_name || 'Bank'}
                </span>
              </>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">Pilih akun bank tujuan...</span>
            )}
          </div>
          
          <div className="shrink-0 ml-3">
            {loading ? (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            ) : (
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
            )}
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <>
            {/* Backdrop for closing */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown Content */}
            <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Search Input */}
              <div className="p-3 border-b border-gray-100 dark:border-gray-700/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari nama atau nomor rekening..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                {!companyId ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-lg inline-block">
                      Company belum dipilih
                    </p>
                  </div>
                ) : filteredAccounts.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {search ? 'Tidak ada hasil pencarian' : 'Belum ada akun bank'}
                    </p>
                  </div>
                ) : (
                  <div className="p-1.5 space-y-0.5">
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
                          w-full px-3 py-2.5 text-left rounded-lg transition-colors group
                          ${String(account.id) === value 
                            ? 'bg-blue-50 dark:bg-blue-900/20' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className={`font-medium truncate ${String(account.id) === value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                              {account.account_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs mt-0.5">
                              <span className="font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                {account.account_number}
                              </span>
                              {account.bank_name && (
                                <span className="text-gray-400">• {account.bank_name}</span>
                              )}
                            </div>
                          </div>
                          {String(account.id) === value && (
                            <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 ml-3" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {companyId && bankAccounts.length > 0 && (
                <div className="px-4 py-2.5 bg-gray-50/50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700/50">
                  <p className="text-xs text-gray-400 text-center">
                    Menampilkan {filteredAccounts.length} dari {bankAccounts.length} akun
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="mt-1.5 px-1 text-xs font-medium text-red-500 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-red-500" />
          {error}
        </p>
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

