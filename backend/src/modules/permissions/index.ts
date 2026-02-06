// =====================================================
// PERMISSIONS MODULE EXPORTS
// =====================================================

// Controllers
export { ModulesController } from './modules.controller'
export { RolesController } from './roles.controller'
export { RolePermissionsController } from './role-permissions.controller'
export { SeedController } from './seed.controller'

// Services
export { ModulesService } from './modules.service'
export { RolesService } from './roles.service'
export { RolePermissionsService } from './role-permissions.service'

// Repositories
export { ModulesRepository } from './modules.repository'
export { RolesRepository } from './roles.repository'
export { RolePermissionsRepository } from './role-permissions.repository'

// Cache
export { PermissionsCache } from './permissions.cache'

// Errors
export { 
  PermissionsError as OperationalError, 
  NotFoundError, 
  ConflictError, 
  ValidationError 
} from './permissions.errors'

// Types
export * from './permissions.types'

// Routes
export { default as permissionsRouter } from './permissions.routes'
