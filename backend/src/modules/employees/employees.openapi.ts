import { z } from '../../lib/openapi'
import { registry } from '../../config/openapi'
import { 
  CreateEmployeeSchema, 
  UpdateEmployeeSchema, 
  UpdateProfileSchema,
  BulkUpdateActiveSchema,
  UpdateActiveSchema,
  BulkDeleteSchema 
} from './employees.schema'

// Register Employee schemas
registry.register('Employee', z.object({
  id: z.string().uuid(),
  employee_id: z.string(),
  full_name: z.string(),
  job_position: z.string().nullable(),
  email: z.string().email().nullable(),
  mobile_phone: z.string().nullable(),
  is_active: z.boolean(),
  branch_name: z.string().nullable(),
  status_employee: z.enum(['Permanent', 'Contract']),
  join_date: z.string(),
  age: z.number().nullable(),
  deleted_at: z.string().nullable(),
}))

// List Employees
registry.registerPath({
  method: 'get',
  path: '/api/v1/employees',
  tags: ['Employees'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      sort: z.string().optional(),
      order: z.enum(['asc', 'desc']).optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of employees',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(z.any()),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
  },
})

// Search Employees
registry.registerPath({
  method: 'get',
  path: '/api/v1/employees/search',
  tags: ['Employees'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      q: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
      branch_name: z.string().optional(),
      job_position: z.string().optional(),
      status_employee: z.string().optional(),
      is_active: z.string().optional(),
      include_deleted: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Search results',
    },
  },
})

// Get Employee by ID
registry.registerPath({
  method: 'get',
  path: '/api/v1/employees/{id}',
  tags: ['Employees'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Employee details',
    },
    404: {
      description: 'Employee not found',
    },
  },
})

// Create Employee
registry.registerPath({
  method: 'post',
  path: '/api/v1/employees',
  tags: ['Employees'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: CreateEmployeeSchema.shape.body,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Employee created',
    },
    400: {
      description: 'Validation error',
    },
  },
})

// Update Employee
registry.registerPath({
  method: 'put',
  path: '/api/v1/employees/{id}',
  tags: ['Employees'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'multipart/form-data': {
          schema: UpdateEmployeeSchema.shape.body,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Employee updated',
    },
    404: {
      description: 'Employee not found',
    },
  },
})

// Delete Employee (Soft Delete)
registry.registerPath({
  method: 'delete',
  path: '/api/v1/employees/{id}',
  tags: ['Employees'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Employee deleted',
    },
  },
})

// Restore Employee
registry.registerPath({
  method: 'post',
  path: '/api/v1/employees/{id}/restore',
  tags: ['Employees'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Employee restored',
    },
  },
})

// Update Employee Active Status
registry.registerPath({
  method: 'patch',
  path: '/api/v1/employees/{id}/active',
  tags: ['Employees'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateActiveSchema.shape.body,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Employee active status updated',
    },
  },
})

// Bulk Update Active
registry.registerPath({
  method: 'post',
  path: '/api/v1/employees/bulk/update-active',
  tags: ['Employees'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: BulkUpdateActiveSchema.shape.body,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Employees updated',
    },
  },
})

// Bulk Delete
registry.registerPath({
  method: 'post',
  path: '/api/v1/employees/bulk/delete',
  tags: ['Employees'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: BulkDeleteSchema.shape.body,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Employees deleted',
    },
  },
})

// Bulk Restore
registry.registerPath({
  method: 'post',
  path: '/api/v1/employees/bulk/restore',
  tags: ['Employees'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: BulkDeleteSchema.shape.body,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Employees restored',
    },
  },
})
