import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/categories',
  tags: ['Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'List all categories',
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
  path: '/api/v1/categories/search',
  tags: ['Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'Search categories',
  request: {
    query: z.object({
      q: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional()
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/categories',
  tags: ['Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'Create category',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            code: z.string(),
            description: z.string().optional()
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
  path: '/api/v1/categories/{id}',
  tags: ['Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'Get category by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/categories/{id}',
  tags: ['Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'Update category',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            code: z.string().optional(),
            description: z.string().optional()
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
  path: '/api/v1/categories/{id}',
  tags: ['Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete category',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})

registry.registerPath({
  method: 'patch',
  path: '/api/v1/categories/{id}/restore',
  tags: ['Categories'],
  security: [{ bearerAuth: [] }],
  summary: 'Restore deleted category',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Restored' }
  }
})
