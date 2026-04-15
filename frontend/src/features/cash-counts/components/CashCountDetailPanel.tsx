import { useState } from 'react'
import { X, Loader2, AlertTriangle, Check } from 'lucide-react'
import type { CashCount, UpdatePhysicalCountDto } from '../types'
import { CashCountStatusBadge } from './CashCountStatusBadge'

const fmt = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

interface Props {
  item: CashCount
  isOpen: boolean
  onClose: () => void
  onCount: (id: string, dto: UpdatePhysicalCountDto) => Promise<void>
  onCloseCount: (id: string) => Promise<void>
  employees: { id: string; full_name: string }[]
  bankAccounts: { id: number; account_name: string; account_number: string; bank_name: string; bank_code: string }[]
  isLoading: boolean
}

export function CashCountDetailPanel({ item, isOpen, onClose, onCount, employees, isLoading }: Props) {
  const [editLarge, setEditLarge] = useState(item.large_denomination?.toString() || '')
  const [editSmall, setEditSmall] = useState(item.small_denomination?.toString() || '')
  const [employeeId, setEmployeeId] = useState(item.responsible_employee_id || '')

  if (!isOpen) return null

  const editTotal = (Number(editLarge) || 0) + (Number(editSmall) || 0)
  const diff = editTotal - item.system_balance

  const handleCount = async () => {
    await onCount(item.id, {
      large_denomination: Number(editLarge) || 0,
      small_denomination: Number(editSmall) || 0,
      responsible_employee_id: diff < 0 ? employeeId || undefined : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{item.branch_name || 'Cash Count'}</h3>
            <p className="text-sm text-gray-400">{fmtDate(item.start_date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <CashCountStatusBadge status={item.status} />
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400 text-xs">System Balance</span><p className="font-mono font-semibold text-base text-gray-900 dark:text-white">{fmt(item.system_balance)}</p></div>
            <div><span className="text-gray-400 text-xs">Transaksi</span><p className="font-medium text-gray-900 dark:text-white">{item.transaction_count} trx</p></div>
            {item.physical_count !== null && (
              <>
                <div><span className="text-gray-400 text-xs">Pecahan Besar</span><p className="font-mono text-gray-900 dark:text-white">{fmt(item.large_denomination || 0)}</p></div>
                <div><span className="text-gray-400 text-xs">Pecahan Kecil</span><p className="font-mono text-gray-900 dark:text-white">{fmt(item.small_denomination || 0)}</p></div>
                <div><span className="text-gray-400 text-xs">Total Fisik</span><p className="font-mono font-semibold text-base text-gray-900 dark:text-white">{fmt(item.physical_count)}</p></div>
                <div>
                  <span className="text-gray-400 text-xs">Selisih</span>
                  <p className={`font-mono font-semibold text-base ${(item.difference || 0) > 0 ? 'text-blue-600' : (item.difference || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {(item.difference || 0) > 0 ? '+' : ''}{fmt(item.difference || 0)}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Edit count — OPEN or COUNTED (re-edit) */}
          {(item.status === 'OPEN' || item.status === 'COUNTED') && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                {item.status === 'OPEN' ? 'Input Hitung Fisik' : 'Edit Hitung Fisik'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Pecahan Besar</label>
                  <input type="number" value={editLarge} onChange={(e) => setEditLarge(e.target.value)} min={0}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Pecahan Kecil</label>
                  <input type="number" value={editSmall} onChange={(e) => setEditSmall(e.target.value)} min={0}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total: <span className="font-mono font-semibold text-gray-900 dark:text-white">{fmt(editTotal)}</span></span>
                <span className={`font-mono font-semibold ${diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  Selisih: {diff > 0 ? '+' : ''}{fmt(diff)}
                </span>
              </div>
              {diff < 0 && (
                <div>
                  <label className="block text-xs text-red-500 items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3" />PIC Deficit *</label>
                  <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
                    <option value="">Pilih</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>
              )}
              <button onClick={handleCount} disabled={editTotal <= 0 || (diff < 0 && !employeeId) || isLoading}
                className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Simpan
              </button>
            </div>
          )}

          {/* Deposited info */}
          {item.status === 'DEPOSITED' && item.cash_deposit_id && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl text-sm text-purple-700 dark:text-purple-300">
              Sudah termasuk dalam setoran. Deposit ID: {item.cash_deposit_id.slice(0, 8)}…
            </div>
          )}

          {/* Closed */}
          {item.status === 'CLOSED' && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-300 text-center">
              ✓ Cash count sudah selesai
            </div>
          )}

          {/* PIC info */}
          {item.responsible_employee_id && (
            <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              PIC: {employees.find((e) => e.id === item.responsible_employee_id)?.full_name || item.responsible_employee_id}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
