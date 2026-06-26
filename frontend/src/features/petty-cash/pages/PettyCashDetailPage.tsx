import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, X, Trash2, FileText } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useCompanyBankAccounts } from '@/features/ap-payments/hooks/useCompanyBankAccounts'
import { useCategories, useSubCategories } from '@/features/categories/api/categories.api'
import {
  usePettyCashRequest,
  useApprovePettyCashRequest,
  useRejectPettyCashRequest,
  useCreateExpense,
  useDeleteExpense,
  useVoidSettlement,
} from '../api/pettyCash.api'
import { PettyCashStatusBadge } from '../components/PettyCashStatusBadge'
import type { PettyCashExpense } from '../types/pettyCash.types'
import { ProductSearchInput } from '@/features/daily-prep-orders2/components/ProductSearchInput'
import { useWarehouses } from '@/features/inventory/api/inventory.api'

const fmtCurrency = (v: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export default function PettyCashDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canApprove = hasPermission('petty_cash', 'approve')
  const canInsert = hasPermission('petty_cash', 'insert')
  const canRelease = hasPermission('petty_cash', 'release')

  const { data: request, isLoading } = usePettyCashRequest(id ?? '')
  const { data: bankAccounts = [] } = useCompanyBankAccounts()

  // Modals
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showVoid, setShowVoid] = useState(false)
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)

  // Approve form
  const [approveForm, setApproveForm] = useState({ source_bank_account_id: '', amount_disbursed: '', notes: '' })
  const approveMutation = useApprovePettyCashRequest()

  // Reject form
  const [rejectReason, setRejectReason] = useState('')
  const rejectMutation = useRejectPettyCashRequest()

  // Expense form
  const [expenseForm, setExpenseForm] = useState({
    category_id: '', sub_category_id: '', expense_date: new Date().toISOString().slice(0, 10),
    amount: '', description: '', product_id: '', warehouse_id: '', qty: '', unit_price: '',
  })
  const createExpenseMutation = useCreateExpense()
  const deleteExpenseMutation = useDeleteExpense()
  const { data: categoriesData } = useCategories({ limit: 200 })
  const { data: subCategoriesData } = useSubCategories({ category_id: expenseForm.category_id, limit: 100 })
  const categories = categoriesData?.data ?? []
  const subCategories = subCategoriesData?.data ?? []
  const selectedCategory = categories.find((c) => c.id === expenseForm.category_id)
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; product_name: string } | null>(null)
  const { data: warehousesData } = useWarehouses({ limit: 100 })
  const warehouses = warehousesData?.data ?? []

  // Void form
  const [voidReason, setVoidReason] = useState('')
  const voidMutation = useVoidSettlement()

  const handleApprove = async () => {
    if (!id || !approveForm.source_bank_account_id || !approveForm.amount_disbursed) return
    try {
      await approveMutation.mutateAsync({
        id,
        source_bank_account_id: Number(approveForm.source_bank_account_id),
        amount_disbursed: Number(approveForm.amount_disbursed),
        notes: approveForm.notes || undefined,
      })
      toast.success('Request disetujui & dicairkan')
      setShowApprove(false)
    } catch (err) { toast.error(parseApiError(err, 'Gagal approve')) }
  }

  const handleReject = async () => {
    if (!id || !rejectReason.trim()) return
    try {
      await rejectMutation.mutateAsync({ id, rejection_reason: rejectReason.trim() })
      toast.success('Request ditolak')
      setShowReject(false)
    } catch (err) { toast.error(parseApiError(err, 'Gagal reject')) }
  }

  const handleCreateExpense = async () => {
    if (!id || !expenseForm.category_id || !expenseForm.amount) return
    try {
      await createExpenseMutation.mutateAsync({
        requestId: id,
        category_id: expenseForm.category_id,
        sub_category_id: expenseForm.sub_category_id || undefined,
        expense_date: expenseForm.expense_date || undefined,
        amount: Number(expenseForm.amount),
        description: expenseForm.description || undefined,
        product_id: expenseForm.product_id || undefined,
        warehouse_id: expenseForm.warehouse_id || undefined,
        qty: expenseForm.qty ? Number(expenseForm.qty) : undefined,
        unit_price: expenseForm.unit_price ? Number(expenseForm.unit_price) : undefined,
      })
      toast.success('Expense ditambahkan')
      setShowExpenseForm(false)
      setExpenseForm({ category_id: '', sub_category_id: '', expense_date: new Date().toISOString().slice(0, 10), amount: '', description: '', product_id: '', warehouse_id: '', qty: '', unit_price: '' })
      setSelectedProduct(null)
    } catch (err) { toast.error(parseApiError(err, 'Gagal menambah expense')) }
  }

  const handleDeleteExpense = async () => {
    if (!deleteExpenseId || !id) return
    try {
      await deleteExpenseMutation.mutateAsync({ id: deleteExpenseId, requestId: id })
      setDeleteExpenseId(null)
    } catch (err) { toast.error(parseApiError(err, 'Gagal hapus expense')) }
  }

  const handleVoid = async () => {
    if (!request?.settlement_id || !id || !voidReason.trim()) return
    try {
      await voidMutation.mutateAsync({ id: request.settlement_id, requestId: id, reason: voidReason.trim() })
      toast.success('Settlement di-void')
      setShowVoid(false)
    } catch (err) { toast.error(parseApiError(err, 'Gagal void settlement')) }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  if (!request) return <div className="text-center py-12 text-gray-500">Request tidak ditemukan</div>

  const remaining = request.total_disbursed - request.total_expenses
  const expenses: PettyCashExpense[] = request.expenses ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back + Header */}
      <button onClick={() => navigate('/finance/petty-cash')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      {/* Request Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{request.request_number}</h2>
            <p className="text-sm text-gray-500">{request.branch_name} · {request.petty_cash_coa_name}</p>
          </div>
          <PettyCashStatusBadge status={request.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Diajukan</span><p className="font-medium">{fmtCurrency(request.amount_requested)}</p></div>
          <div><span className="text-gray-500">Dicairkan</span><p className="font-medium">{fmtCurrency(request.amount_disbursed)}</p></div>
          <div><span className="text-gray-500">Total Expense</span><p className="font-medium">{fmtCurrency(request.total_expenses)}</p></div>
          <div><span className="text-gray-500">Saldo Tersisa</span><p className="font-semibold text-blue-600">{fmtCurrency(remaining > 0 ? remaining : 0)}</p></div>
        </div>

        {request.carried_amount > 0 && (
          <p className="text-xs text-gray-500">Termasuk carry: {fmtCurrency(request.carried_amount)}</p>
        )}
        {request.rejection_reason && (
          <p className="text-sm text-red-600 dark:text-red-400">Alasan tolak: {request.rejection_reason}</p>
        )}
        {request.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{request.description}</p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          {request.status === 'PENDING' && canApprove && (
            <>
              <button onClick={() => { setApproveForm(f => ({ ...f, amount_disbursed: String(request.amount_requested) })); setShowApprove(true) }} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">Approve</button>
              <button onClick={() => setShowReject(true)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">Reject</button>
            </>
          )}
          {request.status === 'DISBURSED' && canInsert && (
            <>
              <button onClick={() => setShowExpenseForm(true)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"><Plus className="w-4 h-4" /> Tambah Expense</button>
              <button onClick={() => navigate(`/finance/petty-cash/${id}/settlement`)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"><FileText className="w-4 h-4" /> Buat Settlement</button>
            </>
          )}
          {request.status === 'CLOSED' && canRelease && request.settlement_id && (
            <button onClick={() => setShowVoid(true)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">Void Settlement</button>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white">Pengeluaran ({expenses.length})</h3>
        </div>
        {expenses.length === 0 ? (
          <div className="p-5 text-center text-sm text-gray-500">Belum ada expense</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Tgl</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Kategori</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Jumlah</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Keterangan</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Inv?</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Produk</th>
                  {request.status === 'DISBURSED' && <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50 dark:border-gray-700/50">
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{fmtDate(e.expense_date)}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{e.category_name}{e.sub_category_name ? ` / ${e.sub_category_name}` : ''}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtCurrency(e.amount)}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{e.description || '—'}</td>
                    <td className="px-3 py-2 text-center">{e.affects_inventory ? <span className="text-green-600 text-xs font-medium">Ya</span> : '—'}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{e.product_name || '—'}</td>
                    {request.status === 'DISBURSED' && (
                      <td className="px-3 py-2 text-center">
                        {!e.settlement_id && (
                          <button onClick={() => setDeleteExpenseId(e.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {showApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowApprove(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Approve & Cairkan</h3>
              <button onClick={() => setShowApprove(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sumber Bank *</label>
                <select value={approveForm.source_bank_account_id} onChange={(e) => setApproveForm(f => ({ ...f, source_bank_account_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                  <option value="">Pilih rekening</option>
                  {bankAccounts.map((ba) => <option key={ba.id} value={ba.id}>{ba.bank_name} · {ba.account_number} . {ba.account_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah Dicairkan *</label>
                <input type="number" value={approveForm.amount_disbursed} onChange={(e) => setApproveForm(f => ({ ...f, amount_disbursed: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Catatan</label>
                <textarea value={approveForm.notes} onChange={(e) => setApproveForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowApprove(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
              <button onClick={handleApprove} disabled={approveMutation.isPending} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve & Cairkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowReject(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tolak Request</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Alasan Penolakan *</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReject(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
              <button onClick={handleReject} disabled={rejectMutation.isPending} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Form Modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowExpenseForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Pengeluaran</h3>
              <button onClick={() => setShowExpenseForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Kategori *</label>
                <select value={expenseForm.category_id} onChange={(e) => setExpenseForm(f => ({ ...f, category_id: e.target.value, sub_category_id: '' }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                  <option value="">Pilih kategori</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.category_code} — {c.category_name}</option>)}
                </select>
              </div>
              {expenseForm.category_id && subCategories.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sub-kategori</label>
                  <select value={expenseForm.sub_category_id} onChange={(e) => setExpenseForm(f => ({ ...f, sub_category_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                    <option value="">—</option>
                    {subCategories.map(sc => <option key={sc.id} value={sc.id}>{sc.sub_category_name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal</label>
                  <input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah *</label>
                  <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Keterangan</label>
                <textarea value={expenseForm.description} onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
              </div>

              {/* Inventory fields — shown only when category affects_inventory */}
              {selectedCategory?.affects_inventory && (
                <div className="border-l-2 border-amber-300 pl-3 space-y-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Kategori ini masuk gudang — field berikut wajib diisi</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Produk *</label>
                    {selectedProduct ? (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                        <span className="text-gray-900 dark:text-white">{selectedProduct.product_name}</span>
                        <button type="button" onClick={() => { setSelectedProduct(null); setExpenseForm(f => ({ ...f, product_id: '' })) }}>
                          <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                        </button>
                      </div>
                    ) : (
                      <ProductSearchInput
                        onSelect={(product) => {
                          setExpenseForm(f => ({ ...f, product_id: product.id }))
                          setSelectedProduct({ id: product.id, product_name: product.product_name })
                        }}
                        placeholder="Cari produk..."
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Gudang *</label>
                    <select value={expenseForm.warehouse_id} onChange={(e) => setExpenseForm(f => ({ ...f, warehouse_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                      <option value="">Pilih gudang</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Qty *</label>
                      <input type="number" value={expenseForm.qty} onChange={(e) => setExpenseForm(f => ({ ...f, qty: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Harga Satuan</label>
                      <input type="number" value={expenseForm.unit_price} onChange={(e) => setExpenseForm(f => ({ ...f, unit_price: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowExpenseForm(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
              <button onClick={handleCreateExpense} disabled={createExpenseMutation.isPending} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {createExpenseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {showVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowVoid(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-red-600">Void Settlement</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Ini akan membatalkan settlement, reverse jurnal & stock movement, dan mengembalikan request ke status Aktif.</p>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Alasan *</label>
              <textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowVoid(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
              <button onClick={handleVoid} disabled={voidMutation.isPending} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {voidMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Void Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Expense Confirm */}
      <ConfirmModal
        isOpen={!!deleteExpenseId}
        onClose={() => setDeleteExpenseId(null)}
        onConfirm={handleDeleteExpense}
        title="Hapus Expense"
        message="Yakin ingin menghapus pengeluaran ini?"
        confirmText="Hapus"
        variant="danger"
        isLoading={deleteExpenseMutation.isPending}
      />
    </div>
  )
}
