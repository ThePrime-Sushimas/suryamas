import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/employee-branches',
  tags: ['Employee Branches'],
  security: [{ bearerAuth: [] }],
  summary: 'List employee branch assignments',
  request: {
    query: z.object({
      employee_id: z.string().uuid().optional()
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/employee-branches',
  tags: ['Employee Branches'],
  security: [{ bearerAuth: [] }],
  summary: 'Assign employee to branch',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            employee_id: z.string().uuid(),
            branch_id: z.string().uuid()
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
  method: 'delete',
  path: '/api/v1/employee-branches/{id}',
  tags: ['Employee Branches'],
  security: [{ bearerAuth: [] }],
  summary: 'Remove employee branch assignment',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})
