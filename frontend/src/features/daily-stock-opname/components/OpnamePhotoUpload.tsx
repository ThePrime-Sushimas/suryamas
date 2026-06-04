import { useRef, useState } from 'react'
import { Camera, CheckCircle2, Loader2, Trash2, X } from 'lucide-react'
import { useUploadPhoto, useDeletePhoto } from '../api/dailyStockOpname'

interface OpnamePhotoUploadProps {
  sessionId: string
  lineId: string
  photoUrl: string | null
  requiresPhoto: boolean
  disabled?: boolean
}

export function OpnamePhotoUpload({ sessionId, lineId, photoUrl, requiresPhoto, disabled = false }: OpnamePhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadPhoto = useUploadPhoto()
  const deletePhoto = useDeletePhoto()
  const [showPreview, setShowPreview] = useState(false)

  const handleClick = () => {
    if (photoUrl) {
      setShowPreview(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png']
    if (!validTypes.includes(file.type)) return
    if (file.size > 10 * 1024 * 1024) return // 10MB max

    uploadPhoto.mutate({ sessionId, lineId, file })
    e.target.value = ''
  }

  const handleDelete = () => {
    deletePhoto.mutate({ sessionId, lineId })
    setShowPreview(false)
  }

  const handleReplace = () => {
    setShowPreview(false)
    fileInputRef.current?.click()
  }

  const hasPhoto = !!photoUrl
  const isPending = uploadPhoto.isPending || deletePhoto.isPending

  return (
    <>
      <div className="flex items-center justify-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending || disabled}
          className={`inline-flex items-center gap-0.5 p-1.5 rounded-lg transition-colors ${
            hasPhoto
              ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
              : requiresPhoto
                ? 'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                : 'text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-700'
          }`}
          title={
            hasPhoto
              ? 'Klik untuk preview foto'
              : requiresPhoto
                ? 'Foto wajib (klik untuk upload)'
                : 'Upload foto (opsional)'
          }
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : hasPhoto ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <>
              <Camera className="w-4 h-4" />
              {requiresPhoto && <span className="text-[10px] font-bold">!</span>}
            </>
          )}
        </button>
      </div>

      {/* Photo Preview Modal */}
      {showPreview && photoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowPreview(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Foto Opname</span>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Image */}
            <div className="p-4 flex justify-center bg-gray-50 dark:bg-gray-900">
              <img
                src={photoUrl}
                alt="Foto opname"
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
              />
            </div>

            {/* Actions */}
            {!disabled && (
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletePhoto.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Hapus
                </button>
                <button
                  onClick={handleReplace}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Ganti Foto
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
