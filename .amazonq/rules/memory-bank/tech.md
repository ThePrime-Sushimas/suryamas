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
