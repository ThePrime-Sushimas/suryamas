import { Pencil, Trash2, ExternalLink, Warehouse } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import type { PettyCashExpense } from '../types/pettyCash.types'
import { fmtCurrency, fmtDate, fmtQty } from '@/lib/formatters'

interface ExpenseCardProps {
  expense: PettyCashExpense
  canAct: boolean
  onEdit: (expense: PettyCashExpense) => void
  onDelete: (expenseId: string) => void
}

export function ExpenseCard({ expense: e, canAct, onEdit, onDelete }: ExpenseCardProps) {
  const title = e.product_name || e.description || 'Pengeluaran'
  const showActions = canAct && !e.settlement_id

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/60">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900 dark:text-white">{title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(e.expense_date)}</p>
        </div>
        {showActions && (
          <div className="flex shrink-0 gap-1">
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
      </div>

      {e.product_name && e.description && (
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">{e.description}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
        <span>
          {e.category_name}
          {e.sub_category_name ? ` / ${e.sub_category_name}` : ''}
        </span>
        {e.qty != null && (
          <span>
            {fmtQty(e.qty)} {e.product_uom_name || e.base_unit_name || ''} ×{' '}
            {fmtCurrency(e.unit_price)}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-700">
        <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
          {fmtCurrency(e.amount)}
        </span>
      </div>

      {(e.warehouse_id || e.fixed_asset_id) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {e.warehouse_id && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Warehouse className="h-3 w-3" />
              {e.warehouse_name || 'Gudang'}
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Masuk</span>
            </span>
          )}
          {e.fixed_asset_id && (
            <Link
              to={`/fixed-assets/${e.fixed_asset_id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {e.asset_code || 'Aset'}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}