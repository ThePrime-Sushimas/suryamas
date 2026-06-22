import { useState } from 'react'
import { Printer, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePrinters, usePrintPurchaseRequest } from '@/features/printers/api'
import type { PurchaseRequestLine } from '../api/purchaseRequests.api'

interface SupplierGroup {
  supplierName: string
  supplierId: string | null
  lines: (PurchaseRequestLine & { _origIdx: number })[]
}

interface PrintPRModalProps {
  prId: string
  supplierGroups: SupplierGroup[]
  onClose: () => void
}

export function PrintPRModal({ prId, supplierGroups, onClose }: PrintPRModalProps) {
  const toast = useToast()
  const { data: printers = [], isLoading: loadingPrinters } = usePrinters()
  const printMutation = usePrintPurchaseRequest()

  const activePrinters = printers.filter(p => p.is_active)
  const defaultPrinter = activePrinters.find(p => p.is_default)

  const [selectedPrinter, setSelectedPrinter] = useState(defaultPrinter?.id ?? '')
  const [selectedLines, setSelectedLines] = useState<Set<string>>(() => {
    const all = new Set<string>()
    supplierGroups.forEach(g => g.lines.forEach(l => { if (l.id) all.add(l.id) }))
    return all
  })

  const toggleGroup = (group: SupplierGroup) => {
    const groupIds = group.lines.map(l => l.id).filter((id): id is string => !!id)
    const allSelected = groupIds.every(id => selectedLines.has(id))
    setSelectedLines(prev => {
      const next = new Set(prev)
      groupIds.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  const toggleLine = (lineId: string) => {
    setSelectedLines(prev => {
      const next = new Set(prev)
      next.has(lineId) ? next.delete(lineId) : next.add(lineId)
      return next
    })
  }

  const handlePrint = async () => {
    if (!selectedPrinter) { toast.error('Pilih printer'); return }
    if (selectedLines.size === 0) { toast.error('Pilih minimal 1 item'); return }
    try {
      await printMutation.mutateAsync({ prId, printer_id: selectedPrinter, line_ids: Array.from(selectedLines) })
      toast.success('Print job terkirim')
      onClose()
    } catch (err) { toast.error(parseApiError(err, 'Gagal print')) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-gray-900 dark:text-white">Cetak Permintaan Pembelian</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Printer Selection */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Printer</label>
          {loadingPrinters ? (
            <div className="h-9 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ) : activePrinters.length === 0 ? (
            <p className="text-xs text-red-500">Belum ada printer aktif. Tambahkan di Settings → Printers</p>
          ) : (
            <select value={selectedPrinter} onChange={e => setSelectedPrinter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">Pilih printer...</option>
              {activePrinters.map(p => (
                <option key={p.id} value={p.id}>
                  {p.printer_name}
                  {p.branch_name ? ` — ${p.branch_name}` : ''}
                  {p.is_default ? ' ★' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Item Selection */}
        <div className="flex-1 overflow-auto px-5 py-3">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Pilih item yang akan dicetak:</p>
          <div className="space-y-3">
            {supplierGroups.map((group, gIdx) => {
              const groupIds = group.lines.map(l => l.id).filter((id): id is string => !!id)
              const allSelected = groupIds.every(id => selectedLines.has(id))
              const someSelected = groupIds.some(id => selectedLines.has(id))

              return (
                <div key={gIdx} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 flex items-center gap-2">
                    <input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                      onChange={() => toggleGroup(group)} className="rounded border-gray-300 text-indigo-600" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{group.supplierName}</span>
                    <span className="text-xs text-gray-400">({groupIds.filter(id => selectedLines.has(id)).length}/{groupIds.length})</span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {group.lines.filter(l => l.id).map(line => (
                      <label key={line.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
                        <input type="checkbox" checked={selectedLines.has(line.id!)} onChange={() => toggleLine(line.id!)}
                          className="rounded border-gray-300 text-indigo-600" />
                        <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">{line.product_name}</span>
                        <span className="text-xs text-gray-400">{line.qty} {line.uom}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Batal</button>
          <button onClick={handlePrint} disabled={printMutation.isPending || !selectedPrinter || selectedLines.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            <Printer className="w-4 h-4" />
            {printMutation.isPending ? 'Printing...' : `Print (${selectedLines.size} item)`}
          </button>
        </div>
      </div>
    </div>
  )
}
