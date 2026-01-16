import { useEffect, useRef } from 'react'
import { X, Upload, AlertCircle } from 'lucide-react'
import { usePosImportsStore } from '../store/pos-imports.store'

export const UploadProgressToast = () => {
  const uploads = usePosImportsStore(s => s.uploads)
  const cancelUpload = usePosImportsStore(s => s.cancelUpload)
  const timeoutRef = useRef<number | undefined>(undefined)

  const activeUpload = Array.from(uploads.values())[0]
  const isVisible = !!activeUpload

  useEffect(() => {
    if (activeUpload?.status === 'complete') {
      timeoutRef.current = window.setTimeout(() => {
        if (activeUpload.id) {
          cancelUpload(activeUpload.id)
        }
      }, 1000)
    } else if (activeUpload?.status === 'error') {
      timeoutRef.current = window.setTimeout(() => {
        if (activeUpload.id) {
          cancelUpload(activeUpload.id)
        }
      }, 5000)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [activeUpload?.status, activeUpload?.id, cancelUpload])

  if (!isVisible || !activeUpload) return null

  const handleClose = () => {
    if (activeUpload.id) {
      cancelUpload(activeUpload.id)
    }
  }

  if (activeUpload.status === 'error') {
    return (
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border border-red-200 p-4 w-80 z-50">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            <span className="text-sm font-medium text-red-600">Upload Failed</span>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-600">{activeUpload.error}</p>
      </div>
    )
  }

  const progress = activeUpload.progress
  const statusText = activeUpload.status === 'processing' ? 'Processing...' : 'Uploading...'

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 z-50">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-blue-600" />
          <span className="text-sm font-medium">{statusText}</span>
        </div>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-600">
          <span>POS Data Import</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div 
            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {progress === 100 && (
          <p className="text-xs text-gray-500 mt-1">
            Analyzing for duplicates...
          </p>
        )}
      </div>
    </div>
  )
}
