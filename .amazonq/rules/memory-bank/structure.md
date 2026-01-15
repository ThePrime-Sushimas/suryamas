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
