import { create } from 'zustand'
import api from '@/lib/axios'
import { parseApiError } from '@/lib/errorParser'
import {
  connectSocket,
  getActiveSocket,
  disconnectSocket as disconnectSocketClient,
  SOCKET_NOTIFICATION_EVENT,
} from '@/lib/socket'

interface NotificationToast {
  info: (message: string) => void
}

export interface Notification {
  id: string
  recipient_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'approval_required'
  category: 'system' | 'purchase_request' | 'purchase_order' | 'purchase_invoice' | 'inventory' | 'accounting' | 'hrd'
  is_read: boolean
  read_at: string | null
  data?: {
    redirectUrl?: string
    eventKey?: string
    entityId?: string
    [key: string]: unknown
  }
  created_at: string
}

interface NotificationsState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
  _lastFetchedAt: number
  soundEnabled: boolean

  fetchNotifications: (toast?: NotificationToast) => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  setSoundEnabled: (enabled: boolean) => void
  initializeSocket: (toast?: NotificationToast) => void
  teardownSocket: () => void
  clearError: () => void
}

let socketNotificationHandler: ((payload: Notification) => void) | null = null
let socketToastRef: NotificationToast | undefined

const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    const gain2 = ctx.createGain()

    osc1.frequency.setValueAtTime(880, now)
    osc2.frequency.setValueAtTime(1109, now)
    osc1.type = 'sine'
    osc2.type = 'sine'

    gain1.gain.setValueAtTime(0.12, now)
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
    gain2.gain.setValueAtTime(0.06, now)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)

    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.6)
    osc2.stop(now + 0.35)
  } catch (error) {
    console.warn('Audio chime play failed:', error)
  }
}

const getStoredSoundPreference = (): boolean => {
  if (typeof window === 'undefined') return true
  try {
    const stored = localStorage.getItem('suryamas_notifications_sound')
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

const handleSocketNotification = (payload: Notification) => {
  useNotificationsStore.setState((state: NotificationsState) => {
    if (state.notifications.some((n: Notification) => n.id === payload.id)) {
      return state
    }
    const updatedNotifications = [payload, ...state.notifications]
    const updatedUnread = payload.is_read ? state.unreadCount : state.unreadCount + 1
    return {
      notifications: updatedNotifications,
      unreadCount: updatedUnread,
    }
  })

  if (useNotificationsStore.getState().soundEnabled) {
    playNotificationSound()
  }

  const toast = socketToastRef
  if (toast) {
    toast.info(`${payload.title}: ${payload.message}`)
  }
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  _lastFetchedAt: 0,
  soundEnabled: getStoredSoundPreference(),

  fetchNotifications: async (toast) => {
    const now = Date.now()
    set({ loading: true, error: null })
    try {
      const [listRes, countRes] = await Promise.all([
        api.get('/notifications', { params: { limit: 50 } }),
        api.get('/notifications/unread-count'),
      ])
      const newNotifications: Notification[] = listRes.data.data ?? []
      const newUnreadCount: number = countRes.data.data?.count ?? 0

      const currentUnreadCount = get().unreadCount
      const isInitialFetch = get()._lastFetchedAt === 0

      if (!isInitialFetch && newUnreadCount > currentUnreadCount) {
        const latest = newNotifications.find((n) => !n.is_read)
        if (latest) {
          if (toast) {
            toast.info(`${latest.title}: ${latest.message}`)
          }
          if (get().soundEnabled) {
            playNotificationSound()
          }
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(latest.title, {
              body: latest.message,
              icon: '/icon-sishimas.png',
            })
          }
        }
      }

      set({
        notifications: newNotifications,
        unreadCount: newUnreadCount,
        loading: false,
        _lastFetchedAt: now,
      })
    } catch (error: unknown) {
      set({
        error: parseApiError(error, 'Gagal memuat notifikasi'),
        loading: false,
      })
    }
  },

  markAsRead: async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      set((state) => {
        const updated = state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
        return {
          notifications: updated,
          unreadCount: updated.filter((n) => !n.is_read).length,
        }
      })
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch('/notifications/read-all')
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          is_read: true,
          read_at: new Date().toISOString(),
        })),
        unreadCount: 0,
      }))
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  },

  deleteNotification: async (id) => {
    try {
      await api.delete(`/notifications/${id}`)
      set((state) => {
        const updated = state.notifications.filter((n) => n.id !== id)
        return {
          notifications: updated,
          unreadCount: updated.filter((n) => !n.is_read).length,
        }
      })
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  },

  setSoundEnabled: (enabled: boolean) => {
    try {
      localStorage.setItem('suryamas_notifications_sound', String(enabled))
    } catch (e) {
      console.warn('Failed to save sound preference to localStorage', e)
    }
    set({ soundEnabled: enabled })
  },

  initializeSocket: (toast) => {
    socketToastRef = toast
    connectSocket()
    const s = getActiveSocket()
    if (!s) return

    if (socketNotificationHandler) {
      s.off(SOCKET_NOTIFICATION_EVENT, socketNotificationHandler)
    }

    socketNotificationHandler = handleSocketNotification
    s.on(SOCKET_NOTIFICATION_EVENT, socketNotificationHandler)
  },

  teardownSocket: () => {
    const s = getActiveSocket()
    if (s && socketNotificationHandler) {
      s.off(SOCKET_NOTIFICATION_EVENT, socketNotificationHandler)
    }
    socketNotificationHandler = null
    socketToastRef = undefined
    disconnectSocketClient()
  },

  clearError: () => set({ error: null }),
}))
