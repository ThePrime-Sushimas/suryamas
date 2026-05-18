import { useState, useEffect } from 'react'
import { Upload, Trash2, FileText, ExternalLink, Image } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import {
  useUploadMarketplaceAttachment,
  useDeleteMarketplaceAttachment,
  getSignedUrl,
} from '../api/marketplacePo.api'
import { FILE_TYPE_LABELS } from '../utils/constants'
import type {
  MarketplaceAttachment,
  MarketplaceAttachmentType,
  MarketplaceSessionStatus,
} from '../types/marketplacePo.types'

function AttachmentThumb({
  filePath,
  fileName,
  onOpen,
}: {
  filePath: string
  fileName: string | null
  onOpen: (url: string) => void
}) {
  const isImage = /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(filePath)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isImage) return
    let cancelled = false
    getSignedUrl(filePath)
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [filePath, isImage])

  if (!isImage) {
    return (
      <div className="w-14 h-14 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl border">
        <FileText className="w-6 h-6 text-gray-400" />
      </div>
    )
  }

  if (!url) {
    return (
      <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse flex items-center justify-center">
        <Image className="w-5 h-5 text-gray-300" />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(url)}
      className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
    >
      <img src={url} alt={fileName ?? ''} className="w-full h-full object-cover" />
    </button>
  )
}

export function SessionAttachmentsTab({
  sessionId,
  status,
  attachments,
}: {
  sessionId: string
  status: MarketplaceSessionStatus
  attachments: MarketplaceAttachment[]
}) {
  const toast = useToast()
  const upload = useUploadMarketplaceAttachment()
  const remove = useDeleteMarketplaceAttachment()
  const canEdit = status === 'DRAFT' || status === 'ORDERED'

  const [fileType, setFileType] = useState<MarketplaceAttachmentType>('BUKTI_BAYAR')
  const [file, setFile] = useState<File | null>(null)

  const hasBuktiBayar = attachments.some((a) => a.file_type === 'BUKTI_BAYAR')

  const handleUpload = async () => {
    if (!file) {
      toast.warning('Pilih file terlebih dahulu')
      return
    }
    try {
      await upload.mutateAsync({ sessionId, file, fileType })
      toast.success('Lampiran berhasil diupload')
      setFile(null)
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal upload lampiran'))
    }
  }

  const handleDelete = async (attachmentId: string) => {
    try {
      await remove.mutateAsync({ sessionId, attachmentId })
      toast.success('Lampiran dihapus')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal menghapus lampiran'))
    }
  }

  const openFile = async (filePath: string) => {
    try {
      const url = await getSignedUrl(filePath)
      window.open(url, '_blank')
    } catch {
      toast.error('Gagal membuka file')
    }
  }

  return (
    <div className="space-y-4">
      {status === 'DRAFT' && !hasBuktiBayar && (
        <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Upload minimal 1 dokumen <strong>Bukti Bayar</strong> sebelum konfirmasi order.
        </p>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">Belum ada lampiran.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <AttachmentThumb
                filePath={att.file_path}
                fileName={att.file_name}
                onOpen={(url) => window.open(url, '_blank')}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {att.file_name ?? 'Dokumen'}
                </p>
                <p className="text-xs text-gray-500">{FILE_TYPE_LABELS[att.file_type]}</p>
              </div>
              <button
                type="button"
                onClick={() => openFile(att.file_path)}
                className="p-2 text-gray-400 hover:text-teal-600"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(att.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipe File</label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value as MarketplaceAttachmentType)}
                className="w-full h-9 px-3 text-sm border rounded-lg bg-white dark:bg-gray-800"
              >
                {Object.entries(FILE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">File</label>
              <input
                type="file"
                accept="image/*,.pdf,.heic,.heif"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                JPG, PNG, WEBP, PDF, atau HEIC · maks. 10MB. Di iPhone, &quot;Most Compatible&quot;
                menghindari HEIC jika upload gagal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={upload.isPending || !file}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {upload.isPending ? 'Mengupload...' : 'Upload'}
          </button>
        </div>
      )}
    </div>
  )
}
