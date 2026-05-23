import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/users',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  summary: 'List all users',
  responses: {
    200: { description: 'Success' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/users/{userId}',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  summary: 'Get user by ID',
  request: { params: z.object({ userId: z.string() }) },
  responses: {
    200: { description: 'Success' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/users/{userId}/role',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  summary: 'Get user role from primary branch assignment',
  request: { params: z.object({ userId: z.string() }) },
  responses: {
    200: { description: 'Success' },
  },
})
