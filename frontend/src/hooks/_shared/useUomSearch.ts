/**
 * UOM Search Hook
 * Provides debounced search for UOM selection for a specific product
 * 
 * @module hooks/_shared
 */

import { useState, useEffect } from 'react'
import { useDebounce } from './useDebounce'
import api from '@/lib/axios'

interface UOM {
  id: string
  metric_units: {
    id: string
    unit_name: string
    metric_type: string
  }
}

/**
 * Hook for searching UOMs for a specific product
 */
export function useUomSearch(productId: string) {
  const [search, setSearch] = useState('')
  const [uoms, setUoms] = useState<UOM[]>([])
  const [loading, setLoading] = useState(false)
  
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (!productId) return
    
    const controller = new AbortController()

    const fetchUoms = async () => {
      setLoading(true)
      try {
        const response = await api.get(`/products/${productId}/uoms`, {
          params: {
            includeDeleted: false
          },
          signal: controller.signal
        })
        
        if (!controller.signal.aborted) {
          const filteredUoms = (response.data.data || []).filter((uom: UOM) => 
            !debouncedSearch || 
            uom.metric_units?.unit_name?.toLowerCase().includes(debouncedSearch.toLowerCase())
          )
          setUoms(filteredUoms)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch UOMs:', error)
          setUoms([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchUoms()

    return () => controller.abort()
  }, [productId, debouncedSearch])

  return {
    search,
    setSearch,
    uoms,
    loading
  }
}