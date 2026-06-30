import { Trash2, Pencil, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, StatusBadge } from '@/components/ui'
import type { PettyCashExpense } from '../types/pettyCash.types'
import { fmtCurrency, fmtDate, fmtQty } from '../utils/pettyCash.formatters'

interface ExpenseTableDesktopProps {
  expenses: PettyCashExpense[]
  canAct: boolean
  onEdit: (expense: PettyCashExpense) => void
  onDelete: (expenseId: string) => void
}

export function ExpenseTableDesktop({
  expenses,
  canAct,
  onEdit,
  onDelete,
}: ExpenseTableDesktopProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-700/30">
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Tgl
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Produk / Keterangan
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Kategori
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Qty / Satuan
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Harga
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Total
            </th>
            <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Inventory
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Gudang
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Fixed Asset
            </th>
            {canAct && (
              <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Aksi
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {expenses.map((e) => (
            <tr
              key={e.id}
              className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-700/20"
            >
              <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-400">
                {fmtDate(e.expense_date)}
              </td>
              <td className="px-4 py-3">
                {e.product_name ? (
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {e.product_name}
                    </span>
                    {e.description && (
                      <p className="mt-0.5 max-w-[200px] truncate text-xs text-gray-500">
                        {e.description}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-700 dark:text-gray-300">
                    {e.description || '—'}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                {e.category_name}
                {e.sub_category_name ? ` / ${e.sub_category_name}` : ''}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {e.qty != null ? (
                  <span>
                    {fmtQty(e.qty)}{' '}
                    <span className="text-xs text-gray-400">
                      {e.product_uom_name || e.base_unit_name || ''}
                    </span>
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {fmtCurrency(e.unit_price)}
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-white">
                {fmtCurrency(e.amount)}
              </td>
              <td className="px-4 py-3 text-center">
                {e.warehouse_id ? (
                  <StatusBadge variant="success" label="Ya" size="sm" />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                {e.warehouse_name || '—'}
              </td>
              <td className="px-4 py-3 text-xs">
                {e.fixed_asset_id ? (
                  <Link
                    to={`/fixed-assets/${e.fixed_asset_id}`}
                    className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {e.asset_code || 'Aset'}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              {canAct && (
                <td className="px-4 py-3 text-center">
                  {!e.settlement_id && (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(e)}
                        title="Edit"
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-3.5 w-3.5 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(e.id)}
                        title="Hapus"
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {expenses.length > 1 && (
          <tfoot>
            <tr className="border-t border-gray-100 bg-gray-50/80 font-medium dark:border-gray-700 dark:bg-gray-700/30">
              <td colSpan={5} className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                Total
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">
                {fmtCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}
              </td>
              <td colSpan={canAct ? 4 : 3} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}