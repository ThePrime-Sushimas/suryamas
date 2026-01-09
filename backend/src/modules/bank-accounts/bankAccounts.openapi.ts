import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/bank-accounts',
  tags: ['Bank Accounts'],
  security: [{ bearerAuth: [] }],
  summary: 'List all bank accounts',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/bank-accounts',
  tags: ['Bank Accounts'],
  security: [{ bearerAuth: [] }],
  summary: 'Create bank account',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            bank_id: z.string().uuid(),
            account_number: z.string(),
            account_name: z.string(),
            branch_name: z.string().optional()
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
  path: '/api/v1/bank-accounts/{id}',
  tags: ['Bank Accounts'],
  security: [{ bearerAuth: [] }],
  summary: 'Get bank account by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/bank-accounts/{id}',
  tags: ['Bank Accounts'],
  security: [{ bearerAuth: [] }],
  summary: 'Update bank account',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            account_number: z.string().optional(),
            account_name: z.string().optional(),
            branch_name: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: { description: 'Updated' }
  }
})

registry.registerPath({
  method: 'delete',
  path: '/api/v1/bank-accounts/{id}',
  tags: ['Bank Accounts'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete bank account',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})
