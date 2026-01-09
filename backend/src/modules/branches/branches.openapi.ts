import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/branches',
  tags: ['Branches'],
  security: [{ bearerAuth: [] }],
  summary: 'List all branches',
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
  path: '/api/v1/branches/minimal/active',
  tags: ['Branches'],
  security: [{ bearerAuth: [] }],
  summary: 'Get minimal active branches for dropdown',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/branches',
  tags: ['Branches'],
  security: [{ bearerAuth: [] }],
  summary: 'Create branch',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            company_id: z.string().uuid(),
            name: z.string(),
            code: z.string(),
            address: z.string().optional(),
            phone: z.string().optional()
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
  path: '/api/v1/branches/{id}',
  tags: ['Branches'],
  security: [{ bearerAuth: [] }],
  summary: 'Get branch by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/branches/{id}',
  tags: ['Branches'],
  security: [{ bearerAuth: [] }],
  summary: 'Update branch',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            code: z.string().optional(),
            address: z.string().optional(),
            phone: z.string().optional()
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
  path: '/api/v1/branches/{id}',
  tags: ['Branches'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete branch',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})
