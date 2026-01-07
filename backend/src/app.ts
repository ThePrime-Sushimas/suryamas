import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './modules/auth/auth.routes'
import employeesRoutes from './modules/employees/employees.routes'
import companiesRoutes from './modules/companies/companies.routes'
import branchesRoutes from './modules/branches/branches.routes'
import categoriesRoutes from './modules/categories/categories.routes'
import subCategoriesRoutes from './modules/sub-categories/sub-categories.routes'
import permissionsRoutes from './modules/permissions/permissions.routes'
import usersRoutes from './modules/users/users.routes'
import metricUnitsRoutes from './modules/metric-units/metricUnits.routes'
import productsRoutes from './modules/products/products.routes'
import productUomsRoutes from './modules/product-uoms/product-uoms.routes'
import employeeBranchesRoutes from './modules/employee_branches/employee_branches.routes'
import paymentTermsRoutes from './modules/payment-terms/payment-terms.routes'
import suppliersRoutes from './modules/suppliers/suppliers.routes'
import banksRoutes from './modules/banks/banks.routes'
import bankAccountsRoutes, { ownerBankAccountsRouter } from './modules/bank-accounts/bankAccounts.routes'
import supplierProductsRoutes from './modules/supplier-products/supplier-products.routes'
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
app.use('/api/v1/branches', branchesRoutes)
app.use('/api/v1/categories', categoriesRoutes)
app.use('/api/v1/sub-categories', subCategoriesRoutes)
app.use('/api/v1/permissions', permissionsRoutes)
app.use('/api/v1/users', usersRoutes)
app.use('/api/v1/metric-units', metricUnitsRoutes)
app.use('/api/v1/products', productsRoutes)
app.use('/api/v1/product-uoms', productUomsRoutes)
app.use('/api/v1/employee-branches', employeeBranchesRoutes)
app.use('/api/v1/payment-terms', paymentTermsRoutes)
app.use('/api/v1/suppliers', suppliersRoutes)
app.use('/api/v1/banks', banksRoutes)
app.use('/api/v1/bank-accounts', bankAccountsRoutes)
app.use('/api/v1/supplier-products', supplierProductsRoutes)
app.use('/api/v1', ownerBankAccountsRouter)

// Error handler
app.use(errorHandler)

export default app