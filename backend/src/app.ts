import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
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
import pricelistsRoutes from './modules/pricelists/pricelists.routes'
import { errorHandler } from './middleware/error.middleware'
import { requestLogger } from './middleware/request-logger.middleware'
import { generateOpenApiDocument } from './config/openapi'

const app = express()

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}))
app.use(express.json())
app.use(requestLogger)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// OpenAPI Documentation
const openApiDocument = generateOpenApiDocument()
app.get('/openapi.json', (req, res) => {
  res.json(openApiDocument)
})
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Sushimas ERP API Docs'
}))

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
app.use('/api/v1/pricelists', pricelistsRoutes)
app.use('/api/v1', ownerBankAccountsRouter)

// Error handler
app.use(errorHandler)

export default app