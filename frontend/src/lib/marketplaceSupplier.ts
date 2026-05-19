export type InvoiceBypassReason = 'marketplace' | 'cash' | 'informal'

export function isMarketplaceSupplier(
  supplier: { invoice_bypass_reason?: InvoiceBypassReason | null } | null | undefined,
): boolean {
  return supplier?.invoice_bypass_reason === 'marketplace'
}

/** Legacy name match until supplier is flagged in DB (backfill / supplier form). */
function isMarketplaceSupplierNameLegacy(supplierName: string | null | undefined): boolean {
  if (!supplierName) return false
  const n = supplierName.toLowerCase()
  return n.includes('shopee') || n.includes('tokped') || n.includes('tokopedia')
}

/** Mirrors backend SQL_SUPPLIER_ELIGIBLE_FOR_PI for dropdowns. */
export function isSupplierEligibleForPurchaseInvoice(supplier: {
  supplier_name?: string
  requires_invoice?: boolean
  invoice_bypass_reason?: InvoiceBypassReason | null
}): boolean {
  if (supplier.requires_invoice === false) return false
  if (isMarketplaceSupplier(supplier)) return false
  if (!supplier.invoice_bypass_reason && isMarketplaceSupplierNameLegacy(supplier.supplier_name)) {
    return false
  }
  return true
}

export function isOrphanMarketplaceGr(gr: {
  status: string
  source?: string | null
  invoice_bypass_reason?: InvoiceBypassReason | null
}): boolean {
  return (
    gr.status === 'DRAFT' &&
    isMarketplaceSupplier(gr) &&
    gr.source !== 'MARKETPLACE'
  )
}
