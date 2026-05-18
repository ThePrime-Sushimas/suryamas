/**
 * Keep in sync with backend/src/utils/marketplace-supplier.util.ts
 * and marketplace-po pending-po-lines ILIKE filters.
 */
export function isMarketplaceSupplierName(supplierName: string | null | undefined): boolean {
  if (!supplierName) return false
  const n = supplierName.toLowerCase()
  return n.includes('shopee') || n.includes('tokped') || n.includes('tokopedia')
}

export function isOrphanMarketplaceGr(gr: {
  status: string
  source?: string | null
  supplier_name: string
}): boolean {
  return (
    gr.status === 'DRAFT' &&
    isMarketplaceSupplierName(gr.supplier_name) &&
    gr.source !== 'MARKETPLACE'
  )
}
