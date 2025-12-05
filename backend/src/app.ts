import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './modules/auth/auth.routes'
import employeesRoutes from './modules/employees/employees.routes'
import { errorHandler } from './middleware/error.middleware'

const app = express()

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

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