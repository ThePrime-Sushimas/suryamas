import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, Eye, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface ActionMenuProps {
  id: number
  onDelete?: () => void
  disabled?: boolean
}

export function ActionMenu({
  id,
  onDelete,
  disabled = false,
}: ActionMenuProps) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close menu on scroll or resize to prevent floating
  useEffect(() => {
    if (!isOpen) return

    const handleScroll = () => setIsOpen(false)
    window.addEventListener('scroll', handleScroll, true) // Capture phase for all scrollable parents
    window.addEventListener('resize', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isOpen])

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const menu = document.getElementById(`action-menu-${id}`)
      
      if (
        menu && !menu.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, id])

  const toggleMenu = () => {
    if (disabled) return
    
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      // Position menu: Align right edge with button right edge, top below button
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4, // 4px gap
        left: rect.right + window.scrollX - 192, // 192px = w-48 (12rem)
      })
    }
    setIsOpen(!isOpen)
  }

  const handleViewDetail = useCallback(() => {
    navigate(`/bank-statement-import/${id}`)
    setIsOpen(false)
  }, [navigate, id])

  const handleAction = useCallback((action: () => void) => {
    action()
    setIsOpen(false)
  }, [])

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
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

      {isOpen && createPortal(
        <div
          id={`action-menu-${id}`}
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
          className="fixed z-9999 w-48 origin-top-right rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-100 dark:border-gray-700"
        >
          <div className="py-1">
            <button
              onClick={() => handleAction(handleViewDetail)}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Eye className="w-4 h-4 mr-2.5 text-gray-400" />
              Lihat Detail
            </button>


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
        </div>,
        document.body
      )}
    </>
  )
}

