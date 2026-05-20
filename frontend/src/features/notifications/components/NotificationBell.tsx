import { useState, useEffect } from 'react'
import { Bell, Check, ArrowRight, Sparkles, Trash2, Volume2, VolumeX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotificationsStore, type Notification } from '../store/notifications.store'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

const POLL_INTERVAL_MS = 60_000

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [shouldWiggle, setShouldWiggle] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const navigate = useNavigate()
  const toast = useToast()

  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    soundEnabled,
    setSoundEnabled,
  } = useNotificationsStore()

  // Fallback sync (Socket.IO handles real-time)
  useEffect(() => {
    fetchNotifications(toast)
    const interval = setInterval(() => fetchNotifications(toast), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchNotifications, toast])

  useEffect(() => {
    if (unreadCount > 0) {
      setShouldWiggle(true)
      const timer = setTimeout(() => setShouldWiggle(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [unreadCount])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handleNotificationClick = async (n: Notification) => {
    await markAsRead(n.id)
    setIsOpen(false)
    if (n.data?.redirectUrl) {
      navigate(n.data.redirectUrl)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeleteTargetId(id)
  }

  const confirmDelete = async () => {
    if (!deleteTargetId) return
    setIsDeleting(true)
    try {
      await deleteNotification(deleteTargetId)
    } finally {
      setIsDeleting(false)
      setDeleteTargetId(null)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-300 ${
          shouldWiggle ? 'animate-[wiggle_0.5s_ease-in-out_infinite]' : ''
        }`}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse border border-white dark:border-gray-900" />
        )}
      </button>

      <ConfirmModal
        isOpen={deleteTargetId !== null}
        onClose={() => !isDeleting && setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="Hapus notifikasi"
        message="Notifikasi ini akan dihapus permanen. Lanjutkan?"
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={isDeleting}
      />

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-800/50 z-50 flex flex-col max-h-[500px]">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Pemberitahuan</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full font-medium">
                    {unreadCount} baru
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  title={soundEnabled ? 'Matikan Suara' : 'Aktifkan Suara'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Semua dibaca
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 max-h-[350px]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-30 animate-bounce" />
                  <p className="text-sm">Tidak ada notifikasi baru</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 cursor-pointer transition-colors duration-200 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 group relative ${
                      !n.is_read ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 mt-1.5 rounded-full shrink-0 ${
                        n.type === 'error'
                          ? 'bg-red-500'
                          : n.type === 'warning'
                            ? 'bg-amber-500'
                            : n.type === 'success'
                              ? 'bg-green-500'
                              : n.type === 'approval_required'
                                ? 'bg-purple-500 animate-pulse'
                                : 'bg-blue-500'
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                          {new Date(n.created_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                      {n.data?.redirectUrl && (
                        <ArrowRight className="w-4 h-4 text-gray-400 hover:text-gray-900 dark:hover:text-white" />
                      )}
                      <button
                        onClick={(e) => handleDeleteClick(e, n.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30 text-center rounded-b-xl">
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                Suryamas Internal System Notifications
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
