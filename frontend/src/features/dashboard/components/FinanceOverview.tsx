import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Landmark, Calendar, ArrowRight } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

interface BankAccount {
  id: number
  bank_name: string
  account_name: string
  account_number: string
  is_active: boolean
}

interface BankImport {
  id: number
  bank_account_id: number
  status: string
  created_at: string
  total_entries: number
}

interface FiscalPeriod {
  id: string
  period: string
  period_start: string
  period_end: string
  is_open: boolean
  fiscal_year: number
}

interface Props {
  bankAccounts: BankAccount[] | undefined
  bankImports: BankImport[] | undefined
  fiscalPeriods: FiscalPeriod[] | undefined
  totalFee: number
  isLoading: boolean
}

export function FinanceOverview({ bankAccounts, bankImports, fiscalPeriods, totalFee, isLoading }: Props) {
  const bankStatus = useMemo(() => {
    if (!bankAccounts) return []
    const importMap = new Map<number, { count: number; latest: string }>()
    const imports = bankImports || []
    for (const imp of imports) {
      const existing = importMap.get(imp.bank_account_id)
      if (!existing || imp.created_at > existing.latest) {
        importMap.set(imp.bank_account_id, {
          count: (existing?.count || 0) + 1,
          latest: imp.created_at,
        })
      }
    }
    return bankAccounts.filter((a) => a.is_active).map((a) => ({
      ...a,
      hasImport: importMap.has(a.id),
      importCount: importMap.get(a.id)?.count || 0,
    }))
  }, [bankAccounts, bankImports])

  const fiscalStatus = useMemo(() => {
    if (!fiscalPeriods) return { open: 0, closed: 0, current: null as FiscalPeriod | null }
    const now = new Date().toISOString().slice(0, 10)
    const current = fiscalPeriods.find((p) => p.period_start <= now && p.period_end >= now) || null
    return {
      open: fiscalPeriods.filter((p) => p.is_open).length,
      closed: fiscalPeriods.filter((p) => !p.is_open).length,
      current,
    }
  }, [fiscalPeriods])

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="p-3 space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-50 dark:bg-gray-700 rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Keuangan</span>
      </div>

      <div className="divide-y divide-gray-50 dark:divide-gray-700">
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2 mb-2">
            <Landmark className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Bank Statement</span>
          </div>
          {bankStatus.length === 0 ? (
            <p className="text-[11px] text-gray-400">Belum ada akun bank</p>
          ) : (
            <div className="space-y-1.5">
              {bankStatus.map((a) => (
                <Link
                  key={a.id}
                  to="/bank-statement-import"
                  className="flex items-center justify-between py-1 group hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-1 px-1 rounded transition-colors duration-120"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{a.bank_name} · {a.account_number.slice(-4)}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                    a.hasImport
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                  }`}>
                    {a.hasImport ? `${a.importCount} import` : 'Belum import'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="px-3 py-2.5">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Total MDR / Fee Periode Ini</p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmt(totalFee)}</p>
        </div>

        {/* Fiscal Period */}
        <Link to="/accounting/fiscal-periods" className="px-3 py-2.5 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-120">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-violet-500" />
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Fiscal Period {new Date().getFullYear()}</p>
              <p className="text-[11px] text-gray-400">
                {fiscalStatus.current
                  ? `${fiscalStatus.current.period} — ${fiscalStatus.current.is_open ? 'Open' : 'Closed'}`
                  : 'Tidak ada periode aktif'}
                {' · '}{fiscalStatus.open} open, {fiscalStatus.closed} closed
              </p>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
        </Link>
      </div>
    </div>
  )
}
