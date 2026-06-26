import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCompanyBankAccounts } from '@/features/ap-payments/hooks/useCompanyBankAccounts'
import { usePettyCashRequest, useCreateSettlement } from '../api/pettyCash.api'
import { PettyCashStatusBadge } from '../components/PettyCashStatusBadge'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

export default function PettyCashSettlementPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const { data: request, isLoading } = usePettyCashRequest(id ?? '')
  const { data: bankAccounts = [] } = useCompanyBankAccounts()
  const createSettlement = useCreateSettlement()

  const [form, setForm] = useState({
    settlement_date: new Date().toISOString().slice(0, 10),
    amount_returned: '0',
    return_bank_account_id: '',
    refill_amount: '0',
    refill_bank_account_id: '',
    notes: '',
  })

  const remaining = useMemo(() => {
    if (!request) return 0
    return request.total_disbursed - request.total_expenses
  }, [request])

  const amountReturned = Number(form.amount_returned) || 0
  const refillAmount = Number(form.refill_amount) || 0
  const carriedToAmount = Math.max(0, remaining - amountReturned)
  const totalDanaBaru = carriedToAmount + refillAmount

  const handleSubmit = async () => {
    if (!id) return
    if (amountReturned > remaining + 1000) {
      toast.error(`Jumlah dikembalikan (${amountReturned}) melebihi saldo tersisa (${remaining})`)
      return
    }
    if (amountReturned > 0 && !form.return_bank_account_id) {
      toast.error('Pilih rekening pengembalian')
      return
    }
    if (refillAmount > 0 && !form.refill_bank_account_id) {
      toast.error('Pilih rekening refill')
      return
    }
    try {
      await createSettlement.mutateAsync({
        requestId: id,
        settlement_date: form.settlement_date || undefined,
        amount_returned: amountReturned,
        return_bank_account_id: amountReturned > 0 ? Number(form.return_bank_account_id) : undefined,
        refill_amount: refillAmount > 0 ? refillAmount : undefined,
        refill_bank_account_id: refillAmount > 0 ? Number(form.refill_bank_account_id) : undefined,
        notes: form.notes || undefined,
      })
      toast.success('Settlement berhasil diposting')
      navigate(`/finance/petty-cash/${id}`)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membuat settlement'))
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  if (!request) return <div className="text-center py-12 text-gray-500">Request tidak ditemukan</div>
  if (request.status !== 'DISBURSED') return <div className="text-center py-12 text-gray-500">Request harus berstatus Aktif untuk settlement</div>

  const expenses = request.expenses ?? []

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate(`/finance/petty-cash/${id}`)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Detail
      </button>

      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Settlement Kas Kecil</h1>

      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{request.request_number}</span>
          <PettyCashStatusBadge status={request.status} />
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500">Total Dicairkan</span><p className="font-medium">{fmtCurrency(request.total_disbursed)}</p></div>
          <div><span className="text-gray-500">Total Expense</span><p className="font-medium">{fmtCurrency(request.total_expenses)}</p></div>
          <div><span className="text-gray-500">Saldo Tersisa</span><p className="font-semibold text-blue-600">{fmtCurrency(remaining)}</p></div>
        </div>

        {expenses.length > 0 && (
          <details className="pt-2">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Lihat {expenses.length} expense</summary>
            <div className="mt-2 max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-gray-50 dark:border-gray-700/50">
                      <td className="py-1 text-gray-600">{e.category_name}</td>
                      <td className="py-1 text-right font-medium">{fmtCurrency(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Settlement</label>
          <input type="date" value={form.settlement_date} onChange={(e) => setForm(f => ({ ...f, settlement_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah Dikembalikan ke Bank</label>
          <input type="number" value={form.amount_returned} onChange={(e) => setForm(f => ({ ...f, amount_returned: e.target.value }))} min="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>
        {amountReturned > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Rekening Pengembalian *</label>
            <select value={form.return_bank_account_id} onChange={(e) => setForm(f => ({ ...f, return_bank_account_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <option value="">Pilih rekening</option>
              {bankAccounts.map((ba) => <option key={ba.id} value={ba.id}>{ba.bank_name} · {ba.account_number}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah Refill (tambahan dari bank)</label>
          <input type="number" value={form.refill_amount} onChange={(e) => setForm(f => ({ ...f, refill_amount: e.target.value }))} min="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>
        {refillAmount > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Rekening Refill *</label>
            <select value={form.refill_bank_account_id} onChange={(e) => setForm(f => ({ ...f, refill_bank_account_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <option value="">Pilih rekening</option>
              {bankAccounts.map((ba) => <option key={ba.id} value={ba.id}>{ba.bank_name} · {ba.account_number}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Catatan</label>
          <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>
      </div>

      {/* Preview Calculation */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50 p-5 space-y-2 text-sm">
        <h4 className="font-medium text-blue-800 dark:text-blue-300">Preview Kalkulasi</h4>
        <div className="grid grid-cols-2 gap-1">
          <span className="text-gray-600 dark:text-gray-400">Saldo tersisa:</span>
          <span className="text-right font-medium">{fmtCurrency(remaining)}</span>
          <span className="text-gray-600 dark:text-gray-400">Dikembalikan:</span>
          <span className="text-right font-medium text-red-600">- {fmtCurrency(amountReturned)}</span>
          <span className="text-gray-600 dark:text-gray-400">Carry ke request baru:</span>
          <span className="text-right font-medium text-blue-600">{fmtCurrency(carriedToAmount)}</span>
          {refillAmount > 0 && (
            <>
              <span className="text-gray-600 dark:text-gray-400">Tambahan refill:</span>
              <span className="text-right font-medium text-green-600">+ {fmtCurrency(refillAmount)}</span>
            </>
          )}
          <span className="font-medium text-gray-900 dark:text-white pt-1 border-t border-blue-200/50">Total dana request baru:</span>
          <span className="text-right font-semibold text-gray-900 dark:text-white pt-1 border-t border-blue-200/50">{fmtCurrency(totalDanaBaru)}</span>
        </div>
        {carriedToAmount === 0 && refillAmount === 0 && (
          <p className="text-xs text-gray-500 pt-1">Request akan ditutup total tanpa request baru.</p>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button onClick={() => navigate(`/finance/petty-cash/${id}`)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
        <button onClick={handleSubmit} disabled={createSettlement.isPending} className="px-6 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {createSettlement.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Settlement'}
        </button>
      </div>
    </div>
  )
}
