import { Loader2 } from 'lucide-react'

const MAX_INLINE = 6

function formatInvoiceList(numbers: string[]): string {
  if (numbers.length <= MAX_INLINE) return numbers.join(', ')
  const shown = numbers.slice(0, MAX_INLINE).join(', ')
  return `${shown}, +${numbers.length - MAX_INLINE} lainnya`
}

export interface ApPaymentDeleteConfirmMessageProps {
  paymentNumber: string
  invoiceNumbers?: string[]
  invoiceCount?: number
  isLoadingDetails?: boolean
}

export function ApPaymentDeleteConfirmMessage({
  paymentNumber,
  invoiceNumbers,
  invoiceCount,
  isLoadingDetails,
}: ApPaymentDeleteConfirmMessageProps) {
  const uniqueInvoices = invoiceNumbers?.length
    ? [...new Set(invoiceNumbers)]
    : undefined

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p>
        Draft{' '}
        <span className="font-medium text-gray-900 dark:text-white">{paymentNumber}</span> akan
        dihapus.
      </p>

      {isLoadingDetails ? (
        <p className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Memuat daftar invoice…
        </p>
      ) : uniqueInvoices && uniqueInvoices.length > 0 ? (
        <div>
          <p className="text-gray-700 dark:text-gray-300">
            Invoice berikut akan kembali ke daftar{' '}
            <span className="font-medium">outstanding</span>:
          </p>
          <p className="mt-1.5 font-medium text-gray-900 dark:text-white">
            {formatInvoiceList(uniqueInvoices)}
          </p>
        </div>
      ) : invoiceCount && invoiceCount > 0 ? (
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">{invoiceCount}</span> invoice akan kembali ke daftar{' '}
          <span className="font-medium">outstanding</span>.
        </p>
      ) : (
        <p className="text-gray-700 dark:text-gray-300">
          Invoice terkait akan kembali ke daftar <span className="font-medium">outstanding</span>.
        </p>
      )}
    </div>
  )
}
