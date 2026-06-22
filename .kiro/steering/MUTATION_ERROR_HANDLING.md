# Mutation Error Handling Convention (Frontend)

## Golden Rule

Setiap `useMutation` WAJIB memiliki `onError` handler yang didefinisikan **di dalam definisi mutation** (Pola A). Error handling TIDAK boleh hanya bergantung pada call site (`mutateAsync` + try/catch) atau axios interceptor.

## Pola yang BENAR (Pola A) — Wajib

```typescript
// features/{feature}/api/{feature}.api.ts
export const useCreateSomething = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (body: CreateDto) => {
      const { data } = await api.post('/endpoint', body)
      return data.data as Something
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['something'] }),
    onError: (err) => toast.error(parseApiError(err, 'Gagal membuat data')),
  })
}
```

### Kenapa Pola A:
- Error handling terpusat di satu tempat (API file)
- Call site lebih bersih — cukup `mutation.mutate(payload)`
- Tidak mungkin lupa handle error di salah satu call site
- Fallback message selalu dalam Bahasa Indonesia

## Pola yang DILARANG

### Pola B — try/catch di call site (JANGAN)

```typescript
// ❌ SALAH: error handling di page component
const handleSubmit = async () => {
  try {
    await createMutation.mutateAsync(payload)
    toast.success('Berhasil')
  } catch (err) {
    toast.error(parseApiError(err, 'Gagal'))
  }
}
```

### Pola C — onError di call site (JANGAN)

```typescript
// ❌ SALAH: error handling di .mutate() options
mutation.mutate(payload, {
  onError: (err) => toast.error(parseApiError(err, 'Gagal')),
})
```

## Pengecualian

`mutateAsync` BOLEH digunakan di call site **hanya** jika butuh:
- Return value dari mutation untuk logic selanjutnya
- Sequential chaining (aksi kedua bergantung hasil pertama)
- Navigate setelah sukses dengan data dari response

Dalam kasus ini, `onError` tetap WAJIB ada di definisi mutation. Call site boleh tambah try/catch untuk flow control tapi TIDAK untuk toast (sudah di-handle oleh onError di definisi).

```typescript
// ✅ OK: mutateAsync untuk sequential logic, tapi onError tetap di definisi
export const useCreateOrder = () => {
  const toast = useToast()
  return useMutation({
    mutationFn: ...,
    onError: (err) => toast.error(parseApiError(err, 'Gagal membuat order')),
  })
}

// Di page: mutateAsync untuk navigate, tanpa catch untuk toast
const handleCreate = async () => {
  const result = await createOrder.mutateAsync(payload)
  navigate(`/orders/${result.id}`)  // ← butuh result.id
}
```

## Imports yang Diperlukan

```typescript
import { parseApiError } from '@/lib/errorParser'
import { useToast } from '@/contexts/ToastContext'
```

## Fallback Message Convention

- Selalu dalam **Bahasa Indonesia**
- Format: `'Gagal {verb} {noun}'`
- Contoh:
  - `'Gagal membuat purchase request'`
  - `'Gagal memperbarui data'`
  - `'Gagal menghapus penerimaan barang'`
  - `'Gagal mengupload lampiran'`
  - `'Gagal mengekspor laporan'`

## Safety Net (Sudah Tersedia)

Meskipun Pola A wajib, sistem punya 2 layer safety net:

1. **Axios interceptor** (`lib/axios.ts`) — auto-toast untuk HTTP 400/403/404(non-GET)/409/422/429/5xx
2. **QueryClient global onError** (`App.tsx`) — log untuk status yang tidak ditangkap interceptor

Safety net ini BUKAN alasan untuk skip `onError` di mutation. Mereka ada sebagai fallback jika ada mutation yang terlewat.

## File yang Perlu Migrasi (Existing Code)

API files berikut masih belum punya `onError` di semua mutations dan perlu dimigrasi secara bertahap:

- `ap-payments/api/apPayments.api.ts` (18 mutations)
- `branches/api/branches.api.ts` (5)
- `cash-flow/api/useCashFlowApi.ts` (8)
- `categories/api/categories.api.ts` (12)
- `companies/api/companies.api.ts` (4)
- `daily-prep-orders2/api/dailyPrepOrders.api.ts` (12)
- `daily-stock-opname/api/dailyStockOpname.ts` (15 remaining)
- `expense-categorization/api/expense-categorization.api.ts` (8)
- `fixed-assets/api/fixed-assets.api.ts` (20)
- `food-production/api/food-production.api.ts` (27)
- `general-invoices/api/generalApi.api.ts` (23)
- `goods-processing/api/goodsProcessing.api.ts` (11)
- `inventory/api/inventory.api.ts` (8)
- `marketplace-po/api/marketplacePo.api.ts` (19)
- `metric_units/api/metricUnits.api.ts` (5)
- `monthly-stock-opname/api/monthlyStockOpname.ts` (10)
- `notifications/api/notifications.api.ts` (2)
- `payment-terms/api/paymentTerms.api.ts` (5)
- `pricelists/api/pricelists.api.ts` (6)
- `printers/api/index.ts` (10)
- `product-uoms/api/productUoms.api.ts` (5)
- `production-requests/api/productionRequests.api.ts` (8)
- `products/api/products.api.ts` (7)
- `purchase-invoices/api/purchaseInvoices.api.ts` (11)
- `settings/api/settings.api.ts` (10)
- `shortage-report/api/shortageReport.api.ts` (4)
- `stock-adjustments/api/stockAdjustments.api.ts` (6)
- `stock-transfers/api/stockTransfers.api.ts` (7)
- `supplier-products/api/supplierProducts.api.ts` (5)
- `suppliers/api/suppliers.api.ts` (5)
