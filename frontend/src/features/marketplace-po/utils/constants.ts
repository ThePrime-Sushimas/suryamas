import type { MarketplacePlatform, MarketplaceSessionStatus } from '../types/marketplacePo.types'

export const PLATFORM_CONFIG: Record<
  MarketplacePlatform,
  { label: string; bgColor: string; textColor: string; borderColor: string }
> = {
  SHOPEE: {
    label: 'Shopee',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    textColor: 'text-orange-700 dark:text-orange-300',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  TOKOPEDIA: {
    label: 'Tokopedia',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-200 dark:border-green-800',
  },
}

export const STATUS_CONFIG: Record<
  MarketplaceSessionStatus,
  { label: string; bgColor: string; textColor: string; borderColor: string }
> = {
  DRAFT: {
    label: 'Draft',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  ORDERED: {
    label: 'Dipesan',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  SHIPPED: {
    label: 'Dikirim',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    textColor: 'text-indigo-700 dark:text-indigo-300',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
  },
  RECEIVED: {
    label: 'Diterima',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    textColor: 'text-teal-700 dark:text-teal-300',
    borderColor: 'border-teal-200 dark:border-teal-800',
  },
  SETTLED: {
    label: 'Lunas',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  CANCELLED: {
    label: 'Dibatalkan',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-200 dark:border-red-800',
  },
}

export const FILE_TYPE_LABELS: Record<string, string> = {
  BUKTI_BAYAR: 'Bukti Bayar',
  SCREENSHOT_CHECKOUT: 'Screenshot Checkout',
  INVOICE_MARKETPLACE: 'Invoice Marketplace',
  OTHER: 'Lainnya',
}

export const CC_COA_OPTIONS = [
  { code: '210602', label: '210602 - Utang CC Owner - Kartu 1' },
  { code: '210603', label: '210603 - Utang CC Owner - Kartu 2' },
  { code: '210604', label: '210604 - Utang CC Owner - Kartu 3' },
  { code: '210605', label: '210605 - Utang CC Owner - Kartu 4' },
  { code: '210606', label: '210606 - Utang CC Owner - Kartu 5' },
]

export const TIMELINE_STEPS: MarketplaceSessionStatus[] = [
  'DRAFT',
  'ORDERED',
  'SHIPPED',
  'RECEIVED',
  'SETTLED',
]
