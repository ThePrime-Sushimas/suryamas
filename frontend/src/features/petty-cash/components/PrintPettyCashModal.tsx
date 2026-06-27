import { useState, useEffect } from 'react'
import { Printer, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePrinters, usePrintPettyCash } from '@/features/printers/api'

interface Props {
  requestId: string
  onClose: () => void
}

export function PrintPettyCashModal({ requestId, onClose }: Props) {
  const toast = useToast()
  const { data: printers = [], isLoading: loadingPrinters } = usePrinters()
  const printMutation = usePrintPettyCash()

  const activePrinters = printers.filter((p) => p.is_active)
  const defaultPrinter = activePrinters.find((p) => p.is_default)

  const [selectedPrinter, setSelectedPrinter] = useState(defaultPrinter?.id ?? '')

  useEffect(() => {
    if (defaultPrinter && !selectedPrinter) {
      setSelectedPrinter(defaultPrinter.id)
    }
  }, [defaultPrinter, selectedPrinter])

  const handlePrint = async () => {
    if (!selectedPrinter) {
      toast.error('Pilih printer')
      return
    }
    try {
      await printMutation.mutateAsync({
        requestId,
        printer_id: selectedPrinter,
      })
      toast.success('Print job terkirim')
      onClose()
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal print'))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-gray-900 dark:text-white">Print Thermal — Kas Kecil</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Printer</label>
            {loadingPrinters ? (
              <div className="h-9 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            ) : activePrinters.length === 0 ? (
              <p className="text-xs text-red-500">Tidak ada printer aktif. Konfigurasi printer di menu Settings.</p>
            ) : (
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Pilih Printer</option>
                {activePrinters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.printer_name} ({p.ip_address}) {p.is_default ? '⭐' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Akan mencetak ringkasan Kas Kecil beserta rincian pengeluaran ke printer thermal yang dipilih.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Batal
          </button>
          <button
            onClick={handlePrint}
            disabled={!selectedPrinter || printMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            {printMutation.isPending ? 'Mengirim...' : 'Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
