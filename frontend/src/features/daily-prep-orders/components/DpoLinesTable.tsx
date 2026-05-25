import { useState } from 'react'
import { Save, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useUpdateDpoLines, useDeleteDpoLine } from '../api/dpo.queries'
import type { DailyPrepOrderDetail, DailyPrepOrderLineWithRelations } from '../types/dpo.types'

interface LineEdit {
  confirmed_qty: number | null
  notes?: string | null
}

interface DpoLinesTableProps {
  dpo: DailyPrepOrderDetail
  readOnly?: boolean
}

const formatQty = (n: number) => parseFloat(n.toFixed(4)).toString()

export function DpoLinesTable({ dpo, readOnly = false }: DpoLinesTableProps) {
  const toast = useToast()
  const updateMutation = useUpdateDpoLines(dpo.id)
  const deleteMutation = useDeleteDpoLine(dpo.id)

  const [edits, setEdits] = useState<Record<string, LineEdit>>({})
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const isDirty = Object.keys(edits).length > 0

  const handleQtyChange = (lineId: string, value: string) => {
    const qty = value === '' ? null : parseFloat(value)
    setEdits((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], confirmed_qty: qty },
    }))
  }

  const handleNotesChange = (lineId: string, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], confirmed_qty: prev[lineId]?.confirmed_qty ?? getLineQty(lineId), notes: value || null },
    }))
  }

  const getLineQty = (lineId: string): number | null => {
    const line = dpo.lines.find((l) => l.id === lineId)
    return line?.confirmed_qty ?? null
  }

  const getDisplayQty = (line: DailyPrepOrderLineWithRelations): string => {
    if (edits[line.id]?.confirmed_qty !== undefined) {
      return edits[line.id].confirmed_qty?.toString() ?? ''
    }
    return line.confirmed_qty?.toString() ?? ''
  }

  const getDisplayNotes = (line: DailyPrepOrderLineWithRelations): string => {
    if (edits[line.id]?.notes !== undefined) {
      return edits[line.id].notes ?? ''
    }
    return line.notes ?? ''
  }

  const handleSave = () => {
    const linesToSave = Object.entries(edits).map(([id, edit]) => ({
      id,
      confirmed_qty: edit.confirmed_qty,
      notes: edit.notes,
    }))

    updateMutation.mutate(
      { lines: linesToSave },
      {
        onSuccess: () => {
          toast.success('Perubahan berhasil disimpan')
          setEdits({})
        },
        onError: (err) => {
          toast.error(parseApiError(err, 'Gagal menyimpan perubahan'))
        },
      }
    )
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        toast.success('Line berhasil dihapus')
        setDeleteTarget(null)
        // Remove from edits if exists
        setEdits((prev) => {
          const next = { ...prev }
          delete next[deleteTarget]
          return next
        })
      },
      onError: (err) => {
        toast.error(parseApiError(err, 'Gagal menghapus line'))
      },
    })
  }

  return (
    <div className="space-y-3">
      {/* Save button */}
      {!readOnly && isDirty && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Perubahan
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Produk</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">UOM</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Avg 7d</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Avg 30d</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Avg DOW</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Predicted</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Ready Stock</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Main Stock</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Suggested</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Confirmed</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Notes</th>
              {!readOnly && <th className="px-3 py-2 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {dpo.lines.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 11 : 12} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                  Tidak ada line items
                </td>
              </tr>
            ) : (
              dpo.lines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  readOnly={readOnly}
                  displayQty={getDisplayQty(line)}
                  displayNotes={getDisplayNotes(line)}
                  onQtyChange={(v) => handleQtyChange(line.id, v)}
                  onNotesChange={(v) => handleNotesChange(line.id, v)}
                  onDelete={() => setDeleteTarget(line.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Line"
        message="Line ini akan dihapus dari DPO. Lanjutkan?"
        variant="danger"
        confirmText="Ya, Hapus"
        cancelText="Batal"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// ── Line Row ──────────────────────────────────────────────────────────────────

function LineRow({
  line,
  readOnly,
  displayQty,
  displayNotes,
  onQtyChange,
  onNotesChange,
  onDelete,
}: {
  line: DailyPrepOrderLineWithRelations
  readOnly: boolean
  displayQty: string
  displayNotes: string
  onQtyChange: (value: string) => void
  onNotesChange: (value: string) => void
  onDelete: () => void
}) {
  const readyStockChanged = line.live_ready_stock !== line.current_ready_stock
  const mainStockChanged = line.live_main_stock !== line.current_main_stock

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900 dark:text-white text-xs">{line.product_code}</div>
        <div className="text-gray-500 dark:text-gray-400 text-xs truncate max-w-[160px]">{line.product_name}</div>
      </td>
      <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">{line.uom}</td>
      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{formatQty(line.avg_sales_7d)}</td>
      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{formatQty(line.avg_sales_30d)}</td>
      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{formatQty(line.avg_sales_dow)}</td>
      <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">{formatQty(line.predicted_need)}</td>
      <td className="px-3 py-2 text-right">
        <span className="text-gray-600 dark:text-gray-300">{formatQty(line.live_ready_stock)}</span>
        {readyStockChanged && (
          <span className="ml-1 inline-flex" title="Stok bergerak sejak DPO di-generate">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <span className="text-gray-600 dark:text-gray-300">{formatQty(line.live_main_stock)}</span>
        {mainStockChanged && (
          <span className="ml-1 inline-flex" title="Stok bergerak sejak DPO di-generate">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{formatQty(line.suggested_qty)}</td>
      <td className="px-3 py-2 text-right">
        {readOnly ? (
          <span className="font-medium text-gray-900 dark:text-white">{line.confirmed_qty != null ? formatQty(line.confirmed_qty) : '—'}</span>
        ) : (
          <input
            type="number"
            step="0.0001"
            min="0"
            value={displayQty}
            onChange={(e) => onQtyChange(e.target.value)}
            className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right text-gray-900 dark:text-white"
          />
        )}
      </td>
      <td className="px-3 py-2">
        {readOnly ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">{line.notes ?? ''}</span>
        ) : (
          <input
            type="text"
            value={displayNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="—"
            className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs text-gray-900 dark:text-white"
          />
        )}
      </td>
      {!readOnly && (
        <td className="px-3 py-2 text-center">
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Hapus line"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      )}
    </tr>
  )
}
