import { useState, useRef, useEffect, useCallback } from 'react'
import { MoreVertical, Eye, Download, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface ActionMenuProps {
  id: number
  onDownload?: () => void
  onDelete?: () => void
  disabled?: boolean
}

export function ActionMenu({
  id,
  onDownload,
  onDelete,
  disabled = false,
}: ActionMenuProps) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleViewDetail = useCallback(() => {
    navigate(`/bank-statement-import/${id}`)
  }, [navigate, id])

  const handleAction = useCallback((action: () => void) => {
    action()
    setIsOpen(false)
  }, [])

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          p-1.5 rounded-lg transition-colors
          text-gray-500 hover:text-gray-700 hover:bg-gray-100
          dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        title="Menu aksi"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 z-50 w-48 origin-top-right rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-100 dark:border-gray-700"
        >
          <div className="py-1">
            <button
              onClick={() => handleAction(handleViewDetail)}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Eye className="w-4 h-4 mr-2.5 text-gray-400" />
              Lihat Detail
            </button>

            {onDownload && (
              <button
                onClick={() => handleAction(onDownload)}
                className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2.5 text-gray-400" />
                Download File
              </button>
            )}

            {onDelete && (
              <>
                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                <button
                  onClick={() => handleAction(onDelete)}
                  className="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2.5" />
                  Hapus
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

