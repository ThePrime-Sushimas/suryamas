/**
 * Shopee / Tokopedia supplier name heuristic.
 * Keep in sync with:
 * - frontend/src/lib/marketplaceSupplier.ts
 * - marketplace-po.repository.ts findPendingPoLines (ILIKE filters)
 * When adding a platform (e.g. Lazada), update all three.
 */
export function isMarketplaceSupplierName(supplierName: string | null | undefined): boolean {
  if (!supplierName) return false
  const n = supplierName.toLowerCase()
  return n.includes('shopee') || n.includes('tokped') || n.includes('tokopedia')
}
