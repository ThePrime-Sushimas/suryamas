import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import { z } from '../lib/openapi'

export const registry = new OpenAPIRegistry()

// Import all module OpenAPI definitions
import '../modules/auth/auth.openapi'
import '../modules/employees/employees.openapi'
import '../modules/companies/companies.openapi'
import '../modules/branches/branches.openapi'
import '../modules/categories/categories.openapi'
import '../modules/products/products.openapi'
import '../modules/suppliers/suppliers.openapi'
import '../modules/users/users.openapi'
import '../modules/permissions/permissions.openapi'
import '../modules/banks/banks.openapi'
import '../modules/bank-accounts/bankAccounts.openapi'
import '../modules/metric-units/metricUnits.openapi'
import '../modules/payment-terms/payment-terms.openapi'
import '../modules/sub-categories/sub-categories.openapi'
import '../modules/employee_branches/employee_branches.openapi'

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions)

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Sushimas ERP API',
      version: '1.0.0',
      description: 'Enterprise Resource Planning API Documentation',
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'API Server',
      },
    ],
  })
}
