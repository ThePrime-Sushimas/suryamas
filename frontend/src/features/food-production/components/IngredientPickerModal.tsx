import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, X, Package, Layers } from 'lucide-react'
import type { ProductOption } from '../api/food-production.api'
import type { WipItem } from '../types/food-production.types'

interface IngredientPickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (value: string) => void // "product:<id>" or "wip:<id>"
  products: ProductOption[]
  wipItems: WipItem[]
  currentValue?: string // to highlight current selection
}

export function IngredientPickerModal({ open, onClose, onSelect, products, wipItems, currentValue }: IngredientPickerModalProps) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setSearch(''); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  const q = search.toLowerCase().trim()

  const filteredProducts = useMemo(() => {
    if (!q) return products.slice(0, 50)
    return products.filter(p =>
      p.product_code.toLowerCase().includes(q) || p.product_name.toLowerCase().includes(q)
    ).slice(0, 50)
  }, [products, q])

  const filteredWip = useMemo(() => {
    if (!q) return wipItems.slice(0, 30)
    return wipItems.filter(w =>
      w.wip_code.toLowerCase().includes(q) || w.wip_name.toLowerCase().includes(q)
    ).slice(0, 30)
  }, [wipItems, q])

  const handleSelect = (value: string) => {
    onSelect(value)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari bahan baku atau WIP..."
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
          />
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 p-2">
          {/* WIP Section */}
          {filteredWip.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <Layers className="w-3 h-3" /> WIP (Setengah Jadi)
              </p>
              {filteredWip.map(w => (
                <button key={w.id} onClick={() => handleSelect(`wip:${w.id}`)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                    currentValue === `wip:${w.id}` ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-300' : ''
                  }`}>
                  <div>
                    <span className="font-mono text-xs text-gray-500 mr-2">{w.wip_code}</span>
                    <span className="text-gray-900 dark:text-white">{w.wip_name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{w.uom}</span>
                </button>
              ))}
            </div>
          )}

          {/* Products Section */}
          {filteredProducts.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <Package className="w-3 h-3" /> Bahan Baku
              </p>
              {filteredProducts.map(p => (
                <button key={p.id} onClick={() => handleSelect(`product:${p.id}`)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                    currentValue === `product:${p.id}` ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-300' : ''
                  }`}>
                  <div>
                    <span className="font-mono text-xs text-gray-500 mr-2">{p.product_code}</span>
                    <span className="text-gray-900 dark:text-white">{p.product_name}</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{p.average_cost > 0 ? `Rp ${new Intl.NumberFormat('id-ID').format(p.average_cost)}` : ''}</span>
                </button>
              ))}
            </div>
          )}

          {filteredProducts.length === 0 && filteredWip.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">Tidak ditemukan bahan dengan kata kunci "{search}"</p>
          )}
        </div>
      </div>
    </div>
  )
}
