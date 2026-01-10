import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/pricelists',
  tags: ['Pricelists'],
  security: [{ bearerAuth: [] }],
  summary: 'List all pricelists',
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      supplier_id: z.string().optional(),
      product_id: z.string().optional(),
      status: z.string().optional(),
      is_active: z.string().optional(),
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/pricelists/lookup',
  tags: ['Pricelists'],
  security: [{ bearerAuth: [] }],
  summary: 'Lookup price for PO',
  request: {
    query: z.object({
      supplier_id: z.string(),
      product_id: z.string(),
      uom_id: z.string(),
      date: z.string().optional(),
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/pricelists',
  tags: ['Pricelists'],
  security: [{ bearerAuth: [] }],
  summary: 'Create pricelist',
  responses: {
    201: { description: 'Created' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/pricelists/{id}',
  tags: ['Pricelists'],
  security: [{ bearerAuth: [] }],
  summary: 'Get pricelist by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/pricelists/{id}',
  tags: ['Pricelists'],
  security: [{ bearerAuth: [] }],
  summary: 'Update pricelist',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Updated' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/pricelists/{id}/approve',
  tags: ['Pricelists'],
  security: [{ bearerAuth: [] }],
  summary: 'Approve or reject pricelist',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'delete',
  path: '/api/v1/pricelists/{id}',
  tags: ['Pricelists'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete pricelist',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})
