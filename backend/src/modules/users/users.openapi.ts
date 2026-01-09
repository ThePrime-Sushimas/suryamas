import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/users',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  summary: 'List all users',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/users/{userId}',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  summary: 'Get user by ID',
  request: { params: z.object({ userId: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/users/{userId}/role',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  summary: 'Get user role',
  request: { params: z.object({ userId: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/users/{userId}/role',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  summary: 'Assign role to user',
  request: {
    params: z.object({ userId: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            role_id: z.string().uuid()
          })
        }
      }
    }
  },
  responses: {
    200: { description: 'Role assigned' }
  }
})

registry.registerPath({
  method: 'delete',
  path: '/api/v1/users/{userId}/role',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  summary: 'Remove role from user',
  request: { params: z.object({ userId: z.string().uuid() }) },
  responses: {
    200: { description: 'Role removed' }
  }
})
