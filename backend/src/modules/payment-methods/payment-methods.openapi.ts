import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

// OpenAPI documentation for Payment Methods API

registry.registerPath({
  method: 'get',
  path: '/api/v1/payment-methods',
  tags: ['Payment Methods'],
  security: [{ bearerAuth: [] }],
  summary: 'List all payment methods',
  description: 'Retrieves a paginated list of payment methods for the authenticated company',
  request: {
    query: z.object({
      page: z.string().optional().default('1'),
      limit: z.string().optional().default('10'),
      payment_type: z.string().optional(),
      is_active: z.string().optional(),
      requires_bank_account: z.string().optional(),
      search: z.string().optional()
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/payment-methods',
  tags: ['Payment Methods'],
  security: [{ bearerAuth: [] }],
  summary: 'Create a new payment method',
  description: 'Creates a new payment method for the authenticated company',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            company_id: z.string().uuid(),
            code: z.string().max(20),
            name: z.string().max(100),
            description: z.string().nullable().optional(),
            payment_type: z.enum(['CASH', 'BANK_TRANSFER', 'GIRO', 'CREDIT_CARD', 'DEBIT_CARD', 'DIGITAL_WALLET', 'OTHER']),
            bank_account_id: z.number().int().positive().nullable().optional(),
            coa_account_id: z.string().uuid().nullable().optional(),
            is_default: z.boolean().optional().default(false),
            requires_bank_account: z.boolean().optional().default(false),
            sort_order: z.number().int().optional()
          })
        }
      }
    }
  },
  responses: {
    201: { description: 'Created' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/payment-methods/{id}',
  tags: ['Payment Methods'],
  security: [{ bearerAuth: [] }],
  summary: 'Get payment method by ID',
  request: {
    params: z.object({
      id: z.string()
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/payment-methods/{id}',
  tags: ['Payment Methods'],
  security: [{ bearerAuth: [] }],
  summary: 'Update a payment method',
  request: {
    params: z.object({
      id: z.string()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().max(100).optional(),
            description: z.string().nullable().optional(),
            payment_type: z.enum(['CASH', 'BANK_TRANSFER', 'GIRO', 'CREDIT_CARD', 'DEBIT_CARD', 'DIGITAL_WALLET', 'OTHER']).optional(),
            bank_account_id: z.number().int().positive().nullable().optional(),
            coa_account_id: z.string().uuid().nullable().optional(),
            is_active: z.boolean().optional(),
            is_default: z.boolean().optional(),
            requires_bank_account: z.boolean().optional(),
            sort_order: z.number().int().optional()
          })
        }
      }
    }
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'delete',
  path: '/api/v1/payment-methods/{id}',
  tags: ['Payment Methods'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete a payment method',
  request: {
    params: z.object({
      id: z.string()
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/payment-methods/options',
  tags: ['Payment Methods'],
  security: [{ bearerAuth: [] }],
  summary: 'Get payment method options',
  description: 'Retrieves active payment methods for dropdown/select components',
  responses: {
    200: { description: 'Success' }
  }
})

