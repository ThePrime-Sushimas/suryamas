import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/products/{productId}/uoms',
  tags: ['Product UOMs'],
  security: [{ bearerAuth: [] }],
  summary: 'List product UOMs',
  request: {
    params: z.object({ productId: z.string().uuid() })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/products/{productId}/uoms',
  tags: ['Product UOMs'],
  security: [{ bearerAuth: [] }],
  summary: 'Create product UOM',
  request: {
    params: z.object({ productId: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            metric_unit_id: z.string().uuid(),
            conversion_factor: z.number().positive(),
            is_base_unit: z.boolean().optional(),
            base_price: z.number().nonnegative().optional(),
            is_default_stock_unit: z.boolean().optional(),
            is_default_purchase_unit: z.boolean().optional(),
            is_default_transfer_unit: z.boolean().optional(),
            status_uom: z.enum(['active', 'inactive']).optional()
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
  path: '/api/v1/products/{productId}/uoms/{uomId}',
  tags: ['Product UOMs'],
  security: [{ bearerAuth: [] }],
  summary: 'Update product UOM',
  request: {
    params: z.object({ 
      productId: z.string().uuid(),
      uomId: z.string().uuid()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            metric_unit_id: z.string().uuid().optional(),
            conversion_factor: z.number().positive().optional(),
            is_base_unit: z.boolean().optional(),
            base_price: z.number().nonnegative().optional(),
            is_default_stock_unit: z.boolean().optional(),
            is_default_purchase_unit: z.boolean().optional(),
            is_default_transfer_unit: z.boolean().optional(),
            status_uom: z.enum(['active', 'inactive']).optional()
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
  path: '/api/v1/products/{productId}/uoms/{uomId}',
  tags: ['Product UOMs'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete product UOM',
  request: {
    params: z.object({ 
      productId: z.string().uuid(),
      uomId: z.string().uuid()
    })
  },
  responses: {
    200: { description: 'Deleted' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/products/{productId}/uoms/{uomId}/restore',
  tags: ['Product UOMs'],
  security: [{ bearerAuth: [] }],
  summary: 'Restore deleted product UOM',
  request: {
    params: z.object({ 
      productId: z.string().uuid(),
      uomId: z.string().uuid()
    })
  },
  responses: {
    200: { description: 'Restored' }
  }
})
