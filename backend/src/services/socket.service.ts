import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { authService } from '../modules/auth/auth.service'
import { logInfo, logError, logWarn } from '../config/logger'
import type { RealtimeNotificationPayload } from '../modules/notifications/notifications.types'

let io: SocketIOServer | null = null

function resolveSocketCorsOrigin(): string | string[] | boolean {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  }
  const frontendUrl = process.env.FRONTEND_URL
  if (frontendUrl && frontendUrl !== '*') {
    return frontendUrl
  }
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
  }
  return false
}

export function initSocketServer(server: HTTPServer): SocketIOServer {
  const corsOrigin = resolveSocketCorsOrigin()
  const allowCredentials = corsOrigin !== false

  io = new SocketIOServer(server, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: allowCredentials,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '')

      if (!token) {
        logWarn('Socket.IO connection rejected: No token provided')
        return next(new Error('Authentication error: No token provided'))
      }

      const user = await authService.verifyToken(token)

      if (!user) {
        logWarn('Socket.IO connection rejected: Invalid token')
        return next(new Error('Authentication error: Invalid or expired token'))
      }

      socket.data.user = user
      next()
    } catch (error) {
      logError('Socket.IO auth middleware error', {
        error: error instanceof Error ? error.message : 'Unknown',
      })
      next(new Error('Authentication error: Internal server error'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.user?.id

    if (userId) {
      const userRoom = `user_${userId}`
      socket.join(userRoom)

      logInfo('Socket client connected successfully', {
        userId,
        socketId: socket.id,
        room: userRoom,
      })

      socket.on('disconnect', () => {
        logInfo('Socket client disconnected', {
          userId,
          socketId: socket.id,
        })
      })
    } else {
      socket.disconnect(true)
    }
  })

  logInfo('Socket.IO server initialized successfully', {
    corsConfigured: corsOrigin !== false,
  })
  return io
}

export function sendRealTimeNotification(
  userId: string,
  payload: RealtimeNotificationPayload
): boolean {
  if (!io) {
    logWarn('Failed to send Socket.IO notification: Server not initialized', { userId })
    return false
  }

  const userRoom = `user_${userId}`
  io.to(userRoom).emit('notification', payload)

  logInfo('Socket.IO notification dispatched', {
    userId,
    room: userRoom,
    title: payload.title,
  })
  return true
}
