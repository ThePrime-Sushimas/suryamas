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
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://suryamas.vercel.app',
    process.env.FRONTEND_URL || ''
  ].filter(Boolean),
  credentials: true
}))
app.use(express.json())
app.use(requestLogger)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Module Routes
app.use('/api/auth', authRoutes)
app.use('/api/employees', employeesRoutes)

// Error handler
app.use(errorHandler)

export default app