import { Eye, Trash2 } from 'lucide-react'
import type { CashCount } from '../types'
import { CashCountStatusBadge } from './CashCountStatusBadge'
import { Pagination } from '@/components/ui/Pagination'

const fmt = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

interface Props {
  items: CashCount[]
  isLoading: boolean
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }
  onPageChange: (p: number) => void
  onLimitChange: (l: number) => void
  onView: (id: string) => void
  onDelete: (item: CashCount) => void
}

export function CashCountTable({ items, isLoading, pagination, onPageChange, onLimitChange, onView, onDelete }: Props) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <th className="px-3 py-2.5 text-left font-semibold">Periode</th>
              <th className="px-3 py-2.5 text-left font-semibold">Cabang</th>
              <th className="px-3 py-2.5 text-left font-semibold">Payment</th>
              <th className="px-3 py-2.5 text-right font-semibold">System</th>
              <th className="px-3 py-2.5 text-right font-semibold">Fisik</th>
              <th className="px-3 py-2.5 text-right font-semibold">Selisih</th>
              <th className="px-3 py-2.5 text-center font-semibold">Status</th>
              <th className="px-3 py-2.5 text-left font-semibold">PIC</th>
              <th className="px-3 py-2.5 text-center font-semibold w-16">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-3 py-2.5"><div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-12 text-center text-gray-400 text-sm">Belum ada cash count</td></tr>
            ) : (
              items.map((item) => {
                const diff = item.difference ?? 0
                return (
                  <tr key={item.id} onClick={() => onView(item.id)} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 cursor-pointer transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {fmtDate(item.start_date)} — {fmtDate(item.end_date)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{item.branch_name || 'Semua'}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{item.payment_method_name || '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">{fmt(item.system_balance)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-700 dark:text-gray-300">
                      {item.physical_count !== null ? fmt(item.physical_count) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {item.physical_count !== null ? (
                        <span className={diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-600' : 'text-green-600'}>
                          {diff > 0 ? '+' : ''}{fmt(diff)}
                        </span>
                      ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center"><CashCountStatusBadge status={item.status} /></td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{item.responsible_employee_name || '-'}</td>
                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onView(item.id)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="Detail">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {item.status === 'OPEN' && (
                          <button onClick={() => onDelete(item)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors" title="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {pagination.total > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <Pagination pagination={pagination} onPageChange={onPageChange} onLimitChange={onLimitChange} currentLength={items.length} />
        </div>
      )}
    </div>
  )
}
