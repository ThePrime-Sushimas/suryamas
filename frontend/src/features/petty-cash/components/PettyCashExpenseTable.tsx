import { Trash2 } from 'lucide-react'
import type { PettyCashExpense, PettyCashRequestStatus } from '../types/pettyCash.types'

const fmtCurrency = (v: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

interface PettyCashExpenseTableProps {
  expenses: PettyCashExpense[]
  requestStatus: PettyCashRequestStatus
  onDelete: (expenseId: string) => void
}

export function PettyCashExpenseTable({ expenses, requestStatus, onDelete }: PettyCashExpenseTableProps) {
  return (
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
                {requestStatus === 'DISBURSED' && <th className="px-3 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Aksi</th>}
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
                  {requestStatus === 'DISBURSED' && (
                    <td className="px-3 py-2 text-center">
                      {!e.settlement_id && (
                        <button onClick={() => onDelete(e.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
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
  )
}
