import React from 'react'
import { useBankVouchersStore } from '../store/bankVouchers.store'
import { bankVouchersApi } from '../api/bankVouchers.api'
import type { VoucherListItem } from '../types/bank-vouchers.types'

const formatIDR = (n: number) =>
  n === 0 ? '-' : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(Math.abs(n))

const formatDate = (s: string) => {
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusColor: Record<string, string> = {
  DRAFT: 'bg-amber-50 text-amber-600 border-amber-200',
  CONFIRMED: 'bg-green-50 text-green-600 border-green-200',
  JOURNALED: 'bg-blue-50 text-blue-600 border-blue-200',
  VOID: 'bg-red-50 text-red-600 border-red-200',
}

export const VoucherListTab = () => {
  const {
    voucherList, loading, fetchList, filter,
    selectedVoucherIds, toggleSelectVoucher, selectAllDraftVouchers, clearSelectedVouchers,
    confirmSelected,
  } = useBankVouchersStore()

  const [voidingId, setVoidingId] = React.useState<string | null>(null)
  const [voidReason, setVoidReason] = React.useState('')
  const [confirming, setConfirming] = React.useState(false)

  React.useEffect(() => { fetchList() }, [filter.period_month, filter.period_year]) // eslint-disable-line

  const handleVoid = async (id: string) => {
    if (!voidReason.trim()) return
    try {
      await bankVouchersApi.voidVoucher(id, voidReason)
      setVoidingId(null)
      setVoidReason('')
      fetchList()
    } catch { /* handled by axios interceptor */ }
  }

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const numbers = await confirmSelected()
      if (numbers.length > 0) {
        alert(`${numbers.length} voucher dikonfirmasi:\n${numbers.join(', ')}`)
      }
    } catch { /* */ }
    setConfirming(false)
  }

  if (loading.list) {
    return (
      <div className="animate-pulse space-y-2 p-6">
        {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded" />)}
      </div>
    )
  }

  if (!voucherList || voucherList.vouchers.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
        Belum ada voucher untuk periode ini
      </div>
    )
  }

  const draftCount = voucherList.vouchers.filter(v => v.status === 'DRAFT').length

  return (
    <div>
      {/* Toolbar */}
      {draftCount > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-900/10">
          <span className="text-xs text-amber-700 dark:text-amber-400">
            {draftCount} voucher DRAFT menunggu konfirmasi
          </span>
          <div className="flex items-center gap-3">
            <button onClick={selectAllDraftVouchers} className="text-xs text-blue-600 hover:underline">Pilih Semua Draft</button>
            {selectedVoucherIds.size > 0 && (
              <>
                <button onClick={clearSelectedVouchers} className="text-xs text-gray-400 hover:underline">Batal</button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="px-3 py-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
                >
                  {confirming ? 'Mengkonfirmasi...' : `Konfirmasi (${selectedVoucherIds.size})`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] text-gray-400 uppercase tracking-wider">
            <tr>
              {draftCount > 0 && <th className="px-3 py-3 w-8" />}
              <th className="px-4 py-3 text-left">No. Voucher</th>
              <th className="px-4 py-3 text-left">Tipe</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Tgl Bank</th>
              <th className="px-4 py-3 text-left">Bank</th>
              <th className="px-4 py-3 text-right">Total Nett</th>
              <th className="px-4 py-3 text-left">Keterangan</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {voucherList.vouchers.map((v: VoucherListItem) => (
              <React.Fragment key={v.id}>
                <tr className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  {draftCount > 0 && (
                    <td className="px-3 py-3">
                      {v.status === 'DRAFT' && (
                        <input
                          type="checkbox"
                          checked={selectedVoucherIds.has(v.id)}
                          onChange={() => toggleSelectVoucher(v.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{v.voucher_number}</span>
                    {v.is_manual && <span className="ml-1 text-[8px] bg-purple-100 text-purple-600 px-1 rounded">MANUAL</span>}
                  </td>
                  <td className="px-4 py-3">{v.voucher_type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusColor[v.status] || ''}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(v.bank_date)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{v.bank_account_name}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800 dark:text-gray-200">
                    {formatIDR(v.total_nett)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-48">{v.description || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={bankVouchersApi.getPrintUrl(v.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 text-[10px] hover:underline"
                      >
                        Print
                      </a>
                      {v.status === 'CONFIRMED' && (
                        <button onClick={() => setVoidingId(v.id)} className="text-red-500 hover:text-red-700 text-[10px] hover:underline">
                          Void
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {voidingId === v.id && (
                  <tr>
                    <td colSpan={draftCount > 0 ? 9 : 8} className="px-4 py-3 bg-red-50 dark:bg-red-900/10">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-red-600 font-medium">Alasan void:</span>
                        <input
                          type="text" value={voidReason} onChange={e => setVoidReason(e.target.value)}
                          placeholder="Masukkan alasan..." autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleVoid(v.id)}
                          className="flex-1 px-3 py-1.5 text-xs border border-red-200 rounded-md focus:ring-red-500"
                        />
                        <button onClick={() => handleVoid(v.id)} disabled={!voidReason.trim()}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50">
                          Konfirmasi Void
                        </button>
                        <button onClick={() => { setVoidingId(null); setVoidReason('') }}
                          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                          Batal
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
          Total: {voucherList.total} voucher
        </div>
      </div>
    </div>
  )
}
