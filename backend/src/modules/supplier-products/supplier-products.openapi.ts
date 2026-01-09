import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/supplier-products',
  tags: ['Supplier Products'],
  security: [{ bearerAuth: [] }],
  summary: 'List supplier products',
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
      supplier_id: z.string().uuid().optional(),
      product_id: z.string().uuid().optional(),
      is_preferred: z.string().optional(),
      is_active: z.string().optional(),
      sort_by: z.enum(['price', 'lead_time_days', 'min_order_qty', 'created_at']).optional(),
      sort_order: z.enum(['asc', 'desc']).optional()
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/supplier-products/options/active',
  tags: ['Supplier Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Get active supplier products for dropdown',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/supplier-products/supplier/{supplier_id}',
  tags: ['Supplier Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Get supplier products by supplier ID',
  request: {
    params: z.object({ supplier_id: z.string().uuid() })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/supplier-products/product/{product_id}',
  tags: ['Supplier Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Get supplier products by product ID',
  request: {
    params: z.object({ product_id: z.string().uuid() })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/supplier-products/{id}',
  tags: ['Supplier Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Get supplier product by ID',
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/supplier-products',
  tags: ['Supplier Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Create supplier product',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            supplier_id: z.string().uuid(),
            product_id: z.string().uuid(),
            price: z.number().min(0).multipleOf(0.01),
            currency: z.enum(['IDR', 'USD', 'EUR', 'SGD']).optional(),
            lead_time_days: z.number().int().min(0).optional().nullable(),
            min_order_qty: z.number().min(0).optional().nullable(),
            is_preferred: z.boolean().optional(),
            is_active: z.boolean().optional()
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
  method: 'put',
  path: '/api/v1/supplier-products/{id}',
  tags: ['Supplier Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Update supplier product',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            price: z.number().min(0).multipleOf(0.01).optional(),
            currency: z.enum(['IDR', 'USD', 'EUR', 'SGD']).optional(),
            lead_time_days: z.number().int().min(0).optional().nullable(),
            min_order_qty: z.number().min(0).optional().nullable(),
            is_preferred: z.boolean().optional(),
            is_active: z.boolean().optional()
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
  path: '/api/v1/supplier-products/{id}',
  tags: ['Supplier Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete supplier product',
  request: {
    params: z.object({ id: z.string().uuid() })
  },
  responses: {
    200: { description: 'Deleted' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/supplier-products/bulk/delete',
  tags: ['Supplier Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Bulk delete supplier products',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            ids: z.array(z.string().uuid())
          })
        }
      }
    }
  },
  responses: {
    200: { description: 'Deleted' }
  }
})
