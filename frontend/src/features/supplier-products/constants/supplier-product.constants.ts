// Supplier Product Constants - Options and validation rules

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

export const LEAD_TIME_OPTIONS = [
  ...Array.from({ length: 30 }, (_, i) => ({
    value: i + 1,
    label: i + 1 === 1 ? '1 day' : `${i + 1} days`
  })),
  { value: 45, label: '45 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 120, label: '120 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '365 days' }
]

export const MIN_ORDER_QTY_OPTIONS = [
  { value: 1, label: '1 unit' },
  { value: 5, label: '5 units' },
  { value: 10, label: '10 units' },
  { value: 25, label: '25 units' },
  { value: 50, label: '50 units' },
  { value: 100, label: '100 units' },
  { value: null, label: 'No minimum' },
]

export const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 per page' },
  { value: 25, label: '25 per page' },
  { value: 50, label: '50 per page' },
  { value: 100, label: '100 per page' },
]

export const SORT_BY_OPTIONS = [
  { value: 'created_at', label: 'Created Date' },
  { value: 'updated_at', label: 'Updated Date' },
  { value: 'price', label: 'Price' },
  { value: 'lead_time_days', label: 'Lead Time' },
  { value: 'min_order_qty', label: 'Min Order Qty' },
]

export const SUPPLIER_PRODUCT_LIMITS = {
  MAX_PREFERRED_SUPPLIERS: 3,
  MAX_LEAD_TIME_DAYS: 365,
  MIN_PRICE: 0,
  MAX_PRICE: 999999999999,
  MIN_ORDER_QTY: 0.01,
  MAX_BULK_DELETE: 100,
  PRICE_DECIMAL_PLACES: 2,
} as const

export const TABLE_COLUMNS = [
  { key: 'supplier', label: 'Supplier', sortable: false },
  { key: 'product', label: 'Product', sortable: false },
  { key: 'price', label: 'Price', sortable: true },
  { key: 'lead_time_days', label: 'Lead Time', sortable: true },
  { key: 'min_order_qty', label: 'Min Order', sortable: true },
  { key: 'is_preferred', label: 'Preferred', sortable: true },
  { key: 'is_active', label: 'Status', sortable: true },
  { key: 'actions', label: 'Actions', sortable: false },
] as const

