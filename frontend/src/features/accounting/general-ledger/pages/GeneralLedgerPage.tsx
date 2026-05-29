import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '@/lib/axios'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { MultiAccountSelector } from '../components/MultiAccountSelector'

// Types
interface AccountInfo {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  normal_balance: string
}

interface OpeningRow {
  account_id: string
  opening_debit: number
  opening_credit: number
  opening_balance: number
}

interface LedgerLine {
  line_id: string
  account_id: string
  account_code: string
  account_name: string
  journal_date: string
  journal_number: string
  journal_type: string
  source_module: string | null
  journal_description: string | null
  line_description: string | null
  reference_number: string | null
  reference_type: string | null
  reference_id: string | null
  debit_amount: number
  credit_amount: number
  net_amount: number
  running_balance: number
  branch_id: string | null
}

interface Summary {
  total_debit: number
  total_credit: number
  ending_balance: number
  line_count: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface GeneralLedgerResponse {
  accounts: AccountInfo[]
  opening: OpeningRow[]
  lines: LedgerLine[]
  summary: Summary
  pagination: Pagination
}

const SOURCE_LABELS: Record<string, string> = {
  POS_AGGREGATES: 'POS',
  BANK_RECONCILIATION: 'Bank',
  purchase_invoices: 'Faktur Beli',
  general_invoices: 'Invoice Umum',
  general_invoice_payments: 'Bayar Invoice',
  ap_payments: 'Bayar AP',
  marketplace_po: 'Marketplace',
  FISCAL_CLOSING: 'Tutup Buku',
}

function fmt(v: number): string {
  if (Math.abs(v) < 0.005) return '-'
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function getLocalMonth(): { first: string; last: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const first = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDate = new Date(y, m + 1, 0)
  const last = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`
  return { first, last }
}

function formatDate(d: string): string {
  if (!d) return ''
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}

export default function GeneralLedgerPage() {
  const { branches } = useBranchContextStore()

  const { first, last } = useMemo(() => getLocalMonth(), [])
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState(first)
  const [dateTo, setDateTo] = useState(last)
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(50)

  const [fetchKey, setFetchKey] = useState(0)
  const [appliedParams, setAppliedParams] = useState({
    accountIds: [] as string[], dateFrom: '', dateTo: '', branchIds: [] as string[], search: '', page: 1, limit: 50,
  })

  const { data, isLoading } = useQuery<GeneralLedgerResponse>({
    queryKey: ['general-ledger', appliedParams, fetchKey],
    queryFn: async () => {
      const params: Record<string, string> = {
        account_ids: appliedParams.accountIds.join(','),
        date_from: appliedParams.dateFrom,
        date_to: appliedParams.dateTo,
        page: String(appliedParams.page),
        limit: String(appliedParams.limit),
      }
      if (appliedParams.branchIds.length > 0) params.branch_ids = appliedParams.branchIds.join(',')
      if (appliedParams.search) params.search = appliedParams.search
      const { data: res } = await api.get('/accounting/general-ledger', { params })
      return res.data as GeneralLedgerResponse
    },
    enabled: fetchKey > 0 && appliedParams.accountIds.length > 0,
  })

  const handleShow = useCallback(() => {
    if (accountIds.length === 0) return
    setPage(1)
    setAppliedParams({ accountIds, dateFrom, dateTo, branchIds, search: searchText, page: 1, limit })
    setFetchKey(k => k + 1)
  }, [accountIds, dateFrom, dateTo, branchIds, searchText, limit])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
    setAppliedParams(prev => ({ ...prev, page: newPage }))
    setFetchKey(k => k + 1)
  }, [])

  const toggleBranch = (id: string) => {
    setBranchIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleExport = () => {
    if (!data) return

    const grouped = groupLinesByAccount(data.lines, data.accounts, data.opening)
    const rows: Record<string, unknown>[] = []

    for (const group of grouped) {
      // Opening row
      rows.push({
        Akun: `${group.account.account_code} - ${group.account.account_name}`,
        Tanggal: '',
        'No. Jurnal': '',
        Keterangan: 'Saldo Awal',
        Referensi: '',
        Sumber: '',
        Debit: group.opening.opening_debit > 0 ? group.opening.opening_debit : '',
        Kredit: group.opening.opening_credit > 0 ? group.opening.opening_credit : '',
        Saldo: group.opening.opening_balance,
      })
      // Lines
      for (const l of group.lines) {
        rows.push({
          Akun: group.account.account_code,
          Tanggal: l.journal_date,
          'No. Jurnal': l.journal_number,
          Keterangan: l.line_description || l.journal_description || '',
          Referensi: l.reference_number || '',
          Sumber: SOURCE_LABELS[l.source_module || ''] || l.source_module || '',
          Debit: l.debit_amount || '',
          Kredit: l.credit_amount || '',
          Saldo: l.running_balance,
        })
      }
      // Empty separator row between accounts
      rows.push({})
    }

    const ws = XLSX.utils.json_to_sheet(rows)

    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length).slice(0, 50)) + 2,
    }))
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'General Ledger')
    XLSX.writeFile(wb, `general-ledger_${appliedParams.dateFrom}_${appliedParams.dateTo}.xlsx`)
  }

  // Group lines by account for display
  const groupedData = useMemo(() => {
    if (!data) return null
    return groupLinesByAccount(data.lines, data.accounts, data.opening)
  }, [data])

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">General Ledger</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Buku besar per akun — detail transaksi & saldo berjalan</p>
            </div>
          </div>
          {data && data.lines.length > 0 && (
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* Account Selector (multi) */}
          <div className="flex flex-col gap-1 min-w-[300px]">
            <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Akun (bisa pilih lebih dari 1)</label>
            <MultiAccountSelector
              value={accountIds}
              onChange={setAccountIds}
              placeholder="Pilih akun COA..."
            />
          </div>

          {/* Date Range */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Periode</label>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="h-8 px-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
              <span className="text-gray-400 text-xs">–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="h-8 px-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Search */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Cari</label>
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Keterangan, no jurnal, ref..."
              className="h-8 px-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 w-48"
              onKeyDown={e => e.key === 'Enter' && handleShow()}
            />
          </div>

          <div className="flex-1" />

          <button onClick={handleShow} disabled={isLoading || accountIds.length === 0}
            className="h-8 flex items-center gap-1.5 px-4 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Search className="w-3.5 h-3.5" />
            Tampilkan
          </button>
        </div>

        {/* Branch filter */}
        <div className="flex flex-wrap gap-1.5">
          {branches.map(b => (
            <button key={b.branch_id} onClick={() => toggleBranch(b.branch_id)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                branchIds.includes(b.branch_id)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}>
              {b.branch_name}
            </button>
          ))}
          {branchIds.length > 0 && (
            <span className="text-[10px] text-gray-400 self-center ml-1">({branchIds.length} dipilih)</span>
          )}
          {branchIds.length === 0 && branches.length > 0 && (
            <span className="text-[10px] text-gray-400 self-center ml-1 italic">Semua cabang</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {fetchKey === 0 || appliedParams.accountIds.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Pilih akun dan periode, lalu klik "Tampilkan"</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
          </div>
        ) : !data || data.lines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Tidak ada transaksi dalam periode ini</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Summary header */}
            <div className="shrink-0 px-4 sm:px-6 py-3 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {data.accounts.map(acc => (
                    <span key={acc.account_id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[11px]">
                      <span className="font-mono font-bold text-blue-700 dark:text-blue-300">{acc.account_code}</span>
                      <span className="text-gray-600 dark:text-gray-400">{acc.account_name}</span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs shrink-0">
                  <div className="text-right">
                    <div className="text-gray-500 dark:text-gray-400">Total Debit</div>
                    <div className="font-mono font-medium text-emerald-700 dark:text-emerald-400">{fmt(data.summary.total_debit)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500 dark:text-gray-400">Total Kredit</div>
                    <div className="font-mono font-medium text-red-600 dark:text-red-400">{fmt(data.summary.total_credit)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500 dark:text-gray-400">Saldo Akhir</div>
                    <div className="font-mono font-bold text-gray-900 dark:text-white">{fmt(data.summary.ending_balance)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {data.accounts.length > 1 && (
                      <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-20">Akun</th>
                    )}
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-20">Tanggal</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-28">No. Jurnal</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Keterangan</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-20">Ref</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-20">Sumber</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-28">Debit</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-28">Kredit</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-32">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedData && groupedData.map(group => (
                    <AccountGroup
                      key={group.account.account_id}
                      group={group}
                      showAccountColumn={data.accounts.length > 1}
                      isFirstPage={page === 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="shrink-0 px-4 sm:px-6 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Halaman {data.pagination.page} dari {data.pagination.totalPages} ({data.pagination.total} transaksi)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={!data.pagination.hasPrev}
                    className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={!data.pagination.hasNext}
                    className="p-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface AccountGroupData {
  account: AccountInfo
  opening: OpeningRow
  lines: LedgerLine[]
}

function groupLinesByAccount(
  lines: LedgerLine[],
  accounts: AccountInfo[],
  openings: OpeningRow[],
): AccountGroupData[] {
  return accounts.map(acc => ({
    account: acc,
    opening: openings.find(o => o.account_id === acc.account_id) || {
      account_id: acc.account_id, opening_debit: 0, opening_credit: 0, opening_balance: 0,
    },
    lines: lines.filter(l => l.account_id === acc.account_id),
  })).filter(g => g.lines.length > 0 || g.opening.opening_balance !== 0)
}

function AccountGroup({ group, showAccountColumn, isFirstPage }: {
  group: AccountGroupData
  showAccountColumn: boolean
  isFirstPage: boolean
}) {
  const colSpan = showAccountColumn ? 6 : 5
  // On page 2+, show the first line's running_balance minus its own net as "carried forward"
  const carriedForward = !isFirstPage && group.lines.length > 0
    ? group.lines[0].running_balance - group.lines[0].net_amount
    : null

  return (
    <>
      {/* Account section header (only for multi-account) */}
      {showAccountColumn && (
        <tr className="bg-indigo-50/50 dark:bg-indigo-900/10">
          <td colSpan={colSpan + 3} className="px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border-y border-indigo-100 dark:border-indigo-900/50">
            {group.account.account_code} — {group.account.account_name}
          </td>
        </tr>
      )}

      {/* Opening balance row (page 1) or carried forward (page 2+) */}
      {isFirstPage ? (
        <tr className="bg-amber-50/50 dark:bg-amber-900/10">
          {showAccountColumn && <td className="px-3 py-1.5" />}
          <td className="px-3 py-1.5" colSpan={4}>
            <span className="font-medium text-amber-700 dark:text-amber-400">Saldo Awal</span>
          </td>
          <td className="px-3 py-1.5 text-right font-mono text-amber-700 dark:text-amber-400">
            {group.opening.opening_debit > 0 ? fmt(group.opening.opening_debit) : '-'}
          </td>
          <td className="px-3 py-1.5 text-right font-mono text-amber-700 dark:text-amber-400">
            {group.opening.opening_credit > 0 ? fmt(group.opening.opening_credit) : '-'}
          </td>
          <td className="px-3 py-1.5 text-right font-mono font-medium text-amber-700 dark:text-amber-400">
            {fmt(group.opening.opening_balance)}
          </td>
        </tr>
      ) : carriedForward !== null && (
        <tr className="bg-amber-50/30 dark:bg-amber-900/5">
          {showAccountColumn && <td className="px-3 py-1.5" />}
          <td className="px-3 py-1.5" colSpan={4}>
            <span className="font-medium text-[10px] text-amber-600 dark:text-amber-400 italic">Saldo terbawa</span>
          </td>
          <td className="px-3 py-1.5" />
          <td className="px-3 py-1.5" />
          <td className="px-3 py-1.5 text-right font-mono font-medium text-amber-600 dark:text-amber-400 text-[10px]">
            {fmt(carriedForward)}
          </td>
        </tr>
      )}

      {/* Data rows */}
      {group.lines.map((line, idx) => (
        <tr key={line.line_id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'} hover:bg-blue-50/30 dark:hover:bg-blue-900/5`}>
          {showAccountColumn && (
            <td className="px-3 py-1.5 font-mono text-[10px] text-gray-400">{line.account_code}</td>
          )}
          <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(line.journal_date)}</td>
          <td className="px-3 py-1.5 font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">{line.journal_number}</td>
          <td className="px-3 py-1.5 text-gray-900 dark:text-white truncate max-w-xs" title={line.line_description || line.journal_description || ''}>
            {line.line_description || line.journal_description || '-'}
          </td>
          <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 font-mono text-[10px] whitespace-nowrap">{line.reference_number || '-'}</td>
          <td className="px-3 py-1.5 whitespace-nowrap">
            {line.source_module && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {SOURCE_LABELS[line.source_module] || line.source_module}
              </span>
            )}
          </td>
          <td className={`px-3 py-1.5 text-right font-mono ${line.debit_amount > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-300 dark:text-gray-600'}`}>
            {line.debit_amount > 0 ? fmt(line.debit_amount) : '-'}
          </td>
          <td className={`px-3 py-1.5 text-right font-mono ${line.credit_amount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-300 dark:text-gray-600'}`}>
            {line.credit_amount > 0 ? fmt(line.credit_amount) : '-'}
          </td>
          <td className="px-3 py-1.5 text-right font-mono font-medium text-gray-900 dark:text-white">
            {fmt(line.running_balance)}
          </td>
        </tr>
      ))}
    </>
  )
}
