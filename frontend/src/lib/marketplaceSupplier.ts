export type InvoiceBypassReason = 'marketplace' | 'cash' | 'informal'

export function isMarketplaceSupplier(
  supplier: { invoice_bypass_reason?: InvoiceBypassReason | null } | null | undefined,
): boolean {
  return supplier?.invoice_bypass_reason === 'marketplace'
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
