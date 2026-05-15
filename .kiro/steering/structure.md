# Suryamas ERP - Project Structure

## Directory Layout

```
suryamas/
├── backend/              # Express.js backend API
│   ├── database/
│   │   └── migrations/   # PostgreSQL migrations
│   ├── src/
│   │   ├── config/       # DB, logger, OpenAPI config
│   │   ├── middleware/   # Auth, validation, error handling
│   │   ├── modules/      # Feature modules
│   │   │   ├── auth/
│   │   │   ├── products/
│   │   │   └── ...       # One folder per feature
│   │   ├── routes/       # Route definitions
│   │   ├── services/     # Business logic services
│   │   ├── types/        # Shared TypeScript types
│   │   ├── utils/        # Utilities (error-handler, response)
│   │   └── seeds/        # Database seeders
│   └── package.json
├── frontend/             # React/Vite frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── contexts/     # React contexts
│   │   ├── features/     # Feature modules
│   │   │   ├── auth/
│   │   │   ├── products/
│   │   │   └── ...       # One folder per feature
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Shared libraries
│   │   ├── pages/        # Page components
│   │   ├── services/     # API and service clients
│   │   └── utils/        # Shared utilities
│   └── package.json
└── package.json          # Root monorepo config
```

## Backend Module Structure

Each feature module follows this pattern:

```
backend/src/modules/{feature}/
├── {feature}.controller.ts   # HTTP request handlers
├── {feature}.service.ts      # Business logic
├── {feature}.repository.ts   # Database queries
├── {feature}.routes.ts       # Express router setup
├── {feature}.schema.ts       # Zod validation schemas
├── {feature}.types.ts        # TypeScript types/interfaces
├── {feature}.errors.ts       # Custom error classes
└── {feature}.openapi.ts      # OpenAPI spec definitions
```

### Module Components

**Controller** (`{feature}.controller.ts`)
- Handles HTTP requests/responses
- Uses `validateSchema` middleware for input validation
- Calls service methods
- Uses `handleError` for error handling
- Uses `sendSuccess`/`sendError` for responses

**Service** (`{feature}.service.ts`)
- Contains business logic
- Uses repository for database operations
- Handles validation, authorization, and business rules
- Logs operations with `logInfo`, `logError`, `logWarn`
- Uses `AuditService` for audit logging

**Repository** (`{feature}.repository.ts`)
- Contains raw SQL queries
- Uses parameterized queries for security
- Returns plain objects matching database schema
- Handles soft deletes with `deleted_at IS NULL`

**Routes** (`{feature}.routes.ts`)
- Defines API endpoints
- Applies middleware (auth, validation)
- Maps routes to controller methods

**Schema** (`{feature}.schema.ts`)
- Zod schemas for request validation
- Defines params, query, and body schemas
- Used by `validateSchema` middleware

**Types** (`{feature}.types.ts`)
- TypeScript interfaces and types
- DTOs for request/response objects
- Domain-specific type definitions

**Errors** (`{feature}.errors.ts`)
- Custom error classes extending base errors
- Uses `ErrorRegistry` for dynamic loading
- Follows error naming convention: `{Feature}Error`

## Frontend Feature Structure

Each feature follows this pattern:

```
frontend/src/features/{feature}/
├── api/                    # API service functions
│   └── {feature}.ts
├── components/             # Feature-specific components
├── pages/                  # Page components
│   ├── {Feature}Page.tsx
│   ├── Create{Feature}Page.tsx
│   ├── Edit{Feature}Page.tsx
│   └── {Feature}DetailPage.tsx
├── store/                  # Zustand store (optional)
└── types/                  # TypeScript types (optional)
```

### Frontend Components

**Pages** (`{feature}/pages/`)
- `*Page.tsx` files for list, create, edit, detail views
- Lazy-loaded in `App.tsx`
- Protected with `RequirePermission` component
- Use `BranchSelectionGuard` for branch context

**API Service** (`{feature}/api/`)
- Axios-based API functions
- Returns typed responses
- Handles authentication headers

**Store** (`{feature}/store/`)
- Zustand store for feature state
- Manages local state and caching

## Routing Structure

### Backend
- All routes prefixed with `/api/v1/`
- Module routes registered in `backend/src/app.ts`
- Example: `/api/v1/products`, `/api/v1/auth/login`

### Frontend
- Protected routes under `/` with `Layout` component
- Branch context required for most routes
- Permission-based access via `RequirePermission`
- Lazy-loaded feature routes in `App.tsx`

## Database Conventions

### Table Naming
- Snake case: `products`, `purchase_orders`, `goods_receipts`
- Plural form for collections

### Column Naming
- Snake case: `created_at`, `updated_at`, `deleted_at`
- Foreign keys: `{related_table}_id` (e.g., `product_id`)

### Soft Deletes
- All tables have `deleted_at` column (nullable)
- Queries filter with `deleted_at IS NULL`
- Repository methods handle this automatically

### Audit Columns
- `created_at`, `updated_at`: Timestamps
- `created_by`, `updated_by`: User references
- `deleted_at`: Soft delete timestamp

## API Response Format

### Success
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "pagination": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": "Error message",
  "validation_errors": [ ... ],
  "code": "ERROR_CODE"
}
```

## Permission Model

- Permissions stored in database with module-level granularity
- Frontend checks permissions via `RequirePermission` component
- Backend checks permissions in service layer
- Permission object structure: `{ module: { view, create, update, delete } }`
