import { useState, useEffect, useRef } from 'react'
import { X, Search, Package } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import api from '@/lib/axios'

interface WipSaucePickerProps {
  open: boolean
  onClose: () => void
  onSelect: (wip: { id: string; wip_code: string; wip_name: string; yield_qty: number; uom: string }) => void
  excludeWipIds: string[]
}

interface WipRow {
  id: string
  wip_code: string
  wip_name: string
  uom: string
  yield_qty: number
  is_active: boolean
  output_warehouse: string
}

export function WipSaucePickerModal({ open, onClose, onSelect, excludeWipIds }: WipSaucePickerProps) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50)
      setSearch('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Fetch all active WIP items with output_warehouse = FINISHED_GOODS
  // No position filter — any user with production_requests permission can see these
  const { data: allWipItems = [], isLoading } = useQuery({
    queryKey: ['wip-items', 'finished-goods-picker'],
    queryFn: async () => {
      const { data } = await api.get('/wip-items', {
        params: { limit: '200', is_active: 'true' }
      })
      // Client-side filter for FINISHED_GOODS output only
      return (data.data as WipRow[]).filter(w => w.output_warehouse === 'FINISHED_GOODS')
    },
    enabled: open,
    staleTime: 60_000,
  })

  // Client-side search filter
  const wipItems = debouncedSearch
    ? allWipItems.filter(w =>
        w.wip_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        w.wip_code.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : allWipItems

  const handleSelect = (w: WipRow) => {
    if (excludeWipIds.includes(w.id)) return
    onSelect({
      id: w.id,
      wip_code: w.wip_code,
      wip_name: w.wip_name,
      yield_qty: w.yield_qty,
      uom: w.uom,
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="relative flex flex-col w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pilih WIP Sauce</h3>
            <p className="text-xs text-gray-500 mt-0.5">WIP dengan output Finished Goods</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama WIP..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* WIP list */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                </div>
              ))}
            </div>
          ) : wipItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Package className="w-10 h-10 opacity-40 mb-2" />
              <p className="text-sm">{debouncedSearch ? 'Tidak ada WIP cocok dengan pencarian' : 'Tidak ada WIP Finished Goods'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left px-5 py-2.5">WIP</th>
                  <th className="text-right px-4 py-2.5">Hasil/Batch</th>
                  <th className="text-left px-4 py-2.5">UOM</th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {wipItems.map(w => {
                  const excluded = excludeWipIds.includes(w.id)
                  return (
                    <tr key={w.id}
                      className={`transition-colors ${excluded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer'}`}
                      onClick={() => !excluded && handleSelect(w)}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{w.wip_name}</div>
                        <div className="text-xs text-gray-400">{w.wip_code}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">{w.yield_qty}</td>
                      <td className="px-4 py-3 text-gray-500">{w.uom}</td>
                      <td className="px-4 py-3 text-right">
                        {!excluded ? (
                          <button onClick={e => { e.stopPropagation(); handleSelect(w) }}
                            className="px-3 py-1 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white">
                            Pilih
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Sudah dipilih</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <span>{wipItems.length > 0 ? `${wipItems.length} WIP ditampilkan` : ''}</span>
          <button onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}
