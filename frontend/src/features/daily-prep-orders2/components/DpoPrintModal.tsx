import { useRef } from 'react'
import { Printer, X } from 'lucide-react'
import type { DailyPrepOrder } from '../api/dailyPrepOrders.api'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n)
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

interface Props {
  dpo: DailyPrepOrder
  onClose: () => void
}

export function DpoPrintModal({ dpo, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  const activeLines = (dpo.lines ?? []).filter(l => (l.confirmed_qty ?? l.suggested_qty) > 0)

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return

    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DPO ${dpo.dpo_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            width: 80mm;
            padding: 4mm;
            color: #000;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 3px 0; }
          .row { display: flex; justify-content: space-between; margin: 1px 0; }
          .product { font-size: 11px; font-weight: bold; }
          .detail { font-size: 10px; color: #333; }
          .qty { font-size: 13px; font-weight: bold; text-align: right; }
          .footer { font-size: 9px; text-align: center; margin-top: 6px; }
          @media print {
            body { width: 80mm; }
          }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-sm text-gray-900 dark:text-white">Preview Print</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal preview */}
        <div className="p-4 overflow-y-auto max-h-96">
          <div
            ref={printRef}
            className="font-mono text-xs bg-white text-black p-3 border border-gray-200 rounded"
            style={{ width: '100%', maxWidth: '300px', margin: '0 auto' }}
          >
            {/* Header */}
            <div className="text-center font-bold text-sm mb-1">DAILY PREP ORDER</div>
            <div className="text-center text-xs mb-2">{dpo.branch_name}</div>
            <div className="border-t border-dashed border-black my-2" />

            <div className="flex justify-between text-xs mb-0.5">
              <span>No</span>
              <span className="font-bold">{dpo.dpo_number}</span>
            </div>
            <div className="flex justify-between text-xs mb-0.5">
              <span>Tgl Operasional</span>
              <span>{fmtDate(dpo.prep_date)}</span>
            </div>
            <div className="flex justify-between text-xs mb-0.5">
              <span>Dari</span>
              <span>{dpo.source_warehouse_name}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span>Ke</span>
              <span>{dpo.target_warehouse_name}</span>
            </div>

            {dpo.has_upcoming_holiday && (
              <>
                <div className="border-t border-dashed border-black my-2" />
                <div className="text-center text-xs">⚠️ HARI LIBUR - qty sudah disesuaikan</div>
              </>
            )}

            <div className="border-t border-dashed border-black my-2" />
            <div className="text-xs font-bold mb-1">DAFTAR AMBIL BARANG:</div>

            {/* Lines */}
            {activeLines.map((line, idx) => (
              <div key={line.id} className="mb-2">
                <div className="text-xs font-bold">{idx + 1}. {line.product_name}</div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">
                    Ready: {fmt(line.live_ready_stock ?? line.current_ready_stock)} {line.base_unit_name}
                  </span>
                  <span className="font-bold">
                    AMBIL: {fmt(line.confirmed_qty ?? line.suggested_qty)} {line.base_unit_name}
                  </span>
                </div>
                {line.notes && (
                  <div className="text-xs text-gray-500 italic">* {line.notes}</div>
                )}
              </div>
            ))}

            <div className="border-t border-dashed border-black my-2" />

            {/* Signature area */}
            <div className="text-xs mb-3">
              <div className="flex justify-between mb-4">
                <div>
                  <div>Diambil oleh:</div>
                  <div className="mt-6 border-t border-black w-24">__________</div>
                </div>
                <div>
                  <div>Diserahkan oleh:</div>
                  <div className="mt-6 border-t border-black w-24">__________</div>
                </div>
              </div>
            </div>

            <div className="border-t border-dashed border-black my-2" />
            <div className="text-center text-xs text-gray-500">
              {new Date().toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-sm font-semibold hover:opacity-90"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  )
}