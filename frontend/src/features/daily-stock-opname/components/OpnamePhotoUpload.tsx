import { useRef } from 'react'
import { Camera, CheckCircle2, Loader2 } from 'lucide-react'
import { useUploadPhoto } from '../api/dailyStockOpname'

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

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type and size
    const validTypes = ['image/jpeg', 'image/png']
    if (!validTypes.includes(file.type)) return
    if (file.size > 10 * 1024 * 1024) return // 10MB max

    uploadPhoto.mutate({ sessionId, lineId, file })
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const hasPhoto = !!photoUrl

  return (
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
        disabled={uploadPhoto.isPending || disabled}
        className={`inline-flex items-center gap-0.5 p-1.5 rounded-lg transition-colors ${
          hasPhoto
            ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
            : requiresPhoto
              ? 'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
              : 'text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-700'
        }`}
        title={
          hasPhoto
            ? 'Foto sudah diupload'
            : requiresPhoto
              ? 'Foto wajib (klik untuk upload)'
              : 'Upload foto (opsional)'
        }
      >
        {uploadPhoto.isPending ? (
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
  )
}
