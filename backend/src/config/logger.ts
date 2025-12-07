import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'

const logDir = path.join(__dirname, '../../logs')

const sanitizeData = (data: any): any => {
  if (!data || typeof data !== 'object') return data
  
  const sanitized = { ...data }
  const sensitiveFields = ['password', 'token', 'authorization', 'creditCard', 'ssn', 'secret']
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]'
    }
  })
  
  return sanitized
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      zippedArchive: true
    })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`
      })
    )
  }))
}

export const logInfo = (message: string, meta?: any) => {
  logger.info(message, sanitizeData(meta))
}

export const logError = (message: string, meta?: any) => {
  logger.error(message, sanitizeData(meta))
}

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, sanitizeData(meta))
}

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, sanitizeData(meta))
}

export default logger
