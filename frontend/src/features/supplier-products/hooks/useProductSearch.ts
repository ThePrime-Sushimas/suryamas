import { useState, useEffect } from 'react'
import { productsApi } from '@/features/products/api/products.api'
import type { Product } from '@/features/products/types'
import { useDebounce } from '@/hooks/_shared/useDebounce'

interface ProductOption {
  id: string
  product_name: string
  product_code: string
}

export function useProductSearch() {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    const controller = new AbortController()
    
    const loadProducts = async () => {
      setLoading(true)
      try {
        const res = await productsApi.search(debouncedSearch, 1, 50)
        setProducts(res.data.map((p: Product) => ({
          id: p.id,
          product_name: p.product_name,
          product_code: p.product_code
        })))
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError' && err.name !== 'CanceledError') {
          console.error('Failed to load products:', err)
        }
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
    return () => controller.abort()
  }, [debouncedSearch])

  return { search, setSearch, products, loading }
}
