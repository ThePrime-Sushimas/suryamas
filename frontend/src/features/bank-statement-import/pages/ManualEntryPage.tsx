import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { bankStatementImportApi } from '../api/bank-statement-import.api'
import { bankAccountsApi } from '../../bank-accounts/api/bankAccounts.api'
import { useBranchContextStore } from '../../branch_context'
import { formatCurrency } from '../utils/format'

interface DbEntry {
  id: number
  transaction_date: string
  description: string
  debit_amount: number
  credit_amount: number
  reference_number?: string
  balance?: number
  is_reconciled: boolean
}

interface DraftRow {
  _key: string
  transaction_date: string
  description: string
  debit_amount: string
  credit_amount: string
  reference_number: string
  balance: string
}

interface MonthGroup {
  month: string
  entries: DbEntry[]
  suggestions: Suggestion[]
}

interface Suggestion {
  transaction_date: string
  description: string
  credit_amount: number
  debit_amount: number
  payment_method_id: number
}

interface BankAccount {
  id: number
  account_name: string
  account_number: string
  bank_name?: string
}

const uid = () => Math.random().toString(36).slice(2, 10)

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatMonth(ym: string) {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}

function currentYM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function emptyDraft(month: string): DraftRow {
  const lastDay = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate()
  const today = new Date()
  const ym = month.split('-')
  const isCurrent = today.getFullYear() === parseInt(ym[0]) && today.getMonth() + 1 === parseInt(ym[1])
  const day = isCurrent ? today.getDate() : lastDay
  return {
    _key: uid(),
    transaction_date: `${month}-${String(day).padStart(2, '0')}`,
    description: '',
    debit_amount: '',
    credit_amount: '',
    reference_number: '',
    balance: '',
  }
}

export function ManualEntryPanel() {
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  const companyId = currentBranch?.company_id

  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [months, setMonths] = useState<MonthGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftRow[]>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const globalToast = useToast()

  useEffect(() => {
    if (!companyId) return
    setLoadingAccounts(true)
    bankAccountsApi.getByOwner('company', companyId)
      .then(accs => setBankAccounts(accs || []))
      .catch(() => setBankAccounts([]))
      .finally(() => setLoadingAccounts(false))
  }, [companyId])

  const fetchEntries = useCallback(async (baId: string) => {
    if (!baId) { setMonths([]); return undefined }
    setLoading(true)
    try {
      const data = await bankStatementImportApi.listManualEntries(Number(baId))
      setMonths(data)

      setDrafts(prev => {
        const next = { ...prev }
        for (const group of data) {
          if (group.suggestions.length > 0) {
            const existing = prev[group.month] || []
            const existingDescs = new Set(existing.map(d => d.description))
            const fresh = group.suggestions
              .filter(s => !existingDescs.has(s.description))
              .map(s => ({
                _key: uid(),
                transaction_date: s.transaction_date,
                description: s.description,
                debit_amount: s.debit_amount ? String(s.debit_amount) : '',
                credit_amount: s.credit_amount ? String(s.credit_amount) : '',
                reference_number: '',
                balance: '',
              }))
            if (fresh.length > 0) {
              next[group.month] = [...existing, ...fresh]
            }
          }
        }
        return next
      })

      return data
    } catch {
      setMonths([])
      return undefined
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (bankAccountId) {
      fetchEntries(bankAccountId).then(data => {
        if (data && data.length > 0) setExpanded(prev => prev ?? data[0].month)
      })
    }
  }, [bankAccountId, fetchEntries])

  const toggleMonth = (m: string) => {
    setExpanded(prev => prev === m ? null : m)
    setSelected(new Set())
  }

  const addNewMonth = () => {
    const ym = currentYM()
    if (!months.find(g => g.month === ym)) {
      setMonths(prev => [{ month: ym, entries: [], suggestions: [] }, ...prev])
    }
    setExpanded(ym)
    setDrafts(prev => {
      const existing = prev[ym] || []
      return existing.length > 0 ? prev : { ...prev, [ym]: [emptyDraft(ym)] }
    })
  }

  const addDraft = (month: string) => {
    setDrafts(prev => ({ ...prev, [month]: [...(prev[month] || []), emptyDraft(month)] }))
  }

  const updateDraft = (month: string, key: string, field: keyof DraftRow, value: string) => {
    setDrafts(prev => ({
      ...prev,
      [month]: (prev[month] || []).map(r => r._key === key ? { ...r, [field]: value } : r),
    }))
  }

  const removeDraft = (month: string, key: string) => {
    setDrafts(prev => ({
      ...prev,
      [month]: (prev[month] || []).filter(r => r._key !== key),
    }))
    setSelected(prev => { const n = new Set(prev); n.delete(`draft:${key}`); return n })
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const getMonthDrafts = (month: string) => drafts[month] || []

  const getValidDrafts = (month: string) => getMonthDrafts(month).filter(r => {
    const d = parseFloat(r.debit_amount) || 0
    const c = parseFloat(r.credit_amount) || 0
    return r.transaction_date && r.description.trim() && (d > 0 || c > 0)
  })

  const handleSave = async (month: string) => {
    const valid = getValidDrafts(month)
    if (!bankAccountId || valid.length === 0) return
    setSaving(true)
    try {
      const entries = valid.map(r => ({
        transaction_date: r.transaction_date,
        description: r.description.trim(),
        debit_amount: parseFloat(r.debit_amount) || 0,
        credit_amount: parseFloat(r.credit_amount) || 0,
        reference_number: r.reference_number.trim() || undefined,
        balance: r.balance ? parseFloat(r.balance) : undefined,
      }))

      if (entries.length === 1) {
        await bankStatementImportApi.manualEntry({ bank_account_id: Number(bankAccountId), ...entries[0] })
      } else {
        await bankStatementImportApi.manualBulkEntry({ bank_account_id: Number(bankAccountId), entries })
      }

      globalToast.success(`${entries.length} entry disimpan`)
      setDrafts(prev => ({ ...prev, [month]: [] }))
      await fetchEntries(bankAccountId)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      globalToast.error(axiosErr?.response?.data?.error || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSaved = async (ids: number[]) => {
    if (ids.length === 0) return
    setDeleting(true)
    try {
      if (ids.length === 1) {
        await bankStatementImportApi.hardDeleteStatement(ids[0])
      } else {
        await bankStatementImportApi.hardDeleteBulkStatements(ids)
      }
      globalToast.success(`${ids.length} entry dihapus`)
      setSelected(new Set())
      const data = await fetchEntries(bankAccountId)
      if (data && expanded && !data.find(g => g.month === expanded)) {
        setExpanded(data.length > 0 ? data[0].month : null)
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      globalToast.error(axiosErr?.response?.data?.error || 'Gagal menghapus')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteSelected = async (month: string) => {
    const savedIds: number[] = []
    const draftKeys: string[] = []
    for (const sel of selected) {
      if (sel.startsWith('db:')) savedIds.push(Number(sel.slice(3)))
      else if (sel.startsWith('draft:')) draftKeys.push(sel.slice(6))
    }
    draftKeys.forEach(k => removeDraft(month, k))
    if (savedIds.length > 0) await handleDeleteSaved(savedIds)
    setSelected(new Set())
  }

  const selectedSavedCount = Array.from(selected).filter(s => s.startsWith('db:')).length

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <select
          value={bankAccountId}
          onChange={e => { setBankAccountId(e.target.value); setExpanded(null); setDrafts({}); setSelected(new Set()) }}
          disabled={loadingAccounts}
          className="h-[34px] px-3 text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-60"
        >
          <option value="">Pilih akun bank</option>
          {bankAccounts.map(a => (
            <option key={a.id} value={String(a.id)}>
              {a.account_name} — {a.account_number}{a.bank_name ? ` (${a.bank_name})` : ''}
            </option>
          ))}
        </select>
        {bankAccountId && (
          <button
            onClick={addNewMonth}
            className="inline-flex items-center gap-1.5 h-[34px] px-3 text-[13px] font-medium border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Bulan ini
          </button>
        )}
      </div>

      {!bankAccountId && (
        <div className="py-16 text-center text-[13px] text-gray-400 dark:text-gray-500">
          Pilih akun bank untuk melihat manual entries
        </div>
      )}

      {bankAccountId && loading && (
        <div className="py-16 text-center text-[13px] text-gray-400 dark:text-gray-500">Memuat...</div>
      )}

      {bankAccountId && !loading && months.length === 0 && Object.keys(drafts).length === 0 && (
        <div className="py-16 text-center">
          <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-3">Belum ada manual entry</p>
          <button
            onClick={addNewMonth}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Mulai input bulan ini
          </button>
        </div>
      )}

      {bankAccountId && !loading && (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {months.map(group => {
            const isOpen = expanded === group.month
            const monthDrafts = getMonthDrafts(group.month)
            const validDrafts = getValidDrafts(group.month)
            const totalDebit = group.entries.reduce((s, e) => s + (e.debit_amount || 0), 0)
              + monthDrafts.reduce((s, r) => s + (parseFloat(r.debit_amount) || 0), 0)
            const totalCredit = group.entries.reduce((s, e) => s + (e.credit_amount || 0), 0)
              + monthDrafts.reduce((s, r) => s + (parseFloat(r.credit_amount) || 0), 0)
            const totalCount = group.entries.length + monthDrafts.length

            return (
              <div key={group.month}>
                <button
                  onClick={() => toggleMonth(group.month)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? 'rotate-90' : ''} text-gray-400`}><polyline points="9 18 15 12 9 6"/></svg>
                    <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{formatMonth(group.month)}</span>
                    <span className="text-[12px] text-gray-400 dark:text-gray-500">{totalCount} transaksi</span>
                  </div>
                  <div className="flex items-center gap-4 text-[12px]">
                    {totalDebit > 0 && <span style={{ color: '#A32D2D' }}>{formatCurrency(totalDebit)}</span>}
                    {totalCredit > 0 && <span style={{ color: '#0F6E56' }}>{formatCurrency(totalCredit)}</span>}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-gray-800 overflow-x-auto">
                    {selected.size > 0 && (
                      <div className="flex items-center justify-between px-4 py-1.5 bg-blue-50/50 dark:bg-blue-900/10 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-[12px] text-blue-700 dark:text-blue-300">{selected.size} dipilih</span>
                        <button
                          onClick={() => handleDeleteSelected(group.month)}
                          disabled={deleting}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-red-600 dark:text-red-400 hover:text-red-700 disabled:opacity-40"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          {deleting ? 'Menghapus...' : `Hapus${selectedSavedCount > 0 ? ' permanen' : ''}`}
                        </button>
                      </div>
                    )}

                    <table className="w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                      <colgroup>
                        <col style={{ width: 36 }} />
                        <col style={{ width: 120 }} />
                        <col />
                        <col style={{ width: 130 }} />
                        <col style={{ width: 130 }} />
                        <col style={{ width: 110 }} />
                        <col style={{ width: 36 }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/60">
                          <th className="px-2 py-1.5" />
                          <th className="px-2 py-1.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500">Tanggal</th>
                          <th className="px-2 py-1.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500">Deskripsi</th>
                          <th className="px-2 py-1.5 text-right text-[11px] font-medium text-gray-400 dark:text-gray-500">Debit</th>
                          <th className="px-2 py-1.5 text-right text-[11px] font-medium text-gray-400 dark:text-gray-500">Credit</th>
                          <th className="px-2 py-1.5 text-left text-[11px] font-medium text-gray-400 dark:text-gray-500">Ref</th>
                          <th className="px-2 py-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {group.entries.map(e => {
                          const selKey = `db:${e.id}`
                          return (
                            <tr key={e.id} className={`group border-b border-gray-50 dark:border-gray-800/50 ${selected.has(selKey) ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                              <td className="px-2 py-0.5 text-center">
                                <input type="checkbox" checked={selected.has(selKey)} onChange={() => toggleSelect(selKey)} className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                              </td>
                              <td className="px-2 py-0.5 text-[13px] text-gray-900 dark:text-gray-100">{e.transaction_date?.split('T')[0]}</td>
                              <td className="px-2 py-0.5 text-[13px] text-gray-900 dark:text-gray-100 truncate">{e.description}</td>
                              <td className="px-2 py-0.5 text-[13px] text-right text-gray-900 dark:text-gray-100">{e.debit_amount ? formatCurrency(e.debit_amount) : '-'}</td>
                              <td className="px-2 py-0.5 text-[13px] text-right text-gray-900 dark:text-gray-100">{e.credit_amount ? formatCurrency(e.credit_amount) : '-'}</td>
                              <td className="px-2 py-0.5 text-[13px] text-gray-500 dark:text-gray-400 truncate">{e.reference_number || '-'}</td>
                              <td className="px-1 py-0.5 text-center">
                                {e.is_reconciled ? (
                                  <span title="Sudah ter-reconcile" className="inline-block w-3.5 h-3.5">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><polyline points="9 12 11.5 14.5 15.5 9.5"/></svg>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleDeleteSaved([e.id])}
                                    disabled={deleting}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-all rounded disabled:opacity-40"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}

                        {monthDrafts.map(r => {
                          const selKey = `draft:${r._key}`
                          return (
                            <tr key={r._key} className={`group border-b border-gray-50 dark:border-gray-800/50 bg-amber-50/20 dark:bg-amber-900/5 ${selected.has(selKey) ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                              <td className="px-2 py-0.5 text-center">
                                <input type="checkbox" checked={selected.has(selKey)} onChange={() => toggleSelect(selKey)} className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                              </td>
                              <td className="px-1 py-0.5">
                                <input type="date" value={r.transaction_date} onChange={e => updateDraft(group.month, r._key, 'transaction_date', e.target.value)} className="w-full h-8 px-1.5 text-[13px] bg-transparent border-none outline-none focus:bg-blue-50/50 dark:focus:bg-blue-900/20 rounded text-gray-900 dark:text-gray-100" />
                              </td>
                              <td className="px-1 py-0.5">
                                <input type="text" value={r.description} onChange={e => updateDraft(group.month, r._key, 'description', e.target.value)} placeholder="Keterangan" className="w-full h-8 px-1.5 text-[13px] bg-transparent border-none outline-none focus:bg-blue-50/50 dark:focus:bg-blue-900/20 rounded text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600" />
                              </td>
                              <td className="px-1 py-0.5">
                                <input type="number" value={r.debit_amount} onChange={e => updateDraft(group.month, r._key, 'debit_amount', e.target.value)} placeholder="0" min="0" step="any" className="w-full h-8 px-1.5 text-[13px] text-right bg-transparent border-none outline-none focus:bg-blue-50/50 dark:focus:bg-blue-900/20 rounded text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              </td>
                              <td className="px-1 py-0.5">
                                <input type="number" value={r.credit_amount} onChange={e => updateDraft(group.month, r._key, 'credit_amount', e.target.value)} placeholder="0" min="0" step="any" className="w-full h-8 px-1.5 text-[13px] text-right bg-transparent border-none outline-none focus:bg-blue-50/50 dark:focus:bg-blue-900/20 rounded text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              </td>
                              <td className="px-1 py-0.5">
                                <input type="text" value={r.reference_number} onChange={e => updateDraft(group.month, r._key, 'reference_number', e.target.value)} placeholder="Ref" className="w-full h-8 px-1.5 text-[13px] bg-transparent border-none outline-none focus:bg-blue-50/50 dark:focus:bg-blue-900/20 rounded text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600" />
                              </td>
                              <td className="px-1 py-0.5 text-center">
                                <button onClick={() => removeDraft(group.month, r._key)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-all rounded">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-100 dark:border-gray-800">
                      <button onClick={() => addDraft(group.month)} className="text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        + Tambah baris
                      </button>
                      {validDrafts.length > 0 && (
                        <button
                          onClick={() => handleSave(group.month)}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 h-[30px] px-3 text-[12px] font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-40"
                        >
                          {saving && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"/></svg>}
                          Simpan ({validDrafts.length})
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
