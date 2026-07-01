export const PURCHASE_INVOICES_LIST_PATH = '/inventory/purchase-invoices'

export type PurchaseInvoiceListTab = 'verify' | 'approval' | 'final'

export const PI_LIST_TAB_STATUS: Record<PurchaseInvoiceListTab, string> = {
  verify: 'DRAFT,REJECTED',
  approval: 'SUBMITTED',
  final: 'APPROVED,POSTED',
}

export const PI_LIST_TABS: { id: PurchaseInvoiceListTab; label: string; color: string }[] = [
  { id: 'verify', label: 'Antrean Verifikasi', color: 'indigo' },
  { id: 'approval', label: 'Menunggu Persetujuan', color: 'amber' },
  { id: 'final', label: 'Selesai & Posting', color: 'green' },
]

/** Literal Tailwind classes per tab color — safe for JIT (no dynamic string interpolation). */
export const PI_TAB_COLOR_CLASSES: Record<
  string,
  { tabActive: string; badgeActive: string }
> = {
  indigo: {
    tabActive:
      'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400',
    badgeActive: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30',
  },
  amber: {
    tabActive:
      'border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400',
    badgeActive: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
  },
  green: {
    tabActive:
      'border-green-600 text-green-600 dark:border-green-400 dark:text-green-400',
    badgeActive: 'bg-green-100 text-green-700 dark:bg-green-900/30',
  },
}
