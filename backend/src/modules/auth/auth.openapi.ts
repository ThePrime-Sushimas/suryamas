import { z } from '../../lib/openapi'
import { registry } from '../../config/openapi'

// Login
registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
            password: z.string().min(6),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              user: z.object({
                id: z.string(),
                email: z.string(),
                full_name: z.string(),
              }),
              token: z.string(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Invalid credentials',
    },
  },
})

// Logout
registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['Authentication'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Logout successful',
    },
  },
})

// Get Current User
registry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  tags: ['Authentication'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Current user info',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              id: z.string(),
              email: z.string(),
              full_name: z.string(),
              role: z.string(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
    },
  },
})
