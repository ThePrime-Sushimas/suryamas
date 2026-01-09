import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/banks',
  tags: ['Banks'],
  security: [{ bearerAuth: [] }],
  summary: 'List all banks',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/banks',
  tags: ['Banks'],
  security: [{ bearerAuth: [] }],
  summary: 'Create bank',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            code: z.string()
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
  path: '/api/v1/banks/{id}',
  tags: ['Banks'],
  security: [{ bearerAuth: [] }],
  summary: 'Get bank by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/banks/{id}',
  tags: ['Banks'],
  security: [{ bearerAuth: [] }],
  summary: 'Update bank',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            code: z.string().optional()
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
  path: '/api/v1/banks/{id}',
  tags: ['Banks'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete bank',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})
