import { useState, useMemo, useEffect, useCallback } from 'react'
import { Zap, Plus, Trash2, Tag, AlertCircle, CheckCircle2, Settings, Eye, Search, Filter, X, Pencil, Check } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import {
  useExpenseRules, useUncategorized, useExpensePurposes,
  useCreateRule, useUpdateRule, useDeleteRule,
  useAutoCategorize, useManualCategorize, useUncategorize, useGenerateJournal,
} from '../api/expense-categorization.api'
import type { AccountingPurposeOption, CategorizeResult, ExpenseAutoRule } from '../types/expense-categorization.types'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const MATCH_LABELS: Record<string, string> = { CONTAINS: 'Mengandung', STARTS_WITH: 'Diawali', EXACT: 'Persis', REGEX: 'Regex' }

const BADGE_PALETTES = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400' },
  { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
] as const

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function getPurposeBadge(purposeName: string | null) {
  if (!purposeName) return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400' }
  return BADGE_PALETTES[hashCode(purposeName) % BADGE_PALETTES.length]
}

export default function ExpenseCategorizationPage() {
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<'uncategorized' | 'rules'>('uncategorized')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [assignPurposeId, setAssignPurposeId] = useState('')
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)

  // Filters
  const [filterPurpose, setFilterPurpose] = useState('')
  const [filterCategorized, setFilterCategorized] = useState<'' | 'true' | 'false'>('')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Auto-categorize preview
  const [previewResult, setPreviewResult] = useState<CategorizeResult | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Rule form (create + edit)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [rulePattern, setRulePattern] = useState('')
  const [ruleMatchType, setRuleMatchType] = useState<string>('CONTAINS')
  const [rulePurposeId, setRulePurposeId] = useState('')
  const [rulePriority, setRulePriority] = useState(100)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [filterPurpose, filterCategorized])

  const queryParams = useMemo(() => ({
    page, limit: 50,
    ...(filterPurpose ? { purpose_id: filterPurpose } : {}),
    ...(filterCategorized ? { categorized: filterCategorized } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }), [page, filterPurpose, filterCategorized, debouncedSearch])

  const hasActiveFilters = !!filterPurpose || !!filterCategorized || !!debouncedSearch

  const rules = useExpenseRules()
  const purposes = useExpensePurposes()
  const uncategorized = useUncategorized(queryParams)

  const groupedPurposes = useMemo(() => {
    const groups = new Map<string, AccountingPurposeOption[]>()
    for (const p of purposes.data || []) {
      const key = p.applied_to || 'OTHER'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(p)
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [purposes.data])
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const deleteRule = useDeleteRule()
  const autoCategorize = useAutoCategorize()
  const manualCategorize = useManualCategorize()
  const uncategorizeMutation = useUncategorize()
  const generateJournal = useGenerateJournal()

  const clearFilters = () => { setFilterPurpose(''); setFilterCategorized(''); setSearchInput(''); setDebouncedSearch('') }

  const resetRuleForm = useCallback(() => {
    setShowRuleForm(false); setEditingRuleId(null)
    setRulePattern(''); setRuleMatchType('CONTAINS'); setRulePurposeId(''); setRulePriority(100)
  }, [])

  const startEditRule = useCallback((r: ExpenseAutoRule) => {
    setEditingRuleId(r.id)
    setRulePattern(r.pattern); setRuleMatchType(r.match_type)
    setRulePurposeId(r.purpose_id); setRulePriority(r.priority)
  }, [])

  const handleSaveRule = async () => {
    if (!rulePattern.trim() || !rulePurposeId) { toast.warning('Pattern dan purpose wajib diisi'); return }
    try {
      if (editingRuleId) {
        await updateRule.mutateAsync({ id: editingRuleId, purpose_id: rulePurposeId, pattern: rulePattern.trim(), match_type: ruleMatchType, priority: rulePriority })
        toast.success('Rule berhasil diupdate')
      } else {
        await createRule.mutateAsync({ purpose_id: rulePurposeId, pattern: rulePattern.trim(), match_type: ruleMatchType, priority: rulePriority })
        toast.success('Rule berhasil dibuat')
      }
      resetRuleForm()
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menyimpan rule')) }
  }

  const handleDeleteRule = async () => {
    if (!deleteRuleId) return
    try { await deleteRule.mutateAsync(deleteRuleId); toast.success('Rule berhasil dihapus') }
    catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus rule')) }
    finally { setDeleteRuleId(null) }
  }

  const handleAutoPreview = async () => {
    try {
      const result = await autoCategorize.mutateAsync({ dry_run: true })
      setPreviewResult(result); setShowPreview(true)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal preview')) }
  }

  const handleAutoConfirm = async () => {
    try {
      const result = await autoCategorize.mutateAsync({ dry_run: false })
      toast.success(`${result.categorized} transaksi berhasil dikategorikan`)
      setShowPreview(false); setPreviewResult(null); setSelectedIds(new Set())
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal auto-categorize')) }
  }

  const handleManualCategorize = async () => {
    if (selectedIds.size === 0 || !assignPurposeId) { toast.warning('Pilih transaksi dan kategori'); return }
    try {
      const result = await manualCategorize.mutateAsync({ statement_ids: [...selectedIds], purpose_id: assignPurposeId })
      toast.success(`${result.count} transaksi dikategorikan`)
      setSelectedIds(new Set()); setAssignPurposeId('')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal mengkategorikan')) }
  }

  const handleUncategorize = async () => {
    if (selectedIds.size === 0) return
    try {
      const result = await uncategorizeMutation.mutateAsync({ statement_ids: [...selectedIds] })
      toast.success(`${result.count} transaksi di-uncategorize`)
      setSelectedIds(new Set())
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal uncategorize')) }
  }

  const handleGenerateJournal = async () => {
    if (selectedIds.size === 0) return
    const eligible = stmts.filter(s => selectedIds.has(Number(s.id)) && s.purpose_id)
    if (eligible.length === 0) { toast.warning('Pilih transaksi yang sudah dikategorikan'); return }
    try {
      const result = await generateJournal.mutateAsync({ statement_ids: eligible.map(s => Number(s.id)) })
      toast.success(`Journal ${result.journal_number} dibuat — ${result.lines_count} lines, ${fmt(result.total_amount)}`)
      setSelectedIds(new Set())
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal generate journal')) }
  }

  const toggleSelect = (id: number) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => {
    const ids = stmts.map(s => Number(s.id))
    setSelectedIds(ids.every(id => selectedIds.has(id)) ? new Set() : new Set(ids))
  }

  const stmts = uncategorized.data?.data || []
  const pagination = uncategorized.data?.pagination

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-violet-600 rounded-xl"><Tag className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Expense Categorization</h1>
          <p className="text-xs text-gray-400">Kategorikan pengeluaran bank untuk laporan keuangan</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setActiveTab('uncategorized')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'uncategorized' ? 'text-violet-600 border-violet-600' : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900'}`}>
          <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Transaksi Debit {pagination?.total ? `(${pagination.total})` : ''}</div>
        </button>
        <button onClick={() => setActiveTab('rules')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'rules' ? 'text-violet-600 border-violet-600' : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900'}`}>
          <div className="flex items-center gap-2"><Settings className="w-4 h-4" /> Auto Rules ({rules.data?.length || 0})</div>
        </button>
      </div>

      {/* ── Tab: Transaksi Debit ── */}
      {activeTab === 'uncategorized' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500"><Filter className="w-3.5 h-3.5" /> Filter</div>
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Cari deskripsi..."
                  className="w-full h-9 pl-8 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-violet-500 outline-none" />
              </div>
              <select value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)}
                className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[180px]">
                <option value="">Semua Kategori</option>
                {groupedPurposes.map(([group, items]) => (<optgroup key={group} label={group}>{items.map(p => (<option key={p.id} value={p.id}>{p.purpose_code} — {p.purpose_name}</option>))}</optgroup>))}
              </select>
              <select value={filterCategorized} onChange={e => setFilterCategorized(e.target.value as '' | 'true' | 'false')}
                className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Semua Status</option>
                <option value="true">Sudah Dikategorikan</option>
                <option value="false">Belum Dikategorikan</option>
              </select>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 h-9 px-3 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <X className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <button onClick={handleAutoPreview} disabled={autoCategorize.isPending || (rules.data?.length || 0) === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-40">
              <Zap className={`w-3.5 h-3.5 ${autoCategorize.isPending ? 'animate-spin' : ''}`} /> Auto Categorize
            </button>
            {selectedIds.size > 0 && (
              <>
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-500">{selectedIds.size} dipilih</span>
                <select value={assignPurposeId} onChange={e => setAssignPurposeId(e.target.value)}
                  className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[200px]">
                  <option value="">Pilih kategori...</option>
                  {groupedPurposes.map(([group, items]) => (<optgroup key={group} label={group}>{items.map(p => (<option key={p.id} value={p.id}>{p.purpose_code} — {p.purpose_name}</option>))}</optgroup>))}
                </select>
                <button onClick={handleManualCategorize} disabled={!assignPurposeId || manualCategorize.isPending}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40">Assign</button>
                <button onClick={handleUncategorize} disabled={uncategorizeMutation.isPending}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Clear</button>
                <button onClick={handleGenerateJournal} disabled={generateJournal.isPending}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
                  {generateJournal.isPending ? 'Generating...' : '📝 Generate Journal'}
                </button>
              </>
            )}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-3 py-2.5 w-10">
                      <input type="checkbox" checked={stmts.length > 0 && stmts.every(s => selectedIds.has(Number(s.id)))} onChange={toggleAll}
                        className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-violet-600" />
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {uncategorized.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={5} className="px-3 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td></tr>
                    ))
                  ) : stmts.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-12 text-center text-gray-400">
                      {hasActiveFilters
                        ? <><Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />Tidak ada transaksi yang cocok dengan filter</>
                        : <><CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />Tidak ada transaksi debit yang belum dijurnal</>}
                    </td></tr>
                  ) : stmts.map(s => {
                    const badge = getPurposeBadge(s.purpose_name)
                    return (
                      <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selectedIds.has(Number(s.id)) ? 'bg-violet-50/50 dark:bg-violet-900/10' : ''}`}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={selectedIds.has(Number(s.id))} onChange={() => toggleSelect(Number(s.id))}
                            className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-violet-600" />
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(s.transaction_date)}</td>
                        <td className="px-3 py-2.5 text-gray-900 dark:text-white max-w-xs " title={s.description}>{s.description}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-900 dark:text-white">{fmt(s.debit_amount)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                            {s.purpose_name || 'Belum dikategorikan'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {pagination && pagination.totalPages > 1 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <Pagination
                  pagination={{ page: pagination.page, limit: pagination.limit, total: pagination.total, totalPages: pagination.totalPages, hasNext: pagination.hasNext, hasPrev: pagination.hasPrev }}
                  onPageChange={setPage} currentLength={stmts.length}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Rules ── */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{rules.data?.length || 0} rules</p>
            <button onClick={() => { resetRuleForm(); setShowRuleForm(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
              <Plus className="w-3.5 h-3.5" /> Tambah Rule
            </button>
          </div>

          {/* Create / Edit form */}
          {showRuleForm && (
            <div className={`bg-white dark:bg-gray-800 border rounded-xl p-4 space-y-3 ${editingRuleId ? 'border-blue-300 dark:border-blue-700' : 'border-violet-200 dark:border-violet-800'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase">{editingRuleId ? '✏️ Edit Rule' : '➕ Rule Baru'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input value={rulePattern} onChange={e => setRulePattern(e.target.value)} placeholder="Pattern (misal: BIAYA TXN)"
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <select value={ruleMatchType} onChange={e => setRuleMatchType(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  {Object.entries(MATCH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={rulePurposeId} onChange={e => setRulePurposeId(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">Pilih purpose...</option>
                  {groupedPurposes.map(([group, items]) => (<optgroup key={group} label={group}>{items.map(p => (<option key={p.id} value={p.id}>{p.purpose_code} — {p.purpose_name}</option>))}</optgroup>))}
                </select>
                <input type="number" value={rulePriority} onChange={e => setRulePriority(Number(e.target.value))} min={1} max={9999}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Priority" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveRule} disabled={createRule.isPending || updateRule.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
                  <Check className="w-3.5 h-3.5" />
                  {createRule.isPending || updateRule.isPending ? 'Menyimpan...' : editingRuleId ? 'Update' : 'Simpan'}
                </button>
                <button onClick={resetRuleForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-sm">Batal</button>
              </div>
            </div>
          )}

          {/* Rules table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Pattern</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {rules.isLoading ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Memuat...</td></tr>
                ) : (rules.data || []).length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Belum ada rules. Tambahkan rule untuk auto-categorize.</td></tr>
                ) : (rules.data || []).map(r => {
                  const badge = getPurposeBadge(r.purpose_name || null)
                  const isEditing = editingRuleId === r.id
                  if (isEditing) {
                    return (
                      <tr key={r.id} className="bg-blue-50/50 dark:bg-blue-900/10">
                        <td className="px-2 py-1.5">
                          <input value={rulePattern} onChange={e => setRulePattern(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm font-mono border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={ruleMatchType} onChange={e => setRuleMatchType(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            {Object.entries(MATCH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={rulePurposeId} onChange={e => setRulePurposeId(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            <option value="">Pilih...</option>
                            {groupedPurposes.map(([group, items]) => (<optgroup key={group} label={group}>{items.map(p => (<option key={p.id} value={p.id}>{p.purpose_code} — {p.purpose_name}</option>))}</optgroup>))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" value={rulePriority} onChange={e => setRulePriority(Number(e.target.value))} min={1} max={9999}
                            className="w-full px-2 py-1.5 text-sm text-center border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                            {r.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={handleSaveRule} disabled={updateRule.isPending}
                              className="p-1 text-emerald-600 hover:text-emerald-700 rounded" title="Simpan">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={resetRuleForm} className="p-1 text-gray-400 hover:text-gray-600 rounded" title="Batal">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2.5 font-mono text-gray-900 dark:text-white">{r.pattern}</td>
                      <td className="px-3 py-2.5 text-gray-500">{MATCH_LABELS[r.match_type] || r.match_type}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {r.purpose_code} — {r.purpose_name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{r.priority}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => updateRule.mutate({ id: r.id, is_active: !r.is_active })}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                          {r.is_active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEditRule(r)} className="p-1 text-gray-400 hover:text-blue-500 rounded" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteRuleId(r.id)} className="p-1 text-gray-400 hover:text-red-500 rounded" title="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Rule Confirm */}
      <ConfirmModal
        isOpen={!!deleteRuleId}
        onClose={() => setDeleteRuleId(null)}
        onConfirm={handleDeleteRule}
        title="Hapus Rule"
        message="Hapus auto-categorize rule ini?"
        confirmText="Hapus"
        variant="danger"
      />

      {/* Auto-categorize Preview Modal */}
      {showPreview && previewResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPreview(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-violet-600" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Preview Auto-Categorize</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{previewResult.categorized}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Akan dikategorikan</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-500">{previewResult.skipped}</p>
                <p className="text-xs text-gray-400">Tidak cocok</p>
              </div>
            </div>
            {previewResult.details.length > 0 && (
              <div className="mb-4 max-h-48 overflow-y-auto">
                <p className="text-xs font-medium text-gray-500 mb-2">Breakdown:</p>
                {Object.entries(
                  previewResult.details.reduce((acc, d) => { acc[d.purpose_name] = (acc[d.purpose_name] || 0) + 1; return acc }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
                  const badge = getPurposeBadge(name)
                  return (
                    <div key={name} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{name}</span>
                      <span className="font-medium text-sm text-gray-900 dark:text-white">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPreview(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Batal</button>
              <button onClick={handleAutoConfirm} disabled={autoCategorize.isPending || previewResult.categorized === 0}
                className="px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50">
                {autoCategorize.isPending ? 'Memproses...' : `Kategorikan ${previewResult.categorized} Transaksi`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
