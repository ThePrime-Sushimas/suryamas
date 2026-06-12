import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import api from '@/lib/axios'

interface ProductOption {
  id: string
  product_code: string
  product_name: string
}

interface ProductSearchSelectProps {
  value?: string // untuk controlled reset dari parent
  onChange: (productId: string) => void
  onClear: () => void
  placeholder?: string
}

export default function ProductSearchSelect({ value, onChange, onClear, placeholder = 'Cari produk...' }: ProductSearchSelectProps) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ProductOption[]>([])
  const [selectedLabel, setSelectedLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounced = useDebounce(input, 300)
  const isTyping = input !== debounced

  // Controlled reset — when parent clears the value, reset internal state
  useEffect(() => {
    if (!value) {
      setSelectedLabel('')
      setInput('')
      setItems([])
    }
  }, [value])

  // Fetch products on search
  useEffect(() => {
    if (!debounced || debounced.length < 2) {
      setItems([])
      setError(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    api.get('/products/search', { params: { q: debounced, limit: 15 } })
      .then(res => {
        if (!cancelled) setItems(res.data.data ?? [])
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debounced])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (item: ProductOption) => {
    setSelectedLabel(`${item.product_code} - ${item.product_name}`)
    setInput('')
    setOpen(false)
    onChange(item.id)
  }

  const handleClear = () => {
    setSelectedLabel('')
    setInput('')
    setItems([])
    onClear()
  }

  return (
    <div ref={ref} className="relative w-full sm:w-64">
      {selectedLabel ? (
        <div className="flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="truncate flex-1">{selectedLabel}</span>
          <button onClick={handleClear} className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setOpen(true) }}
            onFocus={() => { if (input.length >= 2) setOpen(true) }}
            placeholder={placeholder}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400"
          />
        </div>
      )}

      {open && !selectedLabel && (input.length >= 2 || items.length > 0) && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {error ? (
            <div className="px-3 py-2 text-sm text-red-500 text-center">Gagal memuat produk</div>
          ) : isTyping || loading ? (
            <div className="px-3 py-2 text-sm text-gray-400 text-center">Mencari...</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400 text-center">Tidak ditemukan</div>
          ) : (
            items.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="font-medium">{item.product_name}</span>
                <span className="text-gray-400 ml-2 text-xs">{item.product_code}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}