import { FileText, Image, ExternalLink } from 'lucide-react'
import { useSignedStorageUrl } from '@/hooks/useSignedStorageUrl'

export type AttachmentThumbnailVariant = 'purchase-invoice' | 'goods-receipt'

interface AttachmentThumbnailProps {
  filePath: string
  isImage: boolean
  bucket?: string
  variant?: AttachmentThumbnailVariant
  onClick?: (url: string) => void
}

export function AttachmentThumbnail({
  filePath,
  isImage,
  bucket = 'invoices',
  variant = 'purchase-invoice',
  onClick,
}: AttachmentThumbnailProps) {
  const url = useSignedStorageUrl(filePath, bucket, isImage)

  if (!isImage) {
    if (variant === 'goods-receipt') {
      return (
        <div className="w-14 h-14 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <FileText className="w-6 h-6 text-gray-400" />
        </div>
      )
    }
    return (
      <div className="w-12 h-12 flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
        <FileText className="w-6 h-6 text-red-500" />
      </div>
    )
  }

  if (!url) {
    if (variant === 'goods-receipt') {
      return (
        <div className="w-14 h-14 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse">
          <Image className="w-6 h-6 text-gray-300" />
        </div>
      )
    }
    return (
      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
        <Image className="w-5 h-5 text-gray-400" />
      </div>
    )
  }

  if (variant === 'goods-receipt') {
    return (
      <div
        className="group relative cursor-zoom-in rounded-xl overflow-hidden shadow-sm"
        onClick={() => onClick?.(url)}
      >
        <img
          src={url}
          alt="thumbnail"
          className="w-14 h-14 object-cover border border-gray-200 dark:border-gray-700 transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ExternalLink className="w-4 h-4 text-white" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="group relative cursor-zoom-in"
      onClick={() => onClick?.(url)}
    >
      <img
        src={url}
        alt="thumbnail"
        className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-transform group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
        <ExternalLink className="w-3 h-3 text-white" />
      </div>
    </div>
  )
}
