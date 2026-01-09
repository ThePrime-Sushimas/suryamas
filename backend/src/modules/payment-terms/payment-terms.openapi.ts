import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/payment-terms',
  tags: ['Payment Terms'],
  security: [{ bearerAuth: [] }],
  summary: 'List all payment terms',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/payment-terms',
  tags: ['Payment Terms'],
  security: [{ bearerAuth: [] }],
  summary: 'Create payment term',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            code: z.string(),
            days: z.number().int().min(0)
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
  path: '/api/v1/payment-terms/{id}',
  tags: ['Payment Terms'],
  security: [{ bearerAuth: [] }],
  summary: 'Get payment term by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/payment-terms/{id}',
  tags: ['Payment Terms'],
  security: [{ bearerAuth: [] }],
  summary: 'Update payment term',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            code: z.string().optional(),
            days: z.number().int().min(0).optional()
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
  path: '/api/v1/payment-terms/{id}',
  tags: ['Payment Terms'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete payment term',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})
