import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './modules/auth/auth.routes'
import employeesRoutes from './modules/employees/employees.routes'
import companiesRoutes from './modules/companies/companies.routes'
import permissionsRoutes from './modules/permissions/permissions.routes'
import usersRoutes from './modules/users/users.routes'
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
app.use('/api/v1/companies', companiesRoutes)
app.use('/api/v1/permissions', permissionsRoutes)
app.use('/api/v1/users', usersRoutes)

// Error handler
app.use(errorHandler)

export default app