// Supplier Product Filters - Filter controls component

import { useState, useEffect } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { suppliersApi } from '@/features/suppliers/api/suppliers.api'
import { productsApi } from '@/features/products/api/products.api'
import { PAGE_SIZE_OPTIONS } from '../constants/supplier-product.constants'
import type { Supplier } from '@/features/suppliers/types/supplier.types'
import type { Product } from '@/features/products/types'

interface SupplierProductFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  supplierId: string
  onSupplierChange: (value: string) => void
  productId: string
  onProductChange: (value: string) => void
  isPreferred: boolean | undefined
  onPreferredChange: (value: boolean | undefined) => void
  isActive: boolean | undefined
  onActiveChange: (value: boolean | undefined) => void
  includeDeleted: boolean
  onIncludeDeletedChange: (value: boolean) => void
  pageSize: number
  onPageSizeChange: (value: number) => void
  onReset: () => void
}

export function SupplierProductFilters({
  search,
  onSearchChange,
  supplierId,
  onSupplierChange,
  productId,
  onProductChange,
  isPreferred,
  onPreferredChange,
  isActive,
  onActiveChange,
  includeDeleted,
  onIncludeDeletedChange,
  pageSize,
  onPageSizeChange,
  onReset
}: SupplierProductFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Debounce search
  const debouncedSearch = useDebounce(localSearch, 300)
  if (debouncedSearch !== search) {
    onSearchChange(debouncedSearch)
  }

  // Load suppliers
  useEffect(() => {
    const loadSuppliers = async () => {
      setLoadingSuppliers(true)
      try {
        const res = await suppliersApi.list({ is_active: true, limit: 100 })
        setSuppliers(res.data)
      } catch (error) {
        console.error('Failed to load suppliers:', error)
      } finally {
        setLoadingSuppliers(false)
      }
    }
    loadSuppliers()
  }, [])

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true)
      try {
        const res = await productsApi.search('', 1, 100)
        setProducts(res.data)
      } catch (error) {
        console.error('Failed to load products:', error)
      } finally {
        setLoadingProducts(false)
      }
    }
    loadProducts()
  }, [])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value)
  }

  const handlePreferredChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    onPreferredChange(value === '' ? undefined : value === 'true')
  }

  const handleActiveChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    onActiveChange(value === '' ? undefined : value === 'true')
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            type="text"
            placeholder="Search supplier or product..."
            value={localSearch}
            onChange={handleSearchChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Supplier Filter */}
        <div className="min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
          <select
            value={supplierId}
            onChange={(e) => onSupplierChange(e.target.value)}
            disabled={loadingSuppliers}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.supplier_code} - {s.supplier_name}</option>
            ))}
          </select>
        </div>

        {/* Product Filter */}
        <div className="min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
          <select
            value={productId}
            onChange={(e) => onProductChange(e.target.value)}
            disabled={loadingProducts}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">All Products</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.product_code} - {p.product_name}</option>
            ))}
          </select>
        </div>

        {/* Preferred Filter */}
        <div className="w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Preferred</label>
          <select
            value={isPreferred === undefined ? '' : isPreferred.toString()}
            onChange={handlePreferredChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="true">Yes Only</option>
            <option value="false">No Only</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={isActive === undefined ? '' : isActive.toString()}
            onChange={handleActiveChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>

        {/* Page Size */}
        <div className="w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Show</label>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PAGE_SIZE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Include Deleted */}
        <div className="flex items-center pt-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => onIncludeDeletedChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Show deleted</span>
          </label>
        </div>

        {/* Reset Button */}
        <div>
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

