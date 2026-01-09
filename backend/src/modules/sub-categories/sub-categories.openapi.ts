import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/sub-categories',
  tags: ['Sub Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'List all sub categories',
  request: {
    query: z.object({
      category_id: z.string().uuid().optional()
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/sub-categories',
  tags: ['Sub Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'Create sub category',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            category_id: z.string().uuid(),
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
  path: '/api/v1/sub-categories/{id}',
  tags: ['Sub Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'Get sub category by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/sub-categories/{id}',
  tags: ['Sub Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'Update sub category',
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
  path: '/api/v1/sub-categories/{id}',
  tags: ['Sub Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete sub category',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})
