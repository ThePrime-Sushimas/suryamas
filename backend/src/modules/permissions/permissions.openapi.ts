import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

// MODULES
registry.registerPath({
  method: 'get',
  path: '/api/v1/permissions/modules',
  tags: ['Permissions'],
  security: [{ bearerAuth: [] }],
  summary: 'List all modules',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/permissions/modules',
  tags: ['Permissions'],
  security: [{ bearerAuth: [] }],
  summary: 'Create module',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            code: z.string(),
            name: z.string()
          })
        }
      }
    }
  },
  responses: {
    201: { description: 'Created' }
  }
})

// ROLES
registry.registerPath({
  method: 'get',
  path: '/api/v1/permissions/roles',
  tags: ['Permissions'],
  security: [{ bearerAuth: [] }],
  summary: 'List all roles',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/permissions/roles',
  tags: ['Permissions'],
  security: [{ bearerAuth: [] }],
  summary: 'Create role',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
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
  path: '/api/v1/permissions/roles/{id}',
  tags: ['Permissions'],
  security: [{ bearerAuth: [] }],
  summary: 'Get role by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

// ROLE PERMISSIONS
registry.registerPath({
  method: 'get',
  path: '/api/v1/permissions/roles/{roleId}/permissions',
  tags: ['Permissions'],
  security: [{ bearerAuth: [] }],
  summary: 'Get role permissions',
  request: { params: z.object({ roleId: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/permissions/roles/{roleId}/permissions',
  tags: ['Permissions'],
  security: [{ bearerAuth: [] }],
  summary: 'Bulk update role permissions',
  request: {
    params: z.object({ roleId: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            permissions: z.array(z.object({
              module_id: z.string().uuid(),
              can_view: z.boolean(),
              can_insert: z.boolean(),
              can_update: z.boolean(),
              can_delete: z.boolean()
            }))
          })
        }
      }
    }
  },
  responses: {
    200: { description: 'Updated' }
  }
})

// USER PERMISSIONS
registry.registerPath({
  method: 'get',
  path: '/api/v1/permissions/me/permissions',
  tags: ['Permissions'],
  security: [{ bearerAuth: [] }],
  summary: 'Get current user permissions',
  responses: {
    200: { description: 'Success' }
  }
})
