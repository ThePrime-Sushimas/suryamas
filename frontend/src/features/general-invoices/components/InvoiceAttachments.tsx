import { useRef } from 'react'
import { Paperclip, Trash2, Upload, FileText, Image } from 'lucide-react'
import { useInvoiceAttachments, useUploadInvoiceAttachment, useDeleteInvoiceAttachment } from '../api/generalApi.api'
import type { InvoiceAttachment } from '../api/generalApi.api'
import { formatDate } from '../constants'

interface InvoiceAttachmentsProps {
  invoiceId: string
  /** If true, hide upload/delete buttons (read-only view) */
  readOnly?: boolean
}

function getFileIcon(mimeType: string | null) {
  if (mimeType?.startsWith('image/')) return <Image size={14} className="text-blue-500" />
  return <FileText size={14} className="text-gray-500" />
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function InvoiceAttachments({ invoiceId, readOnly = false }: InvoiceAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: attachments = [], isLoading } = useInvoiceAttachments(invoiceId)
  const uploadMutation = useUploadInvoiceAttachment()
  const deleteMutation = useDeleteInvoiceAttachment()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      uploadMutation.mutate({ invoiceId, file })
    }
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleDelete = (attachment: InvoiceAttachment) => {
    if (attachment.is_legacy) return
    deleteMutation.mutate({ invoiceId, attachmentId: attachment.id })
  }

  if (isLoading) {
    return <div className="text-xs text-gray-400 py-2">Memuat lampiran...</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-600">
            Lampiran ({attachments.length})
          </span>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 disabled:opacity-50"
          >
            <Upload size={12} />
            {uploadMutation.isPending ? 'Uploading...' : 'Tambah'}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.heic,.heif"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Belum ada lampiran</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg group"
            >
              {getFileIcon(att.mime_type)}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-800 truncate">
                  {att.file_name || att.file_url.split('/').pop() || 'Lampiran'}
                </p>
                <p className="text-[10px] text-gray-400">
                  {formatDate(att.created_at)}
                  {att.file_size ? ` · ${formatFileSize(att.file_size)}` : ''}
                  {att.description ? ` · ${att.description}` : ''}
                </p>
              </div>
              {!readOnly && !att.is_legacy && (
                <button
                  type="button"
                  onClick={() => handleDelete(att)}
                  disabled={deleteMutation.isPending}
                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  title="Hapus lampiran"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
