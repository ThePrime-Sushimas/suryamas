/**
 * Notification event catalog — registry doc: .amazonq/docs/NOTIFICATION_EVENTS_REGISTRY.md
 * Saat modul baru butuh notifikasi: tambah key + catalog entry + dispatch di service + update doc.
 */
import type { NotificationRow } from './notifications.types'

export const NOTIFICATION_EVENT_KEYS = {
  // Purchase Request
  PURCHASE_REQUEST_SUBMITTED: 'purchase_request.submitted',
  PURCHASE_REQUEST_APPROVED: 'purchase_request.approved',
  PURCHASE_REQUEST_REJECTED: 'purchase_request.rejected',
  // Purchase Order
  PURCHASE_ORDER_SUBMITTED: 'purchase_order.submitted',
  PURCHASE_ORDER_APPROVED: 'purchase_order.approved',
  PURCHASE_ORDER_SENT: 'purchase_order.sent',
  PURCHASE_ORDER_ORDERED: 'purchase_order.ordered',
  PURCHASE_ORDER_CANCELLED: 'purchase_order.cancelled',
  // Goods Receipt / Processing
  GOODS_RECEIPT_CONFIRMED: 'goods_receipt.confirmed',
  GOODS_PROCESSING_CONFIRMED: 'goods_processing.confirmed',
  GOODS_PROCESSING_REJECTED: 'goods_processing.rejected',
  // Purchase Invoice
  PURCHASE_INVOICE_SUBMITTED: 'purchase_invoice.submitted',
  PURCHASE_INVOICE_APPROVED: 'purchase_invoice.approved',
  PURCHASE_INVOICE_REJECTED: 'purchase_invoice.rejected',
  PURCHASE_INVOICE_POSTED: 'purchase_invoice.posted',
  // Pricelist
  PRICELIST_APPROVED: 'pricelist.approved',
  // Journal
  JOURNAL_SUBMITTED: 'journal.submitted',
  JOURNAL_APPROVED: 'journal.approved',
  JOURNAL_REJECTED: 'journal.rejected',
  JOURNAL_POSTED: 'journal.posted',
  // General Invoice
  GENERAL_INVOICE_REQUESTED: 'general_invoice.requested',
  // Daily Stock Opname
  OPNAME_SHORTAGE_ASSIGNED: 'opname.shortage_assigned',
  OPNAME_REOPEN_REQUESTED: 'opname.reopen_requested',
  // Production Request (Request Sauce)
  PRODUCTION_REQUEST_CREATED: 'production_request.created',
  PRODUCTION_REQUEST_ACCEPTED: 'production_request.accepted',
  PRODUCTION_REQUEST_RECEIVED: 'production_request.received',
  PRODUCTION_REQUEST_CANCELLED: 'production_request.cancelled',
  // Asset Request
  ASSET_REQUEST_SUBMITTED: 'asset_request.submitted',
  ASSET_REQUEST_APPROVED: 'asset_request.approved',
  ASSET_REQUEST_REJECTED: 'asset_request.rejected',
} as const

export type NotificationEventKey = (typeof NOTIFICATION_EVENT_KEYS)[keyof typeof NOTIFICATION_EVENT_KEYS]

export interface NotificationEventDefinition {
  event_key: NotificationEventKey
  label: string
  description: string
  category: NotificationRow['category']
  default_type: NotificationRow['type']
  default_title_template: string
  default_message_template: string
  default_redirect_url_template: string
}

export const NOTIFICATION_EVENT_CATALOG: NotificationEventDefinition[] = [
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_REQUEST_SUBMITTED,
    label: 'PR diajukan',
    description: 'Purchase Request menunggu approval (PENDING_APPROVAL)',
    category: 'purchase_request',
    default_type: 'approval_required',
    default_title_template: 'PR menunggu approval',
    default_message_template: '{{request_number}} dari {{branch_name}} menunggu review.',
    default_redirect_url_template: '/inventory/pr-approval',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_REQUEST_APPROVED,
    label: 'PR disetujui',
    description: 'PR di-approve dan PO dibuat (CONVERTED)',
    category: 'purchase_request',
    default_type: 'success',
    default_title_template: 'PR disetujui',
    default_message_template: '{{request_number}} telah disetujui dan PO dibuat.',
    default_redirect_url_template: '/inventory/purchase-requests/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_REQUEST_REJECTED,
    label: 'PR ditolak',
    description: 'PR ditolak oleh approver',
    category: 'purchase_request',
    default_type: 'warning',
    default_title_template: 'PR ditolak',
    default_message_template: '{{request_number}} ditolak. Alasan: {{rejected_reason}}',
    default_redirect_url_template: '/inventory/purchase-requests/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_SUBMITTED,
    label: 'PO diajukan',
    description: 'Purchase Order submit untuk approval (PENDING_APPROVAL)',
    category: 'purchase_order',
    default_type: 'approval_required',
    default_title_template: 'PO menunggu approval',
    default_message_template: '{{po_number}} menunggu persetujuan.',
    default_redirect_url_template: '/inventory/purchase-orders/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_APPROVED,
    label: 'PO disetujui',
    description: 'PO disetujui — siap dikirim ke supplier',
    category: 'purchase_order',
    default_type: 'success',
    default_title_template: 'PO disetujui',
    default_message_template: '{{po_number}} telah disetujui.',
    default_redirect_url_template: '/inventory/purchase-orders/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_SENT,
    label: 'PO dikirim ke supplier',
    description: 'Stock Keeper menandai PO terkirim (SENT) — Purchasing review',
    category: 'purchase_order',
    default_type: 'info',
    default_title_template: 'PO dikirim',
    default_message_template: '{{po_number}} sudah dikirim. Sesuaikan terms sebelum order.',
    default_redirect_url_template: '/inventory/purchase-orders/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_ORDERED,
    label: 'PO dikonfirmasi order',
    description: 'Purchasing konfirmasi order ke supplier (ORDERED)',
    category: 'purchase_order',
    default_type: 'success',
    default_title_template: 'PO sudah di-order',
    default_message_template: '{{po_number}} telah dikonfirmasi ke supplier.',
    default_redirect_url_template: '/inventory/purchase-orders/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_CANCELLED,
    label: 'PO dibatalkan',
    description: 'Purchase Order dibatalkan',
    category: 'purchase_order',
    default_type: 'warning',
    default_title_template: 'PO dibatalkan',
    default_message_template: '{{po_number}} dibatalkan. Alasan: {{cancelled_reason}}',
    default_redirect_url_template: '/inventory/purchase-orders/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.GOODS_RECEIPT_CONFIRMED,
    label: 'GR dikonfirmasi',
    description: 'Goods Receipt dikonfirmasi (stok + GP draft)',
    category: 'inventory',
    default_type: 'info',
    default_title_template: 'GR dikonfirmasi',
    default_message_template: '{{gr_number}} telah dikonfirmasi.',
    default_redirect_url_template: '/inventory/goods-receipts/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.GOODS_PROCESSING_CONFIRMED,
    label: 'GP dikonfirmasi',
    description: 'Goods Processing selesai dikonfirmasi',
    category: 'inventory',
    default_type: 'info',
    default_title_template: 'GP dikonfirmasi',
    default_message_template: '{{processing_number}} telah dikonfirmasi.',
    default_redirect_url_template: '/inventory/goods-processing/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.GOODS_PROCESSING_REJECTED,
    label: 'GP ditolak',
    description: 'Goods Processing ditolak',
    category: 'inventory',
    default_type: 'warning',
    default_title_template: 'GP ditolak',
    default_message_template: '{{processing_number}} ditolak. Alasan: {{rejection_reason}}',
    default_redirect_url_template: '/inventory/goods-processing/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_SUBMITTED,
    label: 'Faktur diajukan',
    description: 'Purchase Invoice submit untuk approval',
    category: 'purchase_invoice',
    default_type: 'approval_required',
    default_title_template: 'Faktur menunggu approval',
    default_message_template: '{{invoice_number}} menunggu persetujuan.',
    default_redirect_url_template: '/inventory/purchase-invoices/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_APPROVED,
    label: 'Faktur disetujui',
    description: 'Faktur pembelian disetujui',
    category: 'purchase_invoice',
    default_type: 'success',
    default_title_template: 'Faktur disetujui',
    default_message_template: '{{invoice_number}} telah disetujui.',
    default_redirect_url_template: '/inventory/purchase-invoices/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_REJECTED,
    label: 'Faktur ditolak',
    description: 'Faktur pembelian ditolak',
    category: 'purchase_invoice',
    default_type: 'warning',
    default_title_template: 'Faktur ditolak',
    default_message_template: '{{invoice_number}} ditolak. Alasan: {{rejection_reason}}',
    default_redirect_url_template: '/inventory/purchase-invoices/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_POSTED,
    label: 'Faktur diposting',
    description: 'Purchase Invoice diposting (jurnal dibuat)',
    category: 'purchase_invoice',
    default_type: 'info',
    default_title_template: 'Faktur diposting',
    default_message_template: '{{invoice_number}} telah diposting ke jurnal.',
    default_redirect_url_template: '/inventory/purchase-invoices/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PRICELIST_APPROVED,
    label: 'Pricelist disetujui',
    description: 'Harga supplier disetujui (status APPROVED)',
    category: 'purchase_order',
    default_type: 'info',
    default_title_template: 'Pricelist disetujui',
    default_message_template: 'Pricelist produk {{product_label}} disetujui.',
    default_redirect_url_template: '/pricelists',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.JOURNAL_SUBMITTED,
    label: 'Jurnal diajukan',
    description: 'Jurnal manual submit untuk approval',
    category: 'accounting',
    default_type: 'approval_required',
    default_title_template: 'Jurnal menunggu approval',
    default_message_template: '{{journal_number}} menunggu persetujuan.',
    default_redirect_url_template: '/accounting/journals/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.JOURNAL_APPROVED,
    label: 'Jurnal disetujui',
    description: 'Jurnal disetujui — siap diposting',
    category: 'accounting',
    default_type: 'success',
    default_title_template: 'Jurnal disetujui',
    default_message_template: '{{journal_number}} telah disetujui.',
    default_redirect_url_template: '/accounting/journals/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.JOURNAL_REJECTED,
    label: 'Jurnal ditolak',
    description: 'Jurnal ditolak',
    category: 'accounting',
    default_type: 'warning',
    default_title_template: 'Jurnal ditolak',
    default_message_template: '{{journal_number}} ditolak. Alasan: {{rejection_reason}}',
    default_redirect_url_template: '/accounting/journals/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.JOURNAL_POSTED,
    label: 'Jurnal diposting',
    description: 'Jurnal diposting ke buku besar',
    category: 'accounting',
    default_type: 'info',
    default_title_template: 'Jurnal diposting',
    default_message_template: '{{journal_number}} telah diposting.',
    default_redirect_url_template: '/accounting/journals/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.GENERAL_INVOICE_REQUESTED,
    label: 'Request tagihan masuk',
    description: 'Staff mengajukan request tagihan utilitas (listrik, air, dll)',
    category: 'accounting',
    default_type: 'approval_required',
    default_title_template: 'Request tagihan baru',
    default_message_template: '{{template_name}} — {{branch_name}} ({{amount}})',
    default_redirect_url_template: '/finance/general-invoices',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.OPNAME_SHORTAGE_ASSIGNED,
    label: 'Shortage opname di-assign',
    description: 'Karyawan mendapat assignment shortage dari opname harian',
    category: 'inventory',
    default_type: 'warning',
    default_title_template: 'Shortage Opname',
    default_message_template: '{{product_name}} — {{qty}} {{uom}} shortage ditandai atas nama Anda oleh {{pic_name}}. Catatan: {{note}}',
    default_redirect_url_template: '/inventory/daily-stock-opname/{{session_id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.OPNAME_REOPEN_REQUESTED,
    label: 'Permintaan edit ulang opname',
    description: 'PIC mengajukan permintaan edit ulang opname yang sudah dikonfirmasi',
    category: 'inventory',
    default_type: 'approval_required',
    default_title_template: 'Permintaan Edit Ulang Opname',
    default_message_template: '{{pic_name}} meminta izin edit ulang opname {{branch_name}} tanggal {{closing_date}}. Alasan: {{reason}}',
    default_redirect_url_template: '/inventory/daily-stock-opname/{{session_id}}',
  },
  // ─── Production Request (Request Sauce) ──────────────────────────────────
  {
    event_key: NOTIFICATION_EVENT_KEYS.PRODUCTION_REQUEST_CREATED,
    label: 'Request Sauce baru',
    description: 'Production Request (Request Sauce) dibuat — menunggu diterima oleh central kitchen',
    category: 'production_request',
    default_type: 'approval_required',
    default_title_template: 'Request Sauce baru',
    default_message_template: '{{request_number}} — {{requesting_branch}} meminta sauce ke central kitchen.',
    default_redirect_url_template: '/food-production/production-requests/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PRODUCTION_REQUEST_ACCEPTED,
    label: 'Request Sauce diterima',
    description: 'Central kitchen menerima dan memproses Request Sauce',
    category: 'production_request',
    default_type: 'success',
    default_title_template: 'Request Sauce diproses',
    default_message_template: '{{request_number}} telah diterima oleh central kitchen dan sedang diproses.',
    default_redirect_url_template: '/food-production/production-requests/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PRODUCTION_REQUEST_RECEIVED,
    label: 'Request Sauce diterima cabang',
    description: 'Cabang peminta sudah menerima barang dari Request Sauce',
    category: 'production_request',
    default_type: 'info',
    default_title_template: 'Request Sauce selesai',
    default_message_template: '{{request_number}} sudah diterima oleh {{requesting_branch}}.',
    default_redirect_url_template: '/food-production/production-requests/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.PRODUCTION_REQUEST_CANCELLED,
    label: 'Request Sauce dibatalkan',
    description: 'Request Sauce dibatalkan',
    category: 'production_request',
    default_type: 'warning',
    default_title_template: 'Request Sauce dibatalkan',
    default_message_template: '{{request_number}} dibatalkan. Alasan: {{cancel_reason}}',
    default_redirect_url_template: '/food-production/production-requests/{{id}}',
  },
  // ─── Asset Request ────────────────────────────────────────────────────────
  {
    event_key: NOTIFICATION_EVENT_KEYS.ASSET_REQUEST_SUBMITTED,
    label: 'Request Aset baru',
    description: 'Asset Request diajukan (via PR) — menunggu approval',
    category: 'asset_request',
    default_type: 'approval_required',
    default_title_template: 'Request Aset baru',
    default_message_template: 'Request aset dari {{branch_name}} menunggu approval.',
    default_redirect_url_template: '/inventory/pr-approval',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.ASSET_REQUEST_APPROVED,
    label: 'Request Aset disetujui',
    description: 'Asset Request di-approve dan PO dibuat',
    category: 'asset_request',
    default_type: 'success',
    default_title_template: 'Request Aset disetujui',
    default_message_template: 'Request aset {{request_number}} telah disetujui dan PO dibuat.',
    default_redirect_url_template: '/inventory/purchase-requests/{{id}}',
  },
  {
    event_key: NOTIFICATION_EVENT_KEYS.ASSET_REQUEST_REJECTED,
    label: 'Request Aset ditolak',
    description: 'Asset Request ditolak',
    category: 'asset_request',
    default_type: 'warning',
    default_title_template: 'Request Aset ditolak',
    default_message_template: 'Request aset {{request_number}} ditolak. Alasan: {{rejected_reason}}',
    default_redirect_url_template: '/inventory/purchase-requests/{{id}}',
  },
]

export function getEventDefinition(eventKey: string): NotificationEventDefinition | undefined {
  return NOTIFICATION_EVENT_CATALOG.find((e) => e.event_key === eventKey)
}

export function renderNotificationTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = variables[key]
    if (val === null || val === undefined) return ''
    return String(val)
  })
}
