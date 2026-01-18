---
description: A description of your rule
---

Your rule content
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


# Product Overview - Suryamas ERP System

## Project Purpose
Suryamas is a comprehensive Enterprise Resource Planning (ERP) system designed for multi-branch business operations. It provides end-to-end management of accounting, inventory, suppliers, employees, and financial operations with robust permission controls and branch-level context management.

## Value Proposition
- **Multi-Branch Operations**: Seamlessly manage multiple business locations with branch-specific data isolation and permissions
- **Financial Compliance**: Production-ready accounting module with journal entries, chart of accounts, fiscal periods, and general ledger
- **Role-Based Access Control**: Granular permission system with module-level and action-level controls
- **Supplier & Inventory Management**: Complete product catalog, supplier relationships, pricing, and UOM management
- **Audit Trail**: Comprehensive tracking of all financial transactions and state changes
- **Real-time Context Switching**: Dynamic branch context with automatic permission recalculation

## Key Features

### Accounting & Finance
- **Chart of Accounts**: Hierarchical account structure with 5-level depth, account types (Asset, Liability, Equity, Revenue, Expense)
- **Journal Entries**: Complete double-entry bookkeeping with status workflow (Draft → Submitted → Approved → Posted)
- **Fiscal Periods**: Period management with opening/closing controls to prevent posting to closed periods
- **General Ledger**: Automated posting from journals with balance tracking
- **Accounting Purposes**: Predefined account mappings for automated journal generation (COGS, Sales, Inventory, etc.)
- **Multi-Currency Support**: Exchange rate handling with base currency conversion

### Inventory & Products
- **Product Management**: Complete product catalog with categories, sub-categories, and hierarchical organization
- **Metric Units (UOM)**: Base units and conversion factors for flexible measurement
- **Product UOMs**: Product-specific unit conversions with pricing per unit
- **Supplier Products**: Supplier-specific product codes, pricing, and lead times
- **Pricelists**: Flexible pricing with effective dates, branch-specific pricing, and supplier integration

### Supplier Management
- **Supplier Registry**: Complete supplier information with contact details, addresses, and bank accounts
- **Supplier Types**: Categorization (Manufacturer, Distributor, Wholesaler, Retailer, Service Provider)
- **Payment Terms**: Configurable payment terms with due date calculations
- **Bank Accounts**: Multiple bank accounts per supplier with primary account designation

### Organization & Access Control
- **Companies**: Multi-company support with company-level data isolation
- **Branches**: Branch hierarchy with location tracking (latitude/longitude for mapping)
- **Employees**: Employee management with role assignments and branch access
- **Employee Branches**: Many-to-many relationship allowing employees to access multiple branches
- **Roles & Permissions**: Granular permission matrix (module × action) with role-based assignments
- **Branch Context**: Dynamic context switching with automatic permission recalculation

### User Management
- **Authentication**: Supabase-based authentication with JWT tokens
- **User Profiles**: User accounts linked to employees with role assignments
- **Permission Caching**: Optimized permission checks with in-memory caching
- **Session Management**: Secure session handling with automatic token refresh

## Target Users

### Primary Users
1. **Finance Managers**: Manage chart of accounts, journal entries, fiscal periods, and financial reporting
2. **Accountants**: Create and post journal entries, reconcile accounts, manage ledger entries
3. **Inventory Managers**: Manage products, categories, UOMs, and stock levels
4. **Purchasing Managers**: Manage suppliers, supplier products, pricelists, and payment terms
5. **Branch Managers**: Oversee branch-specific operations with appropriate permissions
6. **System Administrators**: Configure companies, branches, roles, permissions, and user access

### Secondary Users
1. **Auditors**: Review audit trails, journal entries, and financial transactions
2. **Executives**: View reports and dashboards (future feature)
3. **Sales Staff**: Access product information and pricing (future feature)

## Use Cases

### Accounting Operations
1. **Manual Journal Entry**: Create, submit, approve, and post manual journal entries
2. **Period Closing**: Close fiscal periods to prevent further postings
3. **Account Setup**: Configure chart of accounts with proper hierarchy and account types
4. **Journal Reversal**: Reverse posted journals with automatic reversal entry creation
5. **Multi-Currency Transactions**: Record transactions in foreign currencies with exchange rates

### Inventory Operations
1. **Product Catalog Management**: Create and organize products with categories and sub-categories
2. **UOM Configuration**: Set up base units and conversion factors
3. **Supplier Product Mapping**: Link products to suppliers with supplier-specific codes and pricing
4. **Pricelist Management**: Create and maintain pricelists with effective dates and branch-specific pricing

### Supplier Management
1. **Supplier Onboarding**: Register new suppliers with complete information
2. **Payment Terms Setup**: Configure payment terms with due date calculations
3. **Bank Account Management**: Maintain supplier bank accounts for payment processing
4. **Supplier Product Pricing**: Track supplier-specific pricing and lead times

### Access Control
1. **Branch Context Switching**: Switch between branches with automatic permission updates
2. **Role Assignment**: Assign roles to users with module-level permissions
3. **Permission Verification**: Real-time permission checks for all operations
4. **Multi-Branch Access**: Grant employees access to multiple branches

### Data Management
1. **Bulk Import**: Import products, suppliers, and other master data via Excel
2. **Bulk Export**: Export data to Excel for reporting and analysis
3. **Audit Trail Review**: Track all changes to financial data with complete audit logs
4. **Data Validation**: Comprehensive validation at API and database levels

## Technical Highlights
- **Monorepo Structure**: Separate backend (Express.js) and frontend (React + Vite) with shared types
- **Type Safety**: Full TypeScript implementation with strict type checking
- **Database**: PostgreSQL via Supabase with ENUM types for data integrity
- **State Management**: Zustand for frontend state with optimistic updates
- **API Documentation**: OpenAPI/Swagger documentation for all endpoints
- **Error Handling**: Centralized error handling with custom error classes
- **Logging**: Winston-based logging with daily rotation
- **Security**: Helmet, CORS, rate limiting, and JWT authentication
- **Validation**: Zod schemas for request/response validation
- **Performance**: Pagination, caching, and optimized queries


# Project Structure - Suryamas ERP System

## Directory Overview

```
suryamas/
├── backend/                 # Express.js REST API server
├── frontend/                # React + Vite SPA
├── .amazonq/               # Amazon Q configuration and memory bank
├── JOURNAL_ENTRY_MODULE.md # Comprehensive journal entry documentation
└── package.json            # Root workspace configuration
```

## Backend Structure (`/backend`)

### Core Architecture
```
backend/
├── src/
│   ├── app.ts              # Express app configuration
│   ├── server.ts           # Server entry point
│   ├── bootstrap/          # Application initialization
│   ├── config/             # Configuration files
│   ├── middleware/         # Express middleware
│   ├── modules/            # Feature modules (domain-driven)
│   ├── services/           # Shared business services
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Utility functions
├── database/
│   └── seeds/              # Database seed data
├── logs/                   # Winston log files
└── package.json
```

### Module Structure Pattern
Each module follows a consistent structure:
```
modules/{module-name}/
├── {module}.controller.ts   # HTTP request handlers
├── {module}.service.ts      # Business logic layer
├── {module}.repository.ts   # Database access layer
├── {module}.routes.ts       # Express route definitions
├── {module}.schema.ts       # Zod validation schemas
├── {module}.types.ts        # TypeScript interfaces
├── {module}.errors.ts       # Custom error classes
├── {module}.constants.ts    # Module constants
├── {module}.openapi.ts      # OpenAPI documentation
├── {module}.mapper.ts       # Data transformation (optional)
└── index.ts                 # Module exports
```

### Key Modules

#### Accounting Module (`modules/accounting/`)
- **chart-of-accounts**: Account hierarchy and management
- **fiscal-periods**: Period management with open/close controls
- **accounting-purposes**: Predefined account mappings for automation
- **accounting-purpose-accounts**: Account assignments to purposes
- **journals**: Journal entry management (headers + lines)
- **ledger-entries**: General ledger posting and balance tracking
- **shared**: Common accounting types, errors, and constants

#### Organization Modules
- **companies**: Multi-company support
- **branches**: Branch management with location tracking
- **employees**: Employee registry and management
- **employee_branches**: Employee-branch access relationships
- **users**: User authentication and profiles

#### Inventory & Supplier Modules
- **products**: Product catalog management
- **categories**: Product categorization
- **sub-categories**: Sub-category hierarchy
- **metric-units**: Base measurement units
- **product-uoms**: Product-specific UOM conversions
- **suppliers**: Supplier registry
- **supplier-products**: Supplier-product relationships
- **pricelists**: Pricing management

#### Financial Modules
- **banks**: Bank registry
- **bank-accounts**: Bank account management
- **payment-terms**: Payment term configurations

#### Access Control Modules
- **auth**: Authentication endpoints
- **permissions**: Role-based access control
  - modules.controller.ts: Module management
  - roles.controller.ts: Role management
  - role-permissions.controller.ts: Permission assignments
  - permissions.cache.ts: In-memory permission caching

### Middleware Layer (`middleware/`)
- **auth.middleware.ts**: JWT authentication and user extraction
- **branch-context.middleware.ts**: Branch context validation and injection
- **permission.middleware.ts**: Permission verification
- **validation.middleware.ts**: Zod schema validation
- **error.middleware.ts**: Centralized error handling
- **request-logger.middleware.ts**: HTTP request logging
- **query.middleware.ts**: Query parameter parsing
- **rateLimiter.middleware.ts**: Rate limiting
- **upload.middleware.ts**: File upload handling

### Services Layer (`services/`)
- **audit.service.ts**: Audit trail management
- **permission.service.ts**: Permission calculation and caching
- **export.service.ts**: Generic data export to Excel
- **import.service.ts**: Generic data import from Excel
- **products.export.service.ts**: Product-specific export
- **products.import.service.ts**: Product-specific import

### Configuration (`config/`)
- **supabase.ts**: Supabase client configuration
- **logger.ts**: Winston logger setup
- **openapi.ts**: OpenAPI/Swagger configuration
- **banks.config.ts**: Bank data configuration

### Utilities (`utils/`)
- **response.util.ts**: Standardized API responses
- **error-handler.util.ts**: Error handling utilities
- **pagination.util.ts**: Pagination helpers
- **validation.util.ts**: Validation utilities
- **permissions.util.ts**: Permission checking utilities
- **cache.util.ts**: Caching utilities
- **bulk.util.ts**: Bulk operation helpers
- **export.util.ts**: Export utilities
- **employee.util.ts**: Employee-related utilities

## Frontend Structure (`/frontend`)

### Core Architecture
```
frontend/
├── src/
│   ├── main.tsx            # Application entry point
│   ├── App.tsx             # Root component with routing
│   ├── index.css           # Global styles (Tailwind)
│   ├── components/         # Shared UI components
│   ├── features/           # Feature modules (domain-driven)
│   ├── pages/              # Top-level pages
│   ├── hooks/              # Shared React hooks
│   ├── lib/                # Third-party library configurations
│   ├── services/           # API service layer
│   ├── stores/             # Global Zustand stores
│   └── utils/              # Utility functions
├── public/                 # Static assets
└── package.json
```

### Feature Module Pattern
Each feature follows a consistent structure:
```
features/{feature-name}/
├── api/                    # API client functions
│   └── {feature}.api.ts
├── components/             # Feature-specific components
│   ├── {Feature}Form.tsx
│   ├── {Feature}Table.tsx
│   └── {Feature}*.tsx
├── pages/                  # Feature pages
│   ├── {Feature}sPage.tsx      (list)
│   ├── Create{Feature}Page.tsx
│   ├── Edit{Feature}Page.tsx
│   └── {Feature}DetailPage.tsx
├── store/                  # Zustand state management
│   └── {feature}.store.ts
├── types/                  # TypeScript types
│   └── {feature}.types.ts
├── constants/              # Feature constants
│   └── {feature}.constants.ts
├── utils/                  # Feature utilities
│   ├── validation.ts
│   ├── format.ts
│   └── errorParser.ts
├── schemas/                # Validation schemas (optional)
│   └── {feature}.schema.ts
├── hooks/                  # Feature-specific hooks (optional)
└── index.ts                # Feature exports
```

### Key Features

#### Accounting Features (`features/accounting/`)
- **chart-of-accounts**: Account management UI
- **fiscal-periods**: Period management UI
- **accounting-purposes**: Purpose configuration UI
- **accounting-purpose-accounts**: Account assignment UI
- **journals**: Journal entry UI (headers + lines)
- **ledger-entries**: General ledger viewing

#### Branch Context (`features/branch_context/`)
- **components/BranchSwitcher**: Branch selection dropdown
- **components/BranchSelectionGuard**: Route guard for branch requirement
- **components/PermissionProvider**: Permission context provider
- **hooks/useBranchContext**: Branch context hook
- **hooks/usePermission**: Permission checking hook
- **store/branchContext.store.ts**: Branch context state
- **store/permission.store.ts**: Permission state

#### Organization Features
- **companies**: Company management UI
- **branches**: Branch management UI
- **employees**: Employee management UI
- **employee_branches**: Employee-branch assignment UI
- **users**: User management UI

#### Inventory & Supplier Features
- **products**: Product catalog UI
- **categories**: Category management UI
- **metric_units**: UOM management UI
- **product-uoms**: Product UOM configuration UI
- **suppliers**: Supplier management UI
- **supplier-products**: Supplier product mapping UI
- **pricelists**: Pricelist management UI

#### Financial Features
- **banks**: Bank management UI
- **bank-accounts**: Bank account management UI
- **payment-terms**: Payment term configuration UI

#### Access Control Features
- **auth**: Authentication pages (login, register, forgot password)
- **permissions**: Permission management UI

### Shared Components (`components/`)
- **layout/Layout.tsx**: Main application layout with sidebar and header
- **ui/**: Reusable UI components
  - ConfirmModal.tsx: Confirmation dialog
  - Skeleton.tsx: Loading skeleton
  - ToastContainer.tsx: Toast notifications
- **mobile/**: Mobile-specific components
  - BottomNav.tsx: Mobile bottom navigation
  - MobileDrawer.tsx: Mobile drawer menu
  - FloatingActionButton.tsx: FAB for mobile actions
- **BulkActionBar.tsx**: Bulk operation toolbar
- **ExportButton.tsx**: Data export button
- **ImportModal.tsx**: Data import modal
- **ErrorBoundary.tsx**: Error boundary component

### Shared Hooks (`hooks/_shared/`)
- **useBulkSelection.ts**: Bulk selection state management
- **useDebounce.ts**: Debounce hook for search inputs
- **useMediaQuery.ts**: Responsive design hook
- **useUomSearch.ts**: UOM search functionality

### Library Configuration (`lib/`)
- **axios.ts**: Axios instance with interceptors for auth and error handling
- **errorParser.ts**: API error parsing utilities

### Services (`services/`)
- **permissionService.ts**: Permission checking service
- **userService.ts**: User-related operations

## Architectural Patterns

### Backend Patterns
1. **Layered Architecture**: Controller → Service → Repository
2. **Dependency Injection**: Services injected into controllers
3. **Repository Pattern**: Database abstraction layer
4. **Error Handling**: Custom error classes with HTTP status codes
5. **Validation**: Zod schemas at API boundary
6. **OpenAPI Documentation**: Auto-generated from Zod schemas
7. **Middleware Chain**: Auth → Branch Context → Permission → Validation
8. **Audit Trail**: Automatic tracking of all state changes

### Frontend Patterns
1. **Feature-Based Organization**: Domain-driven module structure
2. **State Management**: Zustand stores per feature
3. **API Layer Separation**: Dedicated API client functions
4. **Form Handling**: React Hook Form with Zod validation
5. **Optimistic Updates**: Immediate UI updates with rollback on error
6. **Error Boundaries**: Graceful error handling at component level
7. **Context Providers**: Branch context and permission context
8. **Route Guards**: Permission-based route protection

### Data Flow
```
Frontend Request
    ↓
Axios Interceptor (add auth token)
    ↓
Backend Route
    ↓
Auth Middleware (verify JWT)
    ↓
Branch Context Middleware (validate branch)
    ↓
Permission Middleware (check permissions)
    ↓
Validation Middleware (validate request)
    ↓
Controller (handle request)
    ↓
Service (business logic)
    ↓
Repository (database access)
    ↓
Supabase (PostgreSQL)
    ↓
Response
    ↓
Axios Interceptor (handle errors)
    ↓
Frontend Store Update
    ↓
UI Re-render
```

## Key Relationships

### Module Dependencies
- **Journals** depend on **Chart of Accounts** and **Fiscal Periods**
- **Ledger Entries** depend on **Journals** and **Chart of Accounts**
- **Accounting Purpose Accounts** depend on **Accounting Purposes** and **Chart of Accounts**
- **Employee Branches** depend on **Employees** and **Branches**
- **Supplier Products** depend on **Suppliers** and **Products**
- **Pricelists** depend on **Supplier Products** and **Branches**
- **Bank Accounts** depend on **Banks** and **Suppliers**

### Cross-Cutting Concerns
- **Authentication**: Required for all protected routes
- **Branch Context**: Required for branch-specific operations
- **Permissions**: Checked for all CRUD operations
- **Audit Trail**: Logged for all financial transactions
- **Validation**: Applied at API boundary and database level


# Technology Stack - Suryamas ERP System

## Programming Languages
- **TypeScript 5.9.3**: Primary language for both backend and frontend
- **JavaScript**: Node.js runtime environment

## Backend Technology Stack

### Core Framework
- **Express.js 4.18.2**: Web application framework
- **Node.js**: JavaScript runtime (version specified in `.node-version`)

### Database & ORM
- **PostgreSQL**: Primary database (via Supabase)
- **Supabase 2.38.0**: Backend-as-a-Service for database, auth, and storage
- **Raw SQL**: Direct database queries (no ORM)

### Authentication & Security
- **JWT**: JSON Web Tokens for authentication
- **Helmet 7.1.0**: Security headers middleware
- **CORS 2.8.5**: Cross-Origin Resource Sharing
- **express-rate-limit 8.2.1**: Rate limiting middleware

### Validation & Documentation
- **Zod 4.2.1**: Schema validation and type inference
- **@asteasolutions/zod-to-openapi 8.4.0**: OpenAPI schema generation from Zod
- **swagger-ui-express 5.0.1**: API documentation UI

### File Processing
- **Multer 2.0.2**: File upload handling
- **ExcelJS 4.4.0**: Excel file generation and parsing
- **XLSX 0.18.5**: Excel file processing

### Logging & Monitoring
- **Winston 3.19.0**: Logging framework
- **winston-daily-rotate-file 5.0.0**: Log rotation

### Development Tools
- **ts-node-dev 2.0.0**: TypeScript development server with hot reload
- **tsconfig-paths 4.2.0**: Path mapping for TypeScript
- **module-alias 2.2.3**: Module path aliasing for production

### Testing
- **Jest 30.2.0**: Testing framework
- **ts-jest 29.4.6**: TypeScript support for Jest
- **Supertest 7.1.4**: HTTP assertion library

## Frontend Technology Stack

### Core Framework
- **React 19.2.0**: UI library
- **React DOM 19.2.0**: React renderer for web
- **Vite 7.2.4**: Build tool and development server

### Routing & Navigation
- **React Router DOM 7.10.1**: Client-side routing

### State Management
- **Zustand 5.0.9**: Lightweight state management

### Form Handling
- **React Hook Form 7.68.0**: Form state management
- **@hookform/resolvers 5.2.2**: Validation resolvers for React Hook Form

### HTTP Client
- **Axios 1.13.2**: Promise-based HTTP client

### UI & Styling
- **Tailwind CSS 4.1.17**: Utility-first CSS framework
- **@tailwindcss/postcss 4.1.17**: PostCSS plugin for Tailwind
- **PostCSS 8.5.6**: CSS transformation tool
- **Autoprefixer 10.4.22**: CSS vendor prefixing
- **Lucide React 0.561.0**: Icon library

### Maps & Geolocation
- **Leaflet 1.9.4**: Interactive maps library
- **React Leaflet 5.0.0**: React components for Leaflet

### File Processing
- **XLSX 0.18.5**: Excel file processing

### Development Tools
- **TypeScript 5.9.3**: Type checking
- **ESLint 9.39.1**: Code linting
- **@vitejs/plugin-react 5.1.1**: React plugin for Vite
- **rollup-plugin-visualizer 6.0.5**: Bundle size visualization

### Type Definitions
- **@types/react 19.2.5**: React type definitions
- **@types/react-dom 19.2.3**: React DOM type definitions
- **@types/leaflet 1.9.21**: Leaflet type definitions
- **@types/node 24.10.1**: Node.js type definitions

## Build System & Tooling

### Package Management
- **npm**: Package manager (lockfiles present)
- **Monorepo**: Root workspace with backend and frontend packages

### Build Tools
- **TypeScript Compiler (tsc)**: TypeScript compilation
- **Vite**: Frontend bundling and development server
- **Rollup**: Module bundler (via Vite)

### Code Quality
- **ESLint**: Linting for both backend and frontend
- **TypeScript Strict Mode**: Enabled for type safety
- **Prettier**: Code formatting (implied by ESLint config)

### Development Workflow
- **Concurrently 9.2.1**: Run multiple npm scripts simultaneously
- **Hot Module Replacement (HMR)**: Vite for frontend, ts-node-dev for backend

## Database Schema

### Database Type System
- **PostgreSQL ENUMs**: Type-safe enumerations
  - `journal_type_enum`: Journal types
  - `journal_status_enum`: Journal statuses
  - `account_type_enum`: Account types
  - `period_status_enum`: Fiscal period statuses

### Key Database Features
- **UUID Primary Keys**: Using `uuid_generate_v4()`
- **Foreign Key Constraints**: Referential integrity
- **Check Constraints**: Data validation at database level
- **Indexes**: Performance optimization
- **Soft Deletes**: `deleted_at` timestamp pattern
- **Audit Columns**: `created_at`, `updated_at`, `created_by`, `updated_by`
- **Generated Columns**: Computed columns (e.g., `period` from `journal_date`)

## Development Commands

### Root Workspace
```bash
npm run dev                 # Run both backend and frontend
npm run dev:backend         # Run backend only
npm run dev:frontend        # Run frontend only
npm run install:all         # Install all dependencies
npm run build               # Build backend
npm run build:backend       # Build backend
npm run build:frontend      # Build frontend
npm start                   # Start production backend
```

### Backend
```bash
npm run dev                 # Development server with hot reload
npm run build               # Compile TypeScript to JavaScript
npm start                   # Start production server
npm run railway:start       # Build and start (for Railway deployment)
npm run seed                # Run database seeds
npm test                    # Run tests
npm test:watch              # Run tests in watch mode
npm test:coverage           # Run tests with coverage
```

### Frontend
```bash
npm run dev                 # Development server (Vite)
npm run build               # Build for production
npm run build:analyze       # Build with bundle analysis
npm run lint                # Run ESLint
npm run preview             # Preview production build
```

## Environment Configuration

### Backend Environment Variables
```
# Supabase
SUPABASE_URL=               # Supabase project URL
SUPABASE_ANON_KEY=          # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=  # Supabase service role key

# Server
PORT=                       # Server port (default: 3000)
NODE_ENV=                   # Environment (development/production)

# CORS
FRONTEND_URL=               # Frontend URL for CORS
```

### Frontend Environment Variables
```
VITE_API_URL=               # Backend API URL
VITE_SUPABASE_URL=          # Supabase project URL
VITE_SUPABASE_ANON_KEY=     # Supabase anonymous key
```

## Deployment Configuration

### Backend Deployment
- **Platform**: Railway (configured via `render.yaml`)
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Node Version**: Specified in `.node-version`

### Frontend Deployment
- **Platform**: Vercel (configured via `vercel.json`)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Framework**: Vite

## API Documentation

### OpenAPI/Swagger
- **Endpoint**: `/api-docs` (backend)
- **Generation**: Auto-generated from Zod schemas
- **UI**: Swagger UI Express

### API Versioning
- **Version**: v1
- **Base Path**: `/api/v1`

## Performance Optimizations

### Backend
- **Pagination**: Implemented for all list endpoints
- **Caching**: In-memory permission caching
- **Connection Pooling**: Supabase connection management
- **Rate Limiting**: Request throttling per IP
- **Log Rotation**: Daily log file rotation

### Frontend
- **Code Splitting**: Vite automatic code splitting
- **Lazy Loading**: React.lazy for route-based splitting
- **Bundle Analysis**: Rollup visualizer for bundle optimization
- **Optimistic Updates**: Immediate UI feedback with rollback
- **Debouncing**: Search input debouncing

## Security Features

### Backend Security
- **Helmet**: Security headers (XSS, clickjacking, etc.)
- **CORS**: Restricted to frontend origin
- **Rate Limiting**: Prevent brute force attacks
- **JWT Validation**: Token verification on protected routes
- **Input Validation**: Zod schema validation
- **SQL Injection Prevention**: Parameterized queries
- **Error Sanitization**: No sensitive data in error responses

### Frontend Security
- **XSS Prevention**: React automatic escaping
- **CSRF Protection**: Token-based authentication
- **Secure Storage**: No sensitive data in localStorage
- **HTTPS Only**: Production deployment on HTTPS
- **Content Security Policy**: Configured via Helmet

## Testing Strategy

### Backend Testing
- **Unit Tests**: Jest for service and utility functions
- **Integration Tests**: Supertest for API endpoints
- **Coverage**: Jest coverage reporting

### Frontend Testing
- **Component Tests**: (To be implemented)
- **E2E Tests**: (To be implemented)

## Logging & Monitoring

### Backend Logging
- **Winston**: Structured logging
- **Log Levels**: error, warn, info, debug
- **Log Files**: 
  - `combined-{date}.log`: All logs
  - `error-{date}.log`: Error logs only
- **Rotation**: Daily rotation with compression

### Frontend Logging
- **Console**: Development logging
- **Error Boundaries**: React error boundary for crash reporting

## Version Control

### Git Configuration
- **Repository**: GitHub
- **Branching**: (To be documented)
- **Commit Convention**: (To be documented)

### Ignored Files
- `node_modules/`
- `dist/`
- `.env`
- `logs/`
- `.vercel/`
- Build artifacts

## IDE & Development Environment

### Recommended IDE
- **Visual Studio Code**: Primary IDE
- **Extensions**:
  - ESLint
  - Prettier
  - TypeScript
  - Tailwind CSS IntelliSense

### TypeScript Configuration
- **Strict Mode**: Enabled
- **Path Mapping**: `@/*` for src directory
- **Target**: ES2020+
- **Module**: ESNext (frontend), CommonJS (backend)

