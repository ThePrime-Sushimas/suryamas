import { z } from 'zod'

const uuidSchema = z.string().uuid()

// Module schemas
export const moduleIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const createModuleSchema = z.object({
  body: z.object({
    module_name: z.string().min(1).max(100),
    description: z.string().max(255).optional(),
  }),
})

export const updateModuleSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    module_name: z.string().min(1).max(100).optional(),
    description: z.string().max(255).optional(),
  }),
})

// Role schemas
export const roleIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(255).optional(),
  }),
})

export const updateRoleSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(255).optional(),
  }),
})

// Role permissions schemas
export const rolePermissionsSchema = z.object({
  params: z.object({
    roleId: uuidSchema,
  }),
})

export const updateRolePermissionSchema = z.object({
  params: z.object({
    roleId: uuidSchema,
    moduleId: uuidSchema,
  }),
  body: z.object({
    can_view: z.boolean().optional(),
    can_insert: z.boolean().optional(),
    can_update: z.boolean().optional(),
    can_delete: z.boolean().optional(),
  }),
})

export const bulkUpdateRolePermissionsSchema = z.object({
  params: z.object({
    roleId: uuidSchema,
  }),
  body: z.array(z.object({
    module_id: uuidSchema,
    can_view: z.boolean().optional(),
    can_insert: z.boolean().optional(),
    can_update: z.boolean().optional(),
    can_delete: z.boolean().optional(),
  })),
})