import { io, Socket } from 'socket.io-client'

const SOCKET_NOTIFICATION_EVENT = 'notification'

let socket: Socket | null = null
let reconnectAuthHandler: (() => void) | null = null

const getSocketUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
  return apiUrl.replace(/\/api\/v1\/?$/, '')
}

/** Always read fresh JWT from storage (handles rotation before connect/reconnect) */
export const syncSocketAuth = (s: Socket): void => {
  const token = localStorage.getItem('token')
  s.auth = { token }
}

const attachReconnectAuthRefresh = (s: Socket): void => {
  if (reconnectAuthHandler) {
    s.io.off('reconnect_attempt', reconnectAuthHandler)
  }
  reconnectAuthHandler = () => {
    syncSocketAuth(s)
  }
  s.io.on('reconnect_attempt', reconnectAuthHandler)
}

export const getSocket = (): Socket => {
  if (!socket) {
    const socketUrl = getSocketUrl()

    socket = io(socketUrl, {
      auth: { token: localStorage.getItem('token') },
      autoConnect: false,
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })

    attachReconnectAuthRefresh(socket)
  }
  return socket
}

export const connectSocket = (): void => {
  const s = getSocket()
  syncSocketAuth(s)
  if (!s.connected) {
    s.connect()
  }
}

export const getActiveSocket = (): Socket | null => socket

export const disconnectSocket = (): void => {
  if (socket) {
    if (reconnectAuthHandler) {
      socket.io.off('reconnect_attempt', reconnectAuthHandler)
      reconnectAuthHandler = null
    }
    socket.disconnect()
    socket = null
  }
}

export { SOCKET_NOTIFICATION_EVENT }
