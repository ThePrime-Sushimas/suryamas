import { useState } from 'react'
import { X, Loader2, AlertTriangle, Banknote, CheckCircle } from 'lucide-react'
import type { CashCount, UpdatePhysicalCountDto, DepositDto } from '../types'
import { CashCountStatusBadge } from './CashCountStatusBadge'

const fmt = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

interface Props {
  item: CashCount
  isOpen: boolean
  onClose: () => void
  onCount: (id: string, dto: UpdatePhysicalCountDto) => Promise<void>
  onDeposit: (id: string, dto: DepositDto) => Promise<void>
  onCloseCount: (id: string) => Promise<void>
  employees: { id: string; full_name: string }[]
  bankAccounts: { id: number; account_name: string; bank_name: string }[]
  isLoading: boolean
}

export function CashCountDetailPanel({ item, isOpen, onClose, onCount, onDeposit, onCloseCount, employees, bankAccounts, isLoading }: Props) {
  const [physicalCount, setPhysicalCount] = useState(item.physical_count?.toString() || '')
  const [employeeId, setEmployeeId] = useState(item.responsible_employee_id || '')
  const [depositAmount, setDepositAmount] = useState(item.deposit_amount?.toString() || '')
  const [depositDate, setDepositDate] = useState(item.deposit_date || '')
  const [depositBankId, setDepositBankId] = useState(item.deposit_bank_account_id?.toString() || '')
  const [depositRef, setDepositRef] = useState(item.deposit_reference || '')

  if (!isOpen) return null

  const diff = physicalCount ? Number(physicalCount) - item.system_balance : null
  const isDeficit = diff !== null && diff < 0

  const handleCount = async () => {
    const dto: UpdatePhysicalCountDto = {
      physical_count: Number(physicalCount),
      responsible_employee_id: isDeficit ? employeeId || undefined : undefined,
    }
    await onCount(item.id, dto)
  }

  const handleDeposit = async () => {
    const dto: DepositDto = {
      deposit_amount: Number(depositAmount),
      deposit_date: depositDate,
      deposit_bank_account_id: Number(depositBankId),
      deposit_reference: depositRef || undefined,
    }
    await onDeposit(item.id, dto)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Detail Cash Count</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(item.start_date)} — {fmtDate(item.end_date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <CashCountStatusBadge status={item.status} />
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-gray-400">Cabang</span><p className="font-medium text-gray-900 dark:text-white">{item.branch_name || 'Semua'}</p></div>
            <div><span className="text-gray-400">Payment</span><p className="font-medium text-gray-900 dark:text-white">{item.payment_method_name || '-'}</p></div>
            <div><span className="text-gray-400">System Balance</span><p className="font-mono font-semibold text-gray-900 dark:text-white">{fmt(item.system_balance)}</p></div>
            <div><span className="text-gray-400">Transaksi</span><p className="font-medium text-gray-900 dark:text-white">{item.transaction_count} trx</p></div>
          </div>

          {/* Daily breakdown */}
          {item.details && item.details.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Breakdown Harian</p>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 dark:bg-gray-800/50 text-[10px] text-gray-400">
                    <th className="px-3 py-1.5 text-left">Tanggal</th>
                    <th className="px-3 py-1.5 text-right">Jumlah</th>
                    <th className="px-3 py-1.5 text-right">Trx</th>
                  </tr></thead>
                  <tbody>
                    {item.details.map((d) => (
                      <tr key={d.id} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{fmtDate(d.transaction_date)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-900 dark:text-white">{fmt(d.amount)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{d.transaction_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* OPEN → COUNTED */}
          {item.status === 'OPEN' && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Input Hitung Fisik</p>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Jumlah Fisik *</label>
                <input type="number" value={physicalCount} onChange={(e) => setPhysicalCount(e.target.value)} min={0}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
              </div>
              {diff !== null && (
                <div className={`flex items-center gap-2 text-xs font-medium ${diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {diff < 0 && <AlertTriangle className="w-3.5 h-3.5" />}
                  Selisih: {diff > 0 ? '+' : ''}{fmt(diff)}
                </div>
              )}
              {isDeficit && (
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">PIC Deficit *</label>
                  <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500">
                    <option value="">Pilih employee</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>
              )}
              <button onClick={handleCount} disabled={!physicalCount || (isDeficit && !employeeId) || isLoading}
                className="w-full py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Simpan Hitung Fisik
              </button>
            </div>
          )}

          {/* COUNTED → DEPOSITED */}
          {item.status === 'COUNTED' && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-purple-800 dark:text-purple-300">Catat Setoran</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Jumlah Setor *</label>
                  <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} min={0}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Tanggal Setor *</label>
                  <input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Bank Tujuan *</label>
                <select value={depositBankId} onChange={(e) => setDepositBankId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500">
                  <option value="">Pilih bank</option>
                  {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.bank_name} - {b.account_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Referensi</label>
                <input type="text" value={depositRef} onChange={(e) => setDepositRef(e.target.value)} placeholder="No. slip setoran"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500" />
              </div>
              <button onClick={handleDeposit} disabled={!depositAmount || !depositDate || !depositBankId || isLoading}
                className="w-full py-2 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Banknote className="w-3.5 h-3.5" />}
                Catat Setoran
              </button>
            </div>
          )}

          {/* DEPOSITED → CLOSED */}
          {item.status === 'DEPOSITED' && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-green-800 dark:text-green-300">Deposit Info</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-400">Jumlah</span><p className="font-mono font-semibold text-gray-900 dark:text-white">{fmt(item.deposit_amount || 0)}</p></div>
                <div><span className="text-gray-400">Tanggal</span><p className="text-gray-900 dark:text-white">{item.deposit_date ? fmtDate(item.deposit_date) : '-'}</p></div>
                <div><span className="text-gray-400">Bank</span><p className="text-gray-900 dark:text-white">{item.deposit_bank_name || '-'}</p></div>
                <div><span className="text-gray-400">Ref</span><p className="text-gray-900 dark:text-white">{item.deposit_reference || '-'}</p></div>
              </div>
              <button onClick={() => onCloseCount(item.id)} disabled={isLoading}
                className="w-full py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Close Cash Count
              </button>
            </div>
          )}

          {/* CLOSED summary */}
          {item.status === 'CLOSED' && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-500 text-center">
              ✓ Cash count sudah selesai
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
