import 'module-alias/register'
import dotenv from 'dotenv'
dotenv.config()

import http from 'http'
import app from './app'
import { logInfo, logError } from './config/logger'
import { jobWorker, registerAllProcessors } from './modules/jobs'
import { initSocketServer } from './services/socket.service'

const PORT = process.env.PORT || 3000

const httpServer = http.createServer(app)

// Initialize Socket.IO server on top of HTTP server
initSocketServer(httpServer)

process.on('unhandledRejection', (reason: any) => {
  logError('Unhandled Rejection', { reason: reason?.message || reason })
})

process.on('uncaughtException', (error: Error) => {
  logError('Uncaught Exception', { error: error.message, stack: error.stack })
  process.exit(1)
})

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  logInfo('Server started', { port: PORT, env: process.env.NODE_ENV, host: '0.0.0.0' })
  console.log(`
🚀 Server running on http://0.0.0.0:${PORT}
📝 Environment: ${process.env.NODE_ENV || 'development'}
  `)
  
  // Register all job processors
  registerAllProcessors((type, processor) => {
    jobWorker.registerProcessor(type, processor)
  })
  
  // Start cleanup interval
  jobWorker.startCleanup()
  
  // Start job polling for pending jobs
  jobWorker.startPolling()
  
  logInfo('Job worker initialized with all processors registered')
})

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logInfo('SIGTERM received, starting graceful shutdown')
  try {
    await jobWorker.gracefulShutdown(30000)
    logInfo('Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    logError('Graceful shutdown error', { error })
    process.exit(1)
  }
})

process.on('SIGINT', async () => {
  logInfo('SIGINT received, starting graceful shutdown')
  try {
    await jobWorker.gracefulShutdown(30000)
    logInfo('Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    logError('Graceful shutdown error', { error })
    process.exit(1)
  }
})