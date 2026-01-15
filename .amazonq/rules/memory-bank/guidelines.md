# Development Guidelines - Suryamas ERP System

## Code Quality Standards

### TypeScript Standards
- **Strict Type Safety**: All code uses TypeScript with strict mode enabled
- **Explicit Types**: Function parameters and return types are explicitly typed
- **Interface Over Type**: Use `interface` for object shapes, `type` for unions/intersections
- **No `any`**: Avoid `any` type; use `unknown` or proper types instead
- **Null Safety**: Use optional chaining (`?.`) and nullish coalescing (`??`)

### Naming Conventions
- **Files**: kebab-case (e.g., `accounting-purposes.repository.ts`)
- **Classes**: PascalCase (e.g., `AccountingPurposesRepository`)
- **Functions/Variables**: camelCase (e.g., `findById`, `currentBranch`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `CURRENCY_OPTIONS`)
- **Interfaces**: PascalCase with descriptive names (e.g., `CreatePricelistDto`)
- **Types**: PascalCase (e.g., `PermissionAction`)
- **Private Methods**: Prefix with underscore is NOT used; use TypeScript `private` keyword

### File Organization
- **Module Pattern**: Each feature has consistent file structure:
  - `{module}.types.ts` - TypeScript interfaces and types
  - `{module}.constants.ts` - Module constants
  - `{module}.errors.ts` - Custom error classes
  - `{module}.repository.ts` - Database access layer
  - `{module}.service.ts` - Business logic layer
  - `{module}.controller.ts` - HTTP request handlers
  - `{module}.routes.ts` - Express route definitions
  - `{module}.schema.ts` - Zod validation schemas
  - `{module}.openapi.ts` - OpenAPI documentation
  - `index.ts` - Module exports

### Documentation Standards
- **JSDoc Comments**: All public functions have JSDoc comments
- **Parameter Documentation**: Document all parameters with `@param`
- **Return Documentation**: Document return values with `@returns`
- **Example Format**:
  ```typescript
  /**
   * Finds all accounting purposes with pagination, sorting, and filtering
   * @param companyId Company identifier
   * @param pagination Pagination parameters with limit and offset
   * @param sort Optional sort parameters (field and order)
   * @param filter Optional filter parameters (applied_to, is_active, search query)
   * @returns Promise resolving to paginated results with data array and total count
   */
  ```
- **Inline Comments**: Use for complex logic explanation, not obvious code
- **Module Headers**: Frontend components include module documentation block

## Backend Patterns

### Repository Layer Pattern
```typescript
export class {Module}Repository {
  // In-memory cache with TTL
  private cache = new Map<string, CacheEntry<any>>()
  private cleanupTimer: NodeJS.Timeout | null = null
  private readonly config: {Module}Config

  constructor(config: {Module}Config = defaultConfig) {
    this.config = config
    this.startCacheCleanup()
  }

  // Cache management
  private getCacheKey(prefix: string, params: Record<string, any>): string
  private getFromCache<T>(key: string): T | null
  private setCache<T>(key: string, data: T, ttl?: number): void
  private invalidateCache(pattern?: string): void

  // CRUD operations
  async findAll(companyId: string, pagination, sort?, filter?): Promise<{data: T[], total: number}>
  async findById(id: string, companyId: string): Promise<T | null>
  async create(data: CreateDto, userId: string): Promise<T>
  async update(id: string, companyId: string, updates: UpdateDto): Promise<T | null>
  async delete(id: string, companyId: string): Promise<void>

  // Bulk operations
  async bulkUpdateStatus(companyId: string, ids: string[], updateData): Promise<void>
  async bulkDelete(companyId: string, ids: string[]): Promise<void>

  // Cleanup
  destroy(): void
}
```

### Key Repository Patterns
1. **Singleton Export**: Export single instance at bottom of file
   ```typescript
   export const accountingPurposesRepository = new AccountingPurposesRepository()
   ```

2. **Cache Strategy**:
   - Use prefix-based cache keys (e.g., `list:`, `detail:`, `code:`)
   - Invalidate related caches on mutations
   - TTL-based expiration with periodic cleanup
   - Max cache size enforcement

3. **Error Handling**:
   - Validate inputs before database calls
   - Catch and wrap database errors in custom error classes
   - Log all errors with context
   - Re-throw custom errors, wrap unknown errors

4. **Logging Pattern**:
   ```typescript
   logInfo('Repository findAll success', { 
     company_id: companyId, 
     count: result.data.length, 
     total: result.total 
   })
   ```

5. **Soft Delete Pattern**:
   ```typescript
   async delete(id: string, companyId: string): Promise<void> {
     const { error } = await supabase
       .from('table')
       .update({
         is_deleted: true,
         deleted_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
       })
       .eq('id', id)
       .eq('company_id', companyId)
   }
   ```

6. **Audit Trail Pattern**:
   - Always include `created_by`, `updated_by` in mutations
   - Automatically set timestamps (`created_at`, `updated_at`)
   - Track deletion with `deleted_at`, `deleted_by`

### Service Layer Pattern
- Business logic validation
- Orchestrate multiple repository calls
- Transaction management
- Permission checks
- State machine enforcement

### Controller Layer Pattern
- Request validation using Zod schemas
- Extract user context from `req.user`
- Extract branch context from `req.branchContext`
- Call service layer methods
- Return standardized responses using `sendSuccess` or `sendError`

### Middleware Chain Pattern
```typescript
router.get(
  '/path',
  authenticate,              // JWT verification
  requireBranchContext,      // Branch context injection
  canView('module_name'),    // Permission check
  validateRequest(schema),   // Request validation
  controller.method          // Business logic
)
```

### Error Handling Pattern
```typescript
export class {Module}Error extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = '{Module}Error'
  }
}

export const {Module}Errors = {
  NOT_FOUND: () => new {Module}Error('Not found', 'NOT_FOUND', 404),
  VALIDATION_ERROR: (field: string, message: string) => 
    new {Module}Error(`${field}: ${message}`, 'VALIDATION_ERROR', 400)
}
```

## Frontend Patterns

### Component Structure Pattern
```typescript
/**
 * Component description
 * 
 * Features:
 * - Feature 1
 * - Feature 2
 * 
 * @module feature/component
 */

import { useState, useCallback, useEffect, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'

export const ComponentName = memo(function ComponentName() {
  // Hooks (in order)
  const navigate = useNavigate()
  const toast = useToast()
  
  // Store state
  const storeData = useStore(s => s.data)
  const storeAction = useStore(s => s.action)
  
  // Local state
  const [formData, setFormData] = useState<Type>({})
  const [errors, setErrors] = useState<ErrorType>({})
  
  // Effects
  useEffect(() => {
    // Side effects
  }, [dependencies])
  
  // Memoized values
  const computed = useMemo(() => {
    return calculation(formData)
  }, [formData])
  
  // Event handlers (useCallback)
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    // Logic
  }, [dependencies])
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  )
})
```

### State Management Pattern (Zustand)
```typescript
interface StoreState {
  // Data
  items: Item[]
  currentItem: Item | null
  
  // Loading states
  loading: {
    list: boolean
    create: boolean
    update: boolean
    delete: boolean
  }
  
  // Error states
  errors: {
    list: string | null
    mutation: string | null
  }
  
  // Actions
  fetchItems: () => Promise<void>
  createItem: (data: CreateDto) => Promise<void>
  updateItem: (id: string, data: UpdateDto) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  clearError: () => void
}

export const useStore = create<StoreState>((set, get) => ({
  items: [],
  currentItem: null,
  loading: { list: false, create: false, update: false, delete: false },
  errors: { list: null, mutation: null },
  
  fetchItems: async () => {
    set({ loading: { ...get().loading, list: true }, errors: { ...get().errors, list: null } })
    try {
      const data = await api.list()
      set({ items: data, loading: { ...get().loading, list: false } })
    } catch (error) {
      set({ 
        errors: { ...get().errors, list: parseError(error) },
        loading: { ...get().loading, list: false }
      })
    }
  }
}))
```

### Form Handling Pattern
1. **Controlled Inputs**: All form inputs are controlled components
2. **Validation**: Use Zod schemas for validation
3. **Error Display**: Show errors only for touched fields
4. **Optimistic Updates**: Update UI immediately, rollback on error
5. **Loading States**: Disable form during submission
6. **Accessibility**: Include ARIA attributes for errors

### API Client Pattern
```typescript
export const moduleApi = {
  list: async (params?: FilterParams, signal?: AbortSignal) => {
    const response = await axios.get('/api/v1/module', { params, signal })
    return response.data
  },
  
  getById: async (id: string) => {
    const response = await axios.get(`/api/v1/module/${id}`)
    return response.data
  },
  
  create: async (data: CreateDto) => {
    const response = await axios.post('/api/v1/module', data)
    return response.data
  },
  
  update: async (id: string, data: UpdateDto) => {
    const response = await axios.put(`/api/v1/module/${id}`, data)
    return response.data
  },
  
  delete: async (id: string) => {
    await axios.delete(`/api/v1/module/${id}`)
  }
}
```

### Route Lazy Loading Pattern
```typescript
const ModulePage = lazy(() => 
  import('./features/module').then(m => ({ default: m.ModulePage }))
)

// In Routes
<Route 
  path="/module" 
  element={
    <ProtectedRoute>
      <Suspense fallback={<LoadingFallback />}>
        <ModulePage />
      </Suspense>
    </ProtectedRoute>
  } 
/>
```

## Common Patterns

### Pagination Pattern
```typescript
// Backend
interface PaginationParams {
  limit: number
  offset: number
}

// Frontend
const [pagination, setPagination] = useState({
  page: 1,
  limit: 10,
  total: 0
})
```

### Search/Filter Pattern
```typescript
// Debounced search
const [search, setSearch] = useState('')

useEffect(() => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    fetchData(search, controller.signal)
  }, 300)
  
  return () => {
    clearTimeout(timeoutId)
    controller.abort()
  }
}, [search])
```

### Bulk Operations Pattern
```typescript
// Selection state
const [selectedIds, setSelectedIds] = useState<string[]>([])

// Bulk action
const handleBulkDelete = async () => {
  if (selectedIds.length === 0) return
  await bulkDelete(selectedIds)
  setSelectedIds([])
}
```

### Branch Context Pattern
```typescript
// Always check branch context
const currentBranch = useBranchContextStore(s => s.currentBranch)

if (!currentBranch?.company_id) {
  return <BranchRequiredMessage />
}

// Use company_id in API calls
const data = { ...formData, company_id: currentBranch.company_id }
```

### Permission Check Pattern
```typescript
// Backend middleware
router.post('/path', 
  authenticate,
  canInsert('module_name'),
  controller.create
)

// Frontend hook
const { hasPermission } = usePermission()

if (!hasPermission('module_name', 'insert')) {
  return <NoPermissionMessage />
}
```

## Testing Patterns

### Unit Test Pattern
```typescript
describe('ModuleService', () => {
  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange
      const input = { /* test data */ }
      
      // Act
      const result = await service.method(input)
      
      // Assert
      expect(result).toEqual(expected)
    })
    
    it('should handle error case', async () => {
      // Arrange
      const invalidInput = { /* invalid data */ }
      
      // Act & Assert
      await expect(service.method(invalidInput)).rejects.toThrow()
    })
  })
})
```

## Performance Patterns

### Memoization
- Use `useMemo` for expensive calculations
- Use `useCallback` for event handlers passed to child components
- Use `memo` for components that render frequently with same props

### Code Splitting
- Lazy load route components
- Lazy load heavy libraries
- Use dynamic imports for conditional features

### Caching
- Repository-level caching with TTL
- Permission caching in memory
- API response caching with AbortController

### Optimization
- Debounce search inputs (300ms)
- Paginate large lists
- Use virtual scrolling for very large lists (future)
- Optimize bundle size with tree shaking

## Security Patterns

### Input Validation
- Validate all inputs with Zod schemas
- Sanitize user inputs
- Validate on both frontend and backend

### Authentication
- JWT tokens stored in memory (Zustand)
- Automatic token refresh
- Logout on token expiration

### Authorization
- Permission checks on every protected route
- Branch context validation
- Company-level data isolation

### SQL Injection Prevention
- Use parameterized queries (Supabase handles this)
- Never concatenate user input into queries

## Accessibility Patterns

### ARIA Attributes
```typescript
<input
  aria-invalid={!!error}
  aria-describedby={error ? 'field-error' : undefined}
/>
{error && (
  <p id="field-error" role="alert">{error}</p>
)}
```

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Focus management for modals and dialogs
- Skip links for main content

### Semantic HTML
- Use semantic elements (`<nav>`, `<main>`, `<article>`)
- Proper heading hierarchy
- Form labels for all inputs

## Git Workflow Patterns

### Commit Messages
- Use conventional commits format
- Examples: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

### Branch Naming
- Feature branches: `feature/module-name`
- Bug fixes: `fix/issue-description`
- Hotfixes: `hotfix/critical-issue`

## Code Review Checklist

### Before Submitting PR
- [ ] All TypeScript errors resolved
- [ ] No console.log statements
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Accessibility attributes added
- [ ] Documentation updated
- [ ] Tests written (if applicable)

### During Code Review
- [ ] Code follows established patterns
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Error messages are user-friendly
- [ ] Code is maintainable and readable

## Common Pitfalls to Avoid

### Backend
- ❌ Don't skip input validation
- ❌ Don't expose sensitive data in error messages
- ❌ Don't forget to invalidate cache on mutations
- ❌ Don't use `any` type
- ❌ Don't skip logging for errors

### Frontend
- ❌ Don't forget to cleanup effects (AbortController)
- ❌ Don't mutate state directly
- ❌ Don't skip error boundaries
- ❌ Don't forget loading states
- ❌ Don't skip accessibility attributes

## Best Practices Summary

1. **Type Safety**: Use TypeScript strictly, no `any`
2. **Error Handling**: Always handle errors gracefully
3. **Logging**: Log all important operations with context
4. **Validation**: Validate on both frontend and backend
5. **Caching**: Use caching strategically with proper invalidation
6. **Performance**: Optimize for user experience
7. **Security**: Never trust user input
8. **Accessibility**: Make UI accessible to all users
9. **Documentation**: Document complex logic and public APIs
10. **Testing**: Write tests for critical business logic
