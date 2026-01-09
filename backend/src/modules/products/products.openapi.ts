import { registry } from '../../config/openapi'
import { z } from '@/lib/openapi'

registry.registerPath({
  method: 'get',
  path: '/api/v1/products',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'List all products',
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      sort: z.string().optional(),
      order: z.enum(['asc', 'desc']).optional(),
      category_id: z.string().optional(),
      is_active: z.string().optional()
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/products/search',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Search products',
  request: {
    query: z.object({
      q: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional()
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/products/minimal/active',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Get minimal active products for dropdown',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/products',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Create product',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            product_code: z.string().optional(),
            product_name: z.string(),
            bom_name: z.string().optional(),
            category_id: z.string().uuid(),
            sub_category_id: z.string().uuid(),
            product_type: z.enum(['Finished Goods', 'Raw Material', 'Semi-Finished', 'Service']).optional(),
            average_cost: z.number().min(0).optional(),
            is_requestable: z.boolean().optional(),
            is_purchasable: z.boolean().optional(),
            notes: z.string().optional(),
            status: z.enum(['active', 'inactive', 'discontinued']).optional()
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
  path: '/api/v1/products/{id}',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Get product by ID',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'put',
  path: '/api/v1/products/{id}',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Update product',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            product_name: z.string().optional(),
            bom_name: z.string().optional(),
            category_id: z.string().uuid().optional(),
            sub_category_id: z.string().uuid().optional(),
            product_type: z.enum(['Finished Goods', 'Raw Material', 'Semi-Finished', 'Service']).optional(),
            average_cost: z.number().min(0).optional(),
            is_requestable: z.boolean().optional(),
            is_purchasable: z.boolean().optional(),
            notes: z.string().optional(),
            status: z.enum(['active', 'inactive', 'discontinued']).optional()
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
  path: '/api/v1/products/{id}',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Delete product',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Deleted' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/products/{id}/restore',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Restore deleted product',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'Restored' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/products/bulk/delete',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Bulk delete products',
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

registry.registerPath({
  method: 'post',
  path: '/api/v1/products/bulk/update-status',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Bulk update product status',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            ids: z.array(z.string().uuid()),
            status: z.enum(['active', 'inactive', 'discontinued'])
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
  method: 'post',
  path: '/api/v1/products/bulk/restore',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Bulk restore products',
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
    200: { description: 'Restored' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/products/filter-options',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Get filter options for products',
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/products/check/name',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Check if product name exists',
  request: {
    query: z.object({
      product_name: z.string(),
      excludeId: z.string().uuid().optional()
    })
  },
  responses: {
    200: { description: 'Success' }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/v1/products/export',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Export products to Excel',
  responses: {
    200: { description: 'Excel file' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/products/import/preview',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Preview import products from Excel',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.any()
          })
        }
      }
    }
  },
  responses: {
    200: { description: 'Preview data' }
  }
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/products/import',
  tags: ['Products'],
  security: [{ bearerAuth: [] }],
  summary: 'Import products from Excel',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.any()
          })
        }
      }
    }
  },
  responses: {
    200: { description: 'Import result' }
  }
})
