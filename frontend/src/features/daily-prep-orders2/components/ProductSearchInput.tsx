import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import api from '@/lib/axios'

interface ProductResult {
  id: string
  product_code: string
  product_name: string
  station: string | null
  base_unit_name: string | null
}

interface ProductSearchInputProps {
  onSelect: (product: ProductResult) => void
  excludeProductIds?: string[]
  stationFilter?: string[]
  placeholder?: string
}

export function ProductSearchInput({
  onSelect,
  excludeProductIds = [],
  stationFilter,
  placeholder = 'Cari produk...',
}: ProductSearchInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    try {
      const params: Record<string, unknown> = { q, limit: 10, status: 'ACTIVE' }
      if (stationFilter && stationFilter.length > 0) {
        params.station = stationFilter.join(',')
      }
      const { data } = await api.get('/products/search', { params })
      const products = (data.data || []) as ProductResult[]
      // Filter out already-added products
      const filtered = products.filter(p => !excludeProductIds.includes(p.id))
      setResults(filtered)
      setIsOpen(true)
      setHighlightIndex(-1)
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [excludeProductIds, stationFilter])

  const handleInputChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchProducts(value), 350)
  }

  const handleSelect = (product: ProductResult) => {
    onSelect(product)
    setQuery('')
    setResults([])
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault()
      handleSelect(results[highlightIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true) }}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setIsOpen(false) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500">Mencari...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">Tidak ditemukan</div>
          ) : (
            results.map((product, idx) => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleSelect(product)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  idx === highlightIndex
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{product.product_name}</span>
                    <span className="ml-2 text-xs text-gray-500 font-mono">{product.product_code}</span>
                  </div>
                  {product.station && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {product.station}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
