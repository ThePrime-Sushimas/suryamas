import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, ClipboardList } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/axios'
import { usePrinters } from '@/features/printers/api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'

interface SummaryBranch {
  branch_id: string
  branch_name: string
  qty: number
  qty_approved: number
}

interface SummaryItem {
  product_id: string
  product_code: string
  product_name: string
  uom: string
  base_unit_name: string | null
  conversion_factor: number | null
  total_qty: number
  total_qty_approved: number
  request_count: number
  branches: SummaryBranch[]
}

export default function ProductionRequestSummaryPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedPrinter, setSelectedPrinter] = useState('')

  const { data: printers = [] } = usePrinters()

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['production-requests', 'summary', dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const { data } = await api.get('/production-requests/summary', { params })
      return data.data as SummaryItem[]
    },
    staleTime: 30_000,
  })

  const printMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPrinter) throw new Error('Pilih printer dulu')
      await api.post('/printers/print/production-request-summary', {
        printer_id: selectedPrinter,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
    },
    onSuccess: () => toast.success('Print job terkirim'),
    onError: (err) => toast.error(parseApiError(err, 'Gagal print')),
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/food-production/production-requests')}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Rekap Request Produksi</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total batch yang harus diproduksi central dari seluruh cabang</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedPrinter} onChange={e => setSelectedPrinter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
              <option value="">Pilih Printer...</option>
              {printers.map(p => <option key={p.id} value={p.id}>{p.printer_name}</option>)}
            </select>
            <button
              onClick={() => printMutation.mutate()}
              disabled={!selectedPrinter || summary.length === 0 || printMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {printMutation.isPending ? 'Printing...' : 'Print'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Filter tanggal:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
          <span className="text-gray-400">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-xs text-gray-500 hover:text-gray-700">Reset</button>
          )}
          <span className="ml-auto text-sm text-gray-500">
            Status: <span className="font-medium text-gray-900 dark:text-white">DRAFT + ACCEPTED</span>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
        ) : summary.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <ClipboardList className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Tidak ada request produksi pending</p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.map(item => (
                <div key={item.product_id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{item.product_name}</h3>
                      <p className="text-xs text-gray-400">{item.product_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{item.total_qty}</p>
                      <p className="text-xs text-gray-500">{item.uom}</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700/60 pt-2 space-y-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Per Cabang:</p>
                    {item.branches.map((b, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-300">{b.branch_name}</span>
                        <span className="font-mono text-gray-900 dark:text-white">{b.qty} {item.uom}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Total footer */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                {summary.length} produk • {summary.reduce((s, i) => s + i.request_count, 0)} request dari cabang
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
