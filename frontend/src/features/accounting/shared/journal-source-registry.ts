/**
 * Single source of truth for journal source_module metadata.
 *
 * When adding a new module that creates journals, add an entry here.
 * Search: grep -r "source_module:" backend/src/modules to find all producers.
 */
export const JOURNAL_SOURCE_REGISTRY: Record<string, {
  label: string
  routePrefix?: string // undefined = no detail page available
}> = {
  purchase_invoices:        { label: 'Faktur Beli',   routePrefix: '/inventory/purchase-invoices' },
  general_invoices:         { label: 'Invoice Umum',  routePrefix: '/finance/general-invoices' },
  general_invoice_payments: { label: 'Bayar Invoice' },
  ap_payments:              { label: 'Bayar AP',      routePrefix: '/finance/ap-payments' },
  marketplace_po:           { label: 'Marketplace',   routePrefix: '/inventory/marketplace-po' },
  POS_AGGREGATES:           { label: 'POS',           routePrefix: '/pos-sync-aggregates' },
  BANK_RECONCILIATION:      { label: 'Bank',          routePrefix: '/bank-reconciliation/settlement-groups' },
  stock_adjustments:        { label: 'Stok Opname',   routePrefix: '/inventory/stock-adjustments' },
  FISCAL_CLOSING:           { label: 'Tutup Buku' },
}

/** Get display label for a source_module */
export function getSourceLabel(sourceModule: string | null): string {
  if (!sourceModule) return ''
  return JOURNAL_SOURCE_REGISTRY[sourceModule]?.label ?? sourceModule
}

/** Get detail page URL for a journal line's reference, or null if not linkable */
export function getSourceRefLink(sourceModule: string | null, referenceId: string | null): string | null {
  if (!sourceModule || !referenceId) return null
  const prefix = JOURNAL_SOURCE_REGISTRY[sourceModule]?.routePrefix
  if (!prefix) return null
  return `${prefix}/${referenceId}`
}
