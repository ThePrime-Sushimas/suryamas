import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/suppliers',
  tags: ['Suppliers'],
  security: [{ bearerAuth: [] }],
  summary: 'List all suppliers',
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      sort: z.string().optional(),
      order: z.enum(['asc', 'desc']).optional()
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/suppliers/options',
  tags: ['Suppliers'],
  security: [{ bearerAuth: [] }],
  summary: 'Get supplier options for dropdown',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/suppliers',
  tags: ['Suppliers'],
  security: [{ bearerAuth: [] }],
  summary: 'Create supplier',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            code: z.string(),
            address: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().email().optional(),
            contact_person: z.string().optional()
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
  path: '/api/v1/suppliers/{id}',
  tags: ['Suppliers'],
  security: [{ bearerAuth: [] }],
  summary: 'Get supplier by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/suppliers/{id}',
  tags: ['Suppliers'],
  security: [{ bearerAuth: [] }],
  summary: 'Update supplier',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            code: z.string().optional(),
            address: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().email().optional()
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
  path: '/api/v1/suppliers/{id}',
  tags: ['Suppliers'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete supplier',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})
