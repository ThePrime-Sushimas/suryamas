/** Orphan / supplier badges use isMarketplaceSupplierName — sync with backend util. */
import { isMarketplaceSupplierName } from '@/lib/marketplaceSupplier'

type GoodsReceiptSource = 'SUPPLIER' | 'MARKETPLACE' | null | undefined

interface GrSourceBadgeProps {
  source?: GoodsReceiptSource
  supplierName: string
  status?: string
  className?: string
}

export function GrSourceBadge({ source, supplierName, status, className = '' }: GrSourceBadgeProps) {
  const orphan =
    status === 'DRAFT' &&
    isMarketplaceSupplierName(supplierName) &&
    source !== 'MARKETPLACE'

  if (source === 'MARKETPLACE') {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/50 ${className}`}
        title="Dibuat otomatis dari Marketplace PO (Receive)"
      >
        Marketplace
      </span>
    )
  }

  if (orphan) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700/50 ${className}`}
        title="Draft manual untuk supplier marketplace — tidak bisa dikonfirmasi. Hapus dan gunakan Marketplace PO."
      >
        Salah jalur
      </span>
    )
  }

  if (isMarketplaceSupplierName(supplierName)) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600 ${className}`}
        title="Supplier marketplace; penerimaan lewat modul Marketplace PO"
      >
        Marketplace supplier
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-600 ${className}`}
      title="Penerimaan manual dari supplier"
    >
      Supplier
    </span>
  )
}
