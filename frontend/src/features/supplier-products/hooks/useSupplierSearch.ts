import { useState, useEffect } from 'react'
import { suppliersApi } from '@/features/suppliers/api/suppliers.api'
import type { Supplier } from '@/features/suppliers/types/supplier.types'
import { useDebounce } from '@/hooks/_shared/useDebounce'

interface SupplierOption {
  id: string
  supplier_name: string
  supplier_code: string
}

export function useSupplierSearch() {
  const [search, setSearch] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    const controller = new AbortController()
    
    const loadSuppliers = async () => {
      setLoading(true)
      try {
        const res = await suppliersApi.list({ 
          search: debouncedSearch, 
          is_active: true, 
          limit: 50 
        }, controller.signal)
        setSuppliers(res.data.map((s: Supplier) => ({
          id: s.id,
          supplier_name: s.supplier_name,
          supplier_code: s.supplier_code
        })))
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError' && err.name !== 'CanceledError') {
          console.error('Failed to load suppliers:', err)
        }
      } finally {
        setLoading(false)
      }
    }

    loadSuppliers()
    return () => controller.abort()
  }, [debouncedSearch])

  return { search, setSearch, suppliers, loading }
}
