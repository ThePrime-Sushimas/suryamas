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
