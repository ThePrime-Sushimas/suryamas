import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/metric-units',
  tags: ['Metric Units'],
  security: [{ bearerAuth: [] }],
  summary: 'List all metric units',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/metric-units',
  tags: ['Metric Units'],
  security: [{ bearerAuth: [] }],
  summary: 'Create metric unit',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            code: z.string(),
            symbol: z.string().optional()
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
  path: '/api/v1/metric-units/{id}',
  tags: ['Metric Units'],
  security: [{ bearerAuth: [] }],
  summary: 'Get metric unit by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/metric-units/{id}',
  tags: ['Metric Units'],
  security: [{ bearerAuth: [] }],
  summary: 'Update metric unit',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            code: z.string().optional(),
            symbol: z.string().optional()
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
  path: '/api/v1/metric-units/{id}',
  tags: ['Metric Units'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete metric unit',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})
