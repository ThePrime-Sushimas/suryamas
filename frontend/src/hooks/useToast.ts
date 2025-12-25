import { useState, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const success = useCallback((message: string) => show(message, 'success'), [show])
  const error = useCallback((message: string) => show(message, 'error', 4000), [show])
  const info = useCallback((message: string) => show(message, 'info'), [show])

  return { toasts, show, success, error, info }
}
