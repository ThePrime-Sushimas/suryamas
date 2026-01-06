import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { ToastContainer } from '@/components/ui/ToastContainer'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const success = useCallback((message: string) => show(message, 'success'), [show])
  const error = useCallback((message: string) => show(message, 'error', 4000), [show])
  const info = useCallback((message: string) => show(message, 'info'), [show])
  const warning = useCallback((message: string) => show(message, 'warning', 3500), [show])

  return (
    <ToastContext.Provider value={{ success, error, info, warning }}>
      <ToastContainer toasts={toasts} onRemove={remove} />
      {children}
    </ToastContext.Provider>
  )
}

// Required for custom hook export alongside provider
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
