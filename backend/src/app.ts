import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './modules/auth/auth.routes'
import employeesRoutes from './modules/employees/employees.routes'
import { errorHandler } from './middleware/error.middleware'
import { requestLogger } from './middleware/request-logger.middleware'

const app = express()

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(requestLogger)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// API v1 Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/employees', employeesRoutes)

// Error handler
app.use(errorHandler)

export default app