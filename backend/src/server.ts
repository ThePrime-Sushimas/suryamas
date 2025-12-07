import dotenv from 'dotenv'
dotenv.config()

import app from './app'
import { logInfo, logError } from './config/logger'

const PORT = process.env.PORT || 3000

process.on('unhandledRejection', (reason: any) => {
  logError('Unhandled Rejection', { reason: reason?.message || reason })
})

process.on('uncaughtException', (error: Error) => {
  logError('Uncaught Exception', { error: error.message, stack: error.stack })
  process.exit(1)
})

app.listen(PORT, () => {
  logInfo('Server started', { port: PORT, env: process.env.NODE_ENV })
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 Server running on port ${PORT}         ║
║   📍 http://localhost:${PORT}                ║
║   📍 Health: /health                      ║
║   📍 Auth: /api/auth                      ║
║     - POST /register                      ║
║     - POST /login                         ║
║     - POST /logout                        ║
║     - GET  /profile                       ║
║     - PUT  /profile                       ║
╚═══════════════════════════════════════════╝
  `)
})