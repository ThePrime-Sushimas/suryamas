import { useState } from 'react'
import { Printer, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePrinters } from '@/features/printers/api'
import { printDpo } from '../api/dpo.api'
import type { DailyPrepOrderLineWithRelations } from '../types/dpo.types'

interface PrintDpoModalProps {
  dpoId: string
  lines: DailyPrepOrderLineWithRelations[]
  onClose: () => void
}

const formatQty = (n: number) => parseFloat(n.toFixed(4)).toString()

export function PrintDpoModal({ dpoId, lines, onClose }: PrintDpoModalProps) {
  const toast = useToast()
  const { data: printers = [], isLoading: loadingPrinters } = usePrinters()

  const activePrinters = printers.filter((p) => p.is_active)
  const defaultPrinter = activePrinters.find((p) => p.is_default)

  const printableLines = lines.filter((l) => (l.confirmed_qty ?? l.suggested_qty) > 0)

  const [selectedPrinter, setSelectedPrinter] = useState(defaultPrinter?.id ?? '')
  const [selectedLines, setSelectedLines] = useState<Set<string>>(() => {
    return new Set(printableLines.map((l) => l.id))
  })
  const [isPrinting, setIsPrinting] = useState(false)

  const toggleAll = () => {
    const allIds = printableLines.map((l) => l.id)
    const allSelected = allIds.every((id) => selectedLines.has(id))
    setSelectedLines(allSelected ? new Set() : new Set(allIds))
  }

  const toggleLine = (lineId: string) => {
    setSelectedLines((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const handlePrint = async () => {
    if (!selectedPrinter) {
      toast.error('Pilih printer')
      return
    }
    if (selectedLines.size === 0) {
      toast.error('Pilih minimal 1 item')
      return
    }
    setIsPrinting(true)
    try {
      await printDpo(dpoId, {
        printer_id: selectedPrinter,
        line_ids: Array.from(selectedLines),
      })
      toast.success('Print job terkirim')
      onClose()
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal print'))
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900 dark:text-white">
              Print Thermal — Daily Prep Order
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printer selector */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Printer
          </label>
          {loadingPrinters ? (
            <div className="h-9 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ) : activePrinters.length === 0 ? (
            <p className="text-xs text-red-500">
              Belum ada printer aktif. Tambahkan di Settings → Printers
            </p>
          ) : (
            <select
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Pilih printer...</option>
              {activePrinters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.printer_name}
                  {p.branch_name ? ` — ${p.branch_name}` : ''}
                  {p.is_default ? ' ★' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Line selection */}
        <div className="flex-1 overflow-auto px-5 py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Pilih item yang akan dicetak (qty transfer).
          </p>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={printableLines.length > 0 && printableLines.every((l) => selectedLines.has(l.id))}
                ref={(el) => {
                  if (el) {
                    const some = printableLines.some((l) => selectedLines.has(l.id))
                    const all = printableLines.every((l) => selectedLines.has(l.id))
                    el.indeterminate = some && !all
                  }
                }}
                onChange={toggleAll}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Semua item</span>
              <span className="text-xs text-gray-400">({selectedLines.size}/{printableLines.length})</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-60 overflow-y-auto">
              {printableLines.map((line) => (
                <label
                  key={line.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedLines.has(line.id)}
                    onChange={() => toggleLine(line.id)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
                    {line.product_name}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatQty(line.confirmed_qty ?? line.suggested_qty)} {line.uom}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting || !selectedPrinter || selectedLines.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            {isPrinting ? 'Printing...' : `Print (${selectedLines.size} item)`}
          </button>
        </div>
      </div>
    </div>
  )
}
