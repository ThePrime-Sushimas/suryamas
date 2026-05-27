# Suryamas ERP - Technology Stack

## Build System & Tooling

- **Monorepo structure** with root-level package.json managing concurrent backend/frontend development
- **Concurrently** used to run backend and frontend dev servers together

## Backend (Node.js/Express)

### Core Stack
- **Runtime**: Node.js (ES2020 target)
- **Framework**: Express.js 4.22+
- **Language**: TypeScript 5.9+ with strict mode enabled
- **Database**: PostgreSQL via `pg` pool
- **Authentication**: JWT tokens with bcryptjs password hashing

### Key Libraries
- **Validation**: Zod for schema validation (also used for OpenAPI spec)
- **Logging**: Winston with daily rotate file transports
- **OpenAPI**: `@asteasolutions/zod-to-openapi` for API documentation
- **File handling**: ExcelJS for XLSX, Multer for file uploads, AWS SDK for S3
- **Email**: Nodemailer for sending emails

### Project Structure
```
backend/src/
├── config/          # DB, logger, OpenAPI config
├── middleware/      # Auth, validation, error handling
├── modules/         # Feature modules (auth, products, etc.)
├── routes/          # Route definitions
├── services/        # Business logic services
├── types/           # Shared TypeScript types
├── utils/           # Utilities (error-handler, response)
└── seeds/           # Database seeders
```

### Common Commands
```bash
# Development
npm run dev          # Start both backend and frontend
npm run dev:backend  # Backend only

# Build & Deploy
npm run build        # Compile TypeScript to dist/
npm start            # Start production server

# Database
npm run seed         # Run database seeders
```

## Frontend (React/Vite)

### Core Stack
- **Runtime**: React 19.2+ with React DOM
- **Build Tool**: Vite 7.2+
- **Language**: TypeScript 5.9+ with strict mode
- **Routing**: React Router DOM 7.10+
- **State Management**: TanStack Query for server state

### UI Stack
- **Styling**: Tailwind CSS 4.1+ with PostCSS
- **Icons**: Lucide React
- **Charts/Maps**: Leaflet for maps, custom charts
- **Animation**: Framer Motion 12.38+

### Key Libraries
- **Forms**: React Hook Form with @hookform/resolvers
- **HTTP**: Axios for API calls
- **Date handling**: date-fns 4.1+
- **Excel**: SheetJS (xlsx) for imports/exports

### Project Structure
```
frontend/src/
├── components/      # Reusable UI components
├── contexts/        # React contexts (Toast, etc.)
├── features/        # Feature modules (auth, products, etc.)
├── hooks/           # Custom React hooks
├── lib/             # Shared libraries
├── pages/           # Page components
├── services/        # API and service clients
└── utils/           # Shared utilities
```

### Common Commands
```bash
# Development
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run build:analyze # Build with bundle analysis
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

## Database

- **PostgreSQL** as the sole database
- **Migrations** stored in `backend/database/migrations/`
- **Type parsers** configured to match client behavior (DATE as string, NUMERIC as number, BIGINT as number)
- **Connection pooling** via `pg` pool with SSL for non-local connections

## Code Style & Conventions

### Backend
- **ESLint**: TypeScript ESLint with security plugin
- **Strict mode**: `@typescript-eslint/no-explicit-any: warn`
- **Validation**: Use `req.validated.body/params/query` instead of `req.body` directly
- **Error handling**: Custom error classes extending `AppError` with `handleError` utility
- **Logging**: Use `logInfo`, `logError`, `logWarn` with sanitized data
- **No process.env**: Use environment variables through config layer

### Frontend
- **Component pattern**: Feature-based organization with lazy loading
- **Permission model**: `RequirePermission` component wraps protected routes
- **Branch context**: All operations run within branch context with `BranchSelectionGuard`
- **State management**: TanStack Query for server state
- **URL State**: List page filters MUST be synced to URL search params via `useUrlFilters` hook

## URL State Management (Frontend)

All list/index pages MUST persist filter, pagination, and search state in URL search params. This enables shareable links, browser back/forward navigation, and page refresh without losing context.

### Core Library: `@/lib/urlFilters`

```typescript
import {
  useUrlFilters,
  useListNavigation,
  parsePositiveInt,
  parseEnum,
  parseString,
  serializeString,
  serializeNumber,
  mergeWithPageReset,
  type UrlFilterBase,
  type UrlFilterUtils,
} from '@/lib/urlFilters'
```

### Pattern: Feature Filter Config

Each feature defines its own filter type and config in a dedicated file (e.g. `features/{feature}/utils/{feature}Filters.url.ts`):

```typescript
// features/daily-prep-orders/utils/dpoFilters.url.ts
import {
  parsePositiveInt, parseEnum, parseString,
  serializeString, serializeNumber, mergeWithPageReset,
  type UrlFilterBase, type UrlFilterUtils,
} from '@/lib/urlFilters'

type DpoStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | ''
const VALID_STATUSES = new Set<DpoStatus>(['DRAFT', 'CONFIRMED', 'CANCELLED', ''])

export type DpoFilters = UrlFilterBase & {
  status: DpoStatus
  branch_id: string
  date_from: string
  date_to: string
  search: string
}

export const DPO_FILTER_DEFAULTS: DpoFilters = {
  page: 1,
  limit: 25,
  status: '',
  branch_id: '',
  date_from: '',
  date_to: '',
  search: '',
}

export const dpoFilterConfig: UrlFilterUtils<DpoFilters> = {
  defaults: DPO_FILTER_DEFAULTS,

  parse: (sp) => ({
    page: parsePositiveInt(sp.get('page'), 1),
    limit: parsePositiveInt(sp.get('limit'), 25, 100),
    status: parseEnum(sp.get('status'), VALID_STATUSES, ''),
    branch_id: parseString(sp.get('branch_id')),
    date_from: parseString(sp.get('date_from')),
    date_to: parseString(sp.get('date_to')),
    search: parseString(sp.get('search')),
  }),

  stringify: (f) => {
    const sp = new URLSearchParams()
    const s = (k: string, v: string | null) => { if (v) sp.set(k, v) }
    s('page', serializeNumber(f.page, 1))
    s('limit', serializeNumber(f.limit, 25))
    s('status', serializeString(f.status))
    s('branch_id', serializeString(f.branch_id))
    s('date_from', serializeString(f.date_from))
    s('date_to', serializeString(f.date_to))
    s('search', serializeString(f.search))
    return sp
  },

  merge: (current, patch) =>
    mergeWithPageReset(current, patch, DPO_FILTER_DEFAULTS, ['status', 'branch_id', 'date_from', 'date_to', 'search']),
}
```

### Pattern: Page Component Usage

```typescript
// features/daily-prep-orders/pages/DailyPrepOrdersPage.tsx
import { useUrlFilters, useListNavigation } from '@/lib/urlFilters'
import { dpoFilterConfig } from '../utils/dpoFilters.url'

export default function DailyPrepOrdersPage() {
  const { filters, searchInput, setSearchInput, setFilters, resetFilters, setPage } =
    useUrlFilters({ ...dpoFilterConfig, searchField: 'search' })
  const { openDetail } = useListNavigation('/daily-prep-orders')

  // Pass filters directly to TanStack Query
  const { data, isLoading } = useDpoList(filters)

  return (
    // UI uses filters for controlled inputs, setFilters for changes
  )
}
```

### Pattern: Detail Page Back Navigation

```typescript
// features/daily-prep-orders/pages/DpoDetailPage.tsx
import { useListNavigation } from '@/lib/urlFilters'

export default function DpoDetailPage() {
  const { backToList } = useListNavigation('/daily-prep-orders')
  // backToList() preserves the list's query string
}
```

### Rules

1. **No `useState` for list filters** — always use `useUrlFilters` for filter/pagination/search state on list pages
2. **Default values are omitted from URL** — `stringify` returns `null` for default values to keep URLs clean
3. **Page resets on filter change** — use `mergeWithPageReset` to auto-reset page to 1 when filters change
4. **Search is debounced** — pass `searchField` to `useUrlFilters` for automatic debounce (400ms default)
5. **Detail navigation preserves list state** — use `useListNavigation` for openDetail/backToList
6. **Filter config lives in `utils/{feature}Filters.url.ts`** — keeps page component clean
