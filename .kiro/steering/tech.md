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
- **State Management**: Zustand for global state, TanStack Query for server state

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
- **Type parsers** configured to match Supabase client behavior (DATE as string, NUMERIC as number, BIGINT as number)
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
- **State management**: Zustand for global state, TanStack Query for server state
