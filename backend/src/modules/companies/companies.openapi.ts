import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

const CompanyResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
}).openapi('Company')

const CompanyListResponse = z.object({
  success: z.boolean(),
  data: z.array(CompanyResponse),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
  })
}).openapi('CompanyListResponse')

registry.registerPath({
  method: 'get',
  path: '/api/v1/companies',
  tags: ['Companies'],
  security: [{ bearerAuth: [] }],
  summary: 'List all companies',
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      sort: z.string().optional(),
      order: z.enum(['asc', 'desc']).optional()
    })
  },
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: CompanyListResponse } } }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/companies',
  tags: ['Companies'],
  security: [{ bearerAuth: [] }],
  summary: 'Create company',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            code: z.string(),
            address: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().email().optional()
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
  path: '/api/v1/companies/{id}',
  tags: ['Companies'],
  security: [{ bearerAuth: [] }],
  summary: 'Get company by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/companies/{id}',
  tags: ['Companies'],
  security: [{ bearerAuth: [] }],
  summary: 'Update company',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            code: z.string().optional(),
            address: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().email().optional()
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
  path: '/api/v1/companies/{id}',
  tags: ['Companies'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete company',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})
