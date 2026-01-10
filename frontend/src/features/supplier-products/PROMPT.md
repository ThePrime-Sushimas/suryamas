# Comprehensive Frontend Prompt - Supplier Products Module

## Overview
Buatlah modul **Supplier Products** untuk frontend aplikasi inventory/procurement. Modul ini menghubungkan **Suppliers** dengan **Products**, memungkinkan pengelolaan harga, lead time, dan preferensi supplier untuk setiap produk.

---

## 1. API Endpoints

### Base URL
```
/api/v1/supplier-products
```

### Endpoints

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/supplier-products` | List dengan pagination & filtering | canView('supplier_products') |
| GET | `/supplier-products?supplier_id=uuid` | Filter by supplier | canView |
| GET | `/supplier-products?product_id=uuid` | Filter by product | canView |
| GET | `/supplier-products/:id` | Get by ID | canView |
| GET | `/supplier-products/supplier/:supplier_id` | Get all products for supplier | canView |
| GET | `/supplier-products/product/:product_id` | Get all suppliers for product | canView |
| GET | `/supplier-products/options/active` | Get active options for dropdown | canView |
| POST | `/supplier-products` | Create new | canInsert |
| PUT | `/supplier-products/:id` | Update | canUpdate |
| DELETE | `/supplier-products/:id` | Delete | canDelete |
| POST | `/supplier-products/bulk/delete` | Bulk delete | canDelete |

---

## 2. Query Parameters (GET /supplier-products)

```typescript
interface SupplierProductListQuery {
  page?: number          // Default: 1
  limit?: number         // Default: 10
  search?: string        // Search di related supplier/product name
  supplier_id?: string   // UUID - Filter by supplier
  product_id?: string    // UUID - Filter by product
  is_preferred?: boolean // Filter preferred suppliers
  is_active?: boolean    // Filter active status
  sort_by?: 'price' | 'lead_time_days' | 'min_order_qty' | 'created_at' | 'updated_at'
  sort_order?: 'asc' | 'desc'
}
```

### Response Format
```typescript
interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  message?: string
}
```

---

## 3. Data Types (TypeScript)

### SupplierProduct (Main Entity)
```typescript
export interface SupplierProduct {
  id: string                    // UUID
  supplier_id: string           // UUID - FK ke suppliers
  product_id: string            // UUID - FK ke products
  price: number                 // Decimal (2 places), min 0
  currency: string              // 'IDR' | 'USD' | 'EUR' | 'SGD' | 'MYR'
  lead_time_days: number | null // Integer, 0-365, nullable
  min_order_qty: number | null  // Decimal, min 0.01, nullable
  is_preferred: boolean         // Preferred supplier flag
  is_active: boolean            // Active status
  created_at: string            // ISO DateTime
  updated_at: string            // ISO DateTime
  deleted_at: string | null     // ISO DateTime or null
  created_by: string | null     // UUID
  updated_by: string | null     // UUID
}
```

### SupplierProductWithRelations (With Joins)
```typescript
export interface SupplierProductWithRelations extends SupplierProduct {
  supplier?: {
    id: string
    supplier_name: string
    supplier_code: string
    is_active: boolean
  }
  product?: {
    id: string
    product_name: string
    product_code: string
    product_type: 'raw' | 'semi_finished' | 'finished_goods'
    status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED'
  }
}
```

### CreateSupplierProductDto
```typescript
export interface CreateSupplierProductDto {
  supplier_id: string      // Required, UUID
  product_id: string       // Required, UUID
  price: number            // Required, min 0, max 999999999999
  currency?: string        // Optional, default 'IDR'
  lead_time_days?: number  // Optional, 0-365, nullable
  min_order_qty?: number   // Optional, min 0.01, nullable
  is_preferred?: boolean   // Optional, default false
  is_active?: boolean      // Optional, default true
}
```

### UpdateSupplierProductDto
```typescript
export interface UpdateSupplierProductDto {
  price?: number           // Optional, min 0
  currency?: string        // Optional
  lead_time_days?: number  // Optional, 0-365, nullable
  min_order_qty?: number   // Optional, min 0.01, nullable
  is_preferred?: boolean   // Optional
  is_active?: boolean      // Optional
}
```

### SupplierProductOption (Dropdown)
```typescript
export interface SupplierProductOption {
  id: string          // UUID
  supplier_name: string
  product_name: string
  price: number
  currency: string
}
```

---

## 4. Validation Rules

### Create Validation
```typescript
// supplier_id: Required, UUID format
// product_id: Required, UUID format
// price: Required, number, min 0, max 999999999999, max 2 decimal places
// currency: Optional, one of ['IDR', 'USD', 'EUR', 'SGD', 'MYR'], default 'IDR'
// lead_time_days: Optional, integer, 0-365, nullable
// min_order_qty: Optional, number, min 0.01, nullable
// is_preferred: Optional, boolean, default false
// is_active: Optional, boolean, default true
```

### Update Validation
- Minimal SATU field harus diisi
- Tidak bisa update supplier_id dan product_id (harus delete & create baru)

---

## 5. Error Messages & Codes

| Error Code | HTTP Status | Message | Handling |
|------------|-------------|---------|----------|
| SUPPLIER_PRODUCT_NOT_FOUND | 404 | `Supplier product with ID '{id}' not found` | Show 404 page or toast |
| DUPLICATE_SUPPLIER_PRODUCT | 409 | `Product '{product_id}' already exists for supplier '{supplier_id}'` | Show error toast, suggest edit |
| INVALID_SUPPLIER | 400 | `Supplier with ID '{id}' not found/inactive/deleted` | Show error, refresh supplier list |
| INVALID_PRODUCT | 400 | `Product with ID '{id}' not found/inactive/deleted` | Show error, refresh product list |
| INVALID_PRICE | 422 | `Price {price} is invalid. Must be between {min} and {max}` | Show field error |
| INVALID_CURRENCY | 422 | `Currency '{currency}' is not supported` | Show field error |
| BULK_OPERATION_LIMIT_EXCEEDED | 400 | `Cannot delete more than 100 items at once` | Show toast, limit selection |
| MAX_PREFERRED_SUPPLIERS_EXCEEDED | 422 | `Product '{product_id}' already has maximum 3 preferred suppliers` | Show info toast |

---

## 6. UI Components Specifications

### SupplierProductsPage (List Page)
```
┌─────────────────────────────────────────────────────────────┐
│  Supplier Products                              [+ Add New] │
├─────────────────────────────────────────────────────────────┤
│  [Search...] [Supplier ▾] [Product ▾] [Status ▾] [Filter]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Supplier    │ Product    │ Price  │ Lead │ Preferred│   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ PT ABC      │ Product X  │ 1500   │ 7    │ ★        │   │
│  │   XYZ Corp  │ Product Y  │ 2300   │ 3    │ -        │   │
│  │ ...         │ ...        │ ...    │ ...  │ ...      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [< Prev] 1 2 3 ... 10 [Next >]   Showing 1-10 of 100      │
│  [X] Selected: 5 [Bulk Delete]                              │
└─────────────────────────────────────────────────────────────┘
```

### Features:
- **Search**: Real-time search dengan debounce 300ms
- **Filters**: Supplier dropdown, Product dropdown, Preferred toggle, Active toggle
- **Table Columns**: 
  - Supplier (with code)
  - Product (with code)
  - Price + Currency formatted
  - Lead Time (days)
  - Min Order Qty
  - Preferred badge
  - Status toggle/indicator
  - Actions (Edit, View, Delete)
- **Bulk Actions**: Checkbox selection, bulk delete
- **Pagination**: Server-side pagination dengan page size options (10, 25, 50, 100)

### SupplierProductForm (Create/Edit)
```
┌──────────────────────────────────────────────────────────┐
│  [Create Supplier Product]          [X]                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Supplier * [Search/Select Supplier ▾]                   │
│  Product *    [Search/Select Product ▾]                  │
│                                                          │
│  Price *     [__________]  Currency [IDR ▾]             │
│                                                          │
│  Lead Time   [__________] days                           │
│  Min Order   [__________]                                │
│                                                          │
│  ☐ Preferred Supplier                                    │
│  ☑ Active                                               │
│                                                          │
│  [Cancel]                            [Save]              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Form Validation:
- **Supplier**: Required, load from suppliers API
- **Product**: Required, load from products API
- **Price**: Required, number, min 0, max 2 decimal places
- **Currency**: Select dropdown, default IDR
- **Lead Time**: Optional, integer 0-365
- **Min Order Qty**: Optional, number min 0.01
- **Preferred**: Optional checkbox, max 3 per product (show info if exceeded)
- **Active**: Checkbox, default true

### SupplierProductDetailPage
```
┌─────────────────────────────────────────────────────────────┐
│  Supplier Product Details                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Product: Product X (PROD-001)                              │
│  Supplier: PT ABC Supplier (SUP-001)                        │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Price           │  │ Currency        │                   │
│  │ Rp 1,500.00     │  │ IDR             │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Lead Time       │  │ Min Order Qty   │                   │
│  │ 7 days          │  │ 10 pcs          │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                             │
│  Status: 🟢 Active      Preferred: ⭐ Yes                   │
│                                                             │
│  Created: 2024-01-15 10:30  By: User A                     │
│  Updated: 2024-01-20 14:45  By: User B                     │
│                                                             │
│  [Edit]  [Delete]  [Back]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. API Layer Pattern (supplierProducts.api.ts)

```typescript
import api from '@/lib/axios'
import type { 
  SupplierProduct, 
  SupplierProductWithRelations,
  CreateSupplierProductDto, 
  UpdateSupplierProductDto,
  SupplierProductListQuery,
  SupplierProductOption,
  PaginationParams 
} from '../types/supplier-product.types'

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: PaginationParams
  message?: string
}

export const supplierProductsApi = {
  list: async (query: SupplierProductListQuery = {}) => {
    const params = buildQueryParams(query)
    const res = await api.get<PaginatedResponse<SupplierProductWithRelations>>('/supplier-products', { params })
    return res.data
  },

  getById: async (id: string, includeRelations = true) => {
    const res = await api.get<ApiResponse<SupplierProductWithRelations>>(`/supplier-products/${id}`, {
      params: { include_relations: includeRelations }
    })
    return res.data.data
  },

  getBySupplier: async (supplierId: string) => {
    const res = await api.get<ApiResponse<SupplierProductWithRelations[]>>(`/supplier-products/supplier/${supplierId}`)
    return res.data.data
  },

  getByProduct: async (productId: string) => {
    const res = await api.get<ApiResponse<SupplierProductWithRelations[]>>(`/supplier-products/product/${productId}`)
    return res.data.data
  },

  getActiveOptions: async () => {
    const res = await api.get<ApiResponse<SupplierProductOption[]>>('/supplier-products/options/active')
    return res.data.data
  },

  create: async (data: CreateSupplierProductDto) => {
    const res = await api.post<ApiResponse<SupplierProduct>>('/supplier-products', data)
    return res.data.data
  },

  update: async (id: string, data: UpdateSupplierProductDto) => {
    const res = await api.put<ApiResponse<SupplierProduct>>(`/supplier-products/${id}`, data)
    return res.data.data
  },

  delete: async (id: string) => {
    const res = await api.delete<ApiResponse<void>>(`/supplier-products/${id}`)
    return res.data
  },

  bulkDelete: async (ids: string[]) => {
    const res = await api.post<ApiResponse<void>>('/supplier-products/bulk/delete', { ids })
    return res.data
  }
}
```

---

## 8. Store Pattern (supplierProducts.store.ts)

```typescript
import { create } from 'zustand'
import { supplierProductsApi } from '../api/supplierProducts.api'
import type { 
  SupplierProduct, 
  SupplierProductWithRelations,
  CreateSupplierProductDto, 
  UpdateSupplierProductDto,
  SupplierProductListQuery,
  PaginationParams 
} from '../types/supplier-product.types'

interface SupplierProductsState {
  supplierProducts: SupplierProductWithRelations[]
  pagination: PaginationParams | null
  fetchLoading: boolean
  mutationLoading: boolean
  error: string | null
  currentQuery: SupplierProductListQuery | null
  selectedItems: string[]
  
  fetchSupplierProducts: (query?: SupplierProductListQuery, signal?: AbortSignal) => Promise<void>
  createSupplierProduct: (data: CreateSupplierProductDto) => Promise<SupplierProduct>
  updateSupplierProduct: (id: string, data: UpdateSupplierProductDto) => Promise<SupplierProduct>
  deleteSupplierProduct: (id: string) => Promise<void>
  bulkDeleteSupplierProducts: (ids: string[]) => Promise<void>
  setSelectedItems: (ids: string[]) => void
  clearError: () => void
}

export const useSupplierProductsStore = create<SupplierProductsState>((set, get) => ({
  supplierProducts: [],
  pagination: null,
  fetchLoading: false,
  mutationLoading: false,
  error: null,
  currentQuery: null,
  selectedItems: [],

  fetchSupplierProducts: async (query = {}, signal) => {
    set({ fetchLoading: true, error: null, currentQuery: query, selectedItems: [] })
    try {
      const res = await supplierProductsApi.list(query, signal)
      if (signal?.aborted) return
      set({ 
        supplierProducts: res.data, 
        pagination: res.pagination, 
        fetchLoading: false 
      })
    } catch (error) {
      if (signal?.aborted) return
      const message = parseErrorMessage(error)
      set({ error: message, fetchLoading: false })
    }
  },

  createSupplierProduct: async (data) => {
    set({ mutationLoading: true, error: null })
    try {
      const supplierProduct = await supplierProductsApi.create(data)
      set(state => ({
        supplierProducts: [...state.supplierProducts, supplierProduct],
        mutationLoading: false
      }))
      return supplierProduct
    } catch (error) {
      const message = parseErrorMessage(error)
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  updateSupplierProduct: async (id, data) => {
    set({ mutationLoading: true, error: null })
    try {
      const supplierProduct = await supplierProductsApi.update(id, data)
      set(state => ({
        supplierProducts: state.supplierProducts.map(sp => sp.id === id ? supplierProduct : sp),
        mutationLoading: false
      }))
      return supplierProduct
    } catch (error) {
      const message = parseErrorMessage(error)
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  deleteSupplierProduct: async (id) => {
    set({ mutationLoading: true, error: null })
    try {
      await supplierProductsApi.delete(id)
      set(state => ({
        supplierProducts: state.supplierProducts.filter(sp => sp.id !== id),
        selectedItems: state.selectedItems.filter(itemId => itemId !== id),
        mutationLoading: false
      }))
    } catch (error) {
      const message = parseErrorMessage(error)
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  bulkDeleteSupplierProducts: async (ids) => {
    set({ mutationLoading: true, error: null })
    try {
      await supplierProductsApi.bulkDelete(ids)
      set(state => ({
        supplierProducts: state.supplierProducts.filter(sp => !ids.includes(sp.id)),
        selectedItems: [],
        mutationLoading: false
      }))
    } catch (error) {
      const message = parseErrorMessage(error)
      set({ error: message, mutationLoading: false })
      throw error
    }
  },

  setSelectedItems: (ids) => set({ selectedItems: ids }),
  clearError: () => set({ error: null })
}))
```

---

## 9. Constants Pattern (supplier-product.constants.ts)

```typescript
export const CURRENCY_OPTIONS = [
  { value: 'IDR', label: 'IDR - Indonesian Rupiah' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'MYR', label: 'MYR - Malaysian Ringgit' },
] as const

export const CURRENCY_SYMBOLS: Record<string, string> = {
  IDR: 'Rp',
  USD: '$',
  EUR: '€',
  SGD: 'S$',
  MYR: 'RM'
}

export const LEAD_TIME_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: i,
  label: i === 0 ? 'Same day' : i === 1 ? '1 day' : `${i} days`
}))

export const SUPPLIER_PRODUCT_LIMITS = {
  MAX_PREFERRED_SUPPLIERS: 3,
  MAX_LEAD_TIME_DAYS: 365,
  MIN_PRICE: 0,
  MAX_PRICE: 999999999999,
  MIN_ORDER_QTY: 0.01,
  MAX_BULK_DELETE: 100,
} as const
```

---

## 10. Helper Functions Pattern

```typescript
// formatPrice.ts
export function formatPrice(price: number, currency: string = 'IDR'): string {
  const formatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
  return formatter.format(price)
}

// formatLeadTime.ts
export function formatLeadTime(days: number | null): string {
  if (days === null) return '-'
  if (days === 0) return 'Same day'
  if (days === 1) return '1 day'
  return `${days} days`
}

// parseErrorMessage.ts
export function parseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { 
      response?: { 
        data?: { 
          error?: string
          message?: string 
          code?: string
          details?: any
        } 
      } 
    }
    const err = apiError.response?.data
    
    // Handle specific error codes
    switch (err?.code) {
      case 'DUPLICATE_SUPPLIER_PRODUCT':
        return 'This product already has a price from this supplier. Please edit the existing record instead.'
      case 'MAX_PREFERRED_SUPPLIERS_EXCEEDED':
        return `A product can only have ${err.details?.max_allowed || 3} preferred suppliers. Please unselect another preferred supplier first.`
      case 'INVALID_SUPPLIER':
        return `Supplier is no longer active. Please select a different supplier.`
      case 'INVALID_PRODUCT':
        return `Product is no longer active. Please select a different product.`
      default:
        return err?.error || err?.message || 'An error occurred'
    }
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred'
}
```

---

## 11. Implementation Checklist

### Files to Create
- [ ] `types/supplier-product.types.ts` - All TypeScript interfaces
- [ ] `constants/supplier-product.constants.ts` - Constants & options
- [ ] `api/supplierProducts.api.ts` - API calls
- [ ] `store/supplierProducts.store.ts` - Zustand store
- [ ] `components/SupplierProductForm.tsx` - Create/Edit form
- [ ] `components/SupplierProductTable.tsx` - Table with actions
- [ ] `components/SupplierProductFilters.tsx` - Filter controls
- [ ] `pages/SupplierProductsPage.tsx` - Main list page
- [ ] `pages/CreateSupplierProductPage.tsx` - Create page
- [ ] `pages/EditSupplierProductPage.tsx` - Edit page
- [ ] `pages/SupplierProductDetailPage.tsx` - Detail page
- [ ] `utils/format.ts` - Formatting utilities
- [ ] `utils/errorParser.ts` - Error parsing utilities
- [ ] `index.ts` - Export all components

### Integration Steps
1. Add routes in `App.tsx`
2. Add to main menu navigation
3. Register permissions (if needed)
4. Add to breadcrumbs configuration
5. Test all CRUD operations
6. Test error scenarios
7. Test bulk operations
8. Test pagination & filtering

---

## 12. Style & Design Guidelines

- Use **Tailwind CSS** for styling (consistent with project)
- Follow existing component patterns from `SupplierForm.tsx`
- Use **Shadcn UI** components if available
- Support **dark mode** if implemented in project
- **Responsive design** - work on mobile & desktop
- **Loading states** - show skeleton or spinner during API calls
- **Error states** - show error boundaries and toast notifications
- **Empty states** - show helpful message when no data

---

## 13. Testing Requirements

### Unit Tests
- [ ] Form validation
- [ ] Store actions
- [ ] API error handling
- [ ] Utility functions

### Integration Tests
- [ ] Full CRUD flow
- [ ] Pagination
- [ ] Filtering
- [ ] Bulk operations
- [ ] Permission checks

---

## 14. Notes for Developer

1. **Dependensi**: Module ini bergantung pada `suppliers` dan `products` modules. Pastikan kedua modules sudah tersedia.

2. **Combo Validation**: Ketika create, sistem akan reject jika kombinasi supplier_id + product_id sudah ada. Show error message yang jelas dan suggest untuk edit.

3. **Preferred Supplier Limit**: Max 3 preferred suppliers per product. Jika user coba set >3, show info toast dan disable submit.

4. **Currency Display**: Always display currency code alongside price. Use formatPrice utility.

5. **Soft Delete**: Backend menggunakan soft delete. Deleted items tidak muncul di list default. Mungkin perlu option untuk view deleted items.

6. **Audit Fields**: Created_at, updated_at, created_by, updated_by displayed di detail page untuk transparency.

7. **Optimistic Updates**: Store bisa implement optimistic updates untuk better UX, tapi careful dengan error handling.

8. **Debounce**: Search input harus di-debounce (300ms) untuk avoid excessive API calls.

9. **Caching**: Consider implement client-side caching untuk supplier & product dropdown options.

10. **Accessibility**: Semua form inputs harus memiliki labels. Tables harus memiliki proper ARIA attributes.

---

## 15. Example Usage

```tsx
// List Page
import { useSupplierProductsStore } from './store/supplierProducts.store'
import { formatPrice } from './utils/format'

function SupplierProductsPage() {
  const { supplierProducts, fetchSupplierProducts, pagination } = useSupplierProductsStore()
  
  useEffect(() => {
    fetchSupplierProducts({ page: 1, limit: 10 })
  }, [])
  
  return (
    <div>
      <h1>Supplier Products</h1>
      <Table>
        {supplierProducts.map(sp => (
          <tr key={sp.id}>
            <td>{sp.supplier?.supplier_name}</td>
            <td>{sp.product?.product_name}</td>
            <td>{formatPrice(sp.price, sp.currency)}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
```

```tsx
// Create Form
import { SupplierProductForm } from './components/SupplierProductForm'

function CreateSupplierProductPage() {
  const { createSupplierProduct } = useSupplierProductsStore()
  
  const handleSubmit = async (data: CreateSupplierProductDto) => {
    await createSupplierProduct(data)
    navigate('/supplier-products')
  }
  
  return (
    <SupplierProductForm 
      onSubmit={handleSubmit}
      onCancel={() => navigate('/supplier-products')}
      submitLabel="Create"
    />
  )
}
```

---

**End of Prompt**

