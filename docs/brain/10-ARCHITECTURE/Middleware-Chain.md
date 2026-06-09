---
type: architecture
topic: middleware
last_updated: 2026-06-09
---

# Middleware Chain

## Fixed Order (Wajib)

```
authenticate → resolveBranchContext → requireWriteAccess → permission → validateSchema
```

## Middleware Details

### Chain Middleware (Middleware Chain Utama)

| Middleware | File | Purpose |
|------------|------|---------|
| `authenticate` | `auth.middleware.ts` | Verifies JWT, populates `req.user` |
| `resolveBranchContext` | `branch-context.middleware.ts` | Injects `req.context.company_id` and `req.context.branch_id` |
| `requireWriteAccess` | `write-guard.middleware.ts` | Blocks writes to closed fiscal periods or locked branches |
| `permission` | `permission.middleware.ts` | `canView`, `canInsert`, `canUpdate`, `canDelete`, `canApprove`, `canRelease` |
| `validateSchema` | `validation.middleware.ts` | Zod schema validation via `validateSchema(schema)` |

### Supporting Middleware

| Middleware | File | Purpose |
|------------|------|---------|
| `apiKey` | `api-key.middleware.ts` | Validates `x-api-key` header for machine-to-machine access |
| `errorHandler` | `error.middleware.ts` | Central error handling, logging, and monitoring |
| `queryMiddleware` | `query.middleware.ts` | Parses pagination, sort, and filter from query params |
| `rateLimiter` | `rateLimiter.middleware.ts` | Rate limiting per endpoint type (export, create, update) |
| `requestLogger` | `request-logger.middleware.ts` | Logs slow requests (>500ms) and error responses |
| `documentUpload` | `upload-document.middleware.ts` | Multer config for document attachment upload (max 10MB) |
| `upload` | `upload.middleware.ts` | Multer config for general file upload (max 50MB) |

## Individual Middleware Details

### `requireApiKey` (`api-key.middleware.ts`)

Validates requests via `x-api-key` header. Used for machine-to-machine or external service integration.

```typescript
// Reads from req.headers['x-api-key']
// Compares against process.env.API_KEY
// Returns 401 if invalid or missing
```

**Usage**: Route-level, not part of standard chain.

### `errorHandler` (`error.middleware.ts`)

Central error handler — registered at the **end** of the middleware stack via `app.use()`. Handles:

- **ZodError** — validation errors with detailed field messages
- **AppError** — custom errors from error registry
- **Registered errors** — module-specific errors via `isRegisteredError()`
- **PostgreSQL errors** — caught and transformed via `ErrorTransformer`
- **Generic errors** — fallback with user-friendly message

**Exports**:

| Export | Purpose |
|--------|---------|
| `errorHandler` | Main error handler middleware (4 params: err, req, res, next) |
| `asyncHandler` | Wraps async route handlers — catches rejected promises and forwards to `next()` |
| `notFoundHandler` | 404 handler for unmatched routes |
| `unhandledRejectionHandler` | Registers `process.on('unhandledRejection')` — logs and persists to DB |
| `uncaughtExceptionHandler` | Registers `process.on('uncaughtException')` — logs, persists, then exits |

```typescript
import { errorHandler, asyncHandler, notFoundHandler } from '@/middleware/error.middleware'

// Register at the end of middleware stack
app.use(errorHandler)

// Wrap async controllers
router.get('/', asyncHandler(controller.list))
```

**Error persistence**: All errors with status >= 400 are persisted to `monitoringRepository.createErrorReport()` and sent via Telegram/webhook.

### `queryMiddleware` (`query.middleware.ts`)

Parses common query string parameters and attaches to `req`.

**Options**:

| Option | Default | Description |
|--------|---------|-------------|
| `allowedSortFields` | `['id', 'created_at', 'updated_at']` | Whitelist for sort field validation |
| `pagination` | `true` | Enable pagination parsing |
| `defaultSort` | `'id'` | Default sort field |

**Query parameters parsed**:

| Parameter | Parsed to | Example |
|-----------|-----------|---------|
| `page` | `req.pagination.page` | `?page=2` |
| `limit` | `req.pagination.limit` | `?limit=25` |
| `sort` | `req.sort.field` | `?sort=name` |
| `order` | `req.sort.order` | `?order=desc` |
| `filter[status]` | `req.filterParams.status` | `?filter[status]=active` |
| `no_pagination` | Skips pagination | `?no_pagination=true` |

Values that look like booleans or numbers are automatically coerced.

**Usage**: Route-level, before controller.

### `rateLimiter` (`rateLimiter.middleware.ts`)

Uses `express-rate-limit` with predefined limiters:

| Limiter | Window | Max requests | Purpose |
|---------|--------|--------------|---------|
| `exportLimiter` | 1 min | 5 | Export endpoints |
| `createRateLimit` | 1 min | 10 | POST / create endpoints |
| `updateRateLimit` | 1 min | 20 | PUT/PATCH update endpoints |
| `supplierProductsRateLimit` | 1 min | 100 | Supplier-products endpoints |

```typescript
import { exportLimiter, createRateLimit } from '@/middleware/rateLimiter.middleware'

router.post('/export', exportLimiter, controller.export)
router.post('/', createRateLimit, validateSchema(schema), controller.create)
```

### `requestLogger` (`request-logger.middleware.ts`)

Logs HTTP request metadata via `logInfo`. Only logs when:

- Response duration > **500ms** (slow requests)
- Status code >= **400** (errors)

```typescript
// Logs: method, path, status, duration, ip, userAgent
```

**Usage**: Global — register early in middleware stack.

### `documentUpload` (`upload-document.middleware.ts`)

Multer-based middleware for **document/file attachment** uploads (e.g., purchase invoice attachments, goods receipt attachments).

| Config | Value |
|--------|-------|
| Storage | Memory |
| Max file size | **10MB** (`DOCUMENT_UPLOAD_MAX_BYTES`) |
| Allowed types | Images (JPG, PNG, WEBP), PDF, HEIC/HEIF |

```typescript
import { documentUploadSingle } from '@/middleware/upload-document.middleware'

router.post('/', upload.single('attachment'), controller.create)
```

**Error handling**: Built-in error mapper that returns JSON 400 for file too large or unsupported format. Error messages in **Bahasa Indonesia**.

**Related**: `DOCUMENT_UPLOAD_MAX_BYTES` constant aligns with service-layer limits in `marketplace-po` and `goods-receipts`.

### `upload` (`upload.middleware.ts`)

Multer-based middleware for **general file uploads** (broader scope).

| Config | Value |
|--------|-------|
| Storage | Memory |
| Max file size | **50MB** (fixed — do not change) |
| Allowed types | Images, PDF, XLSX, XLS |

```typescript
import { upload } from '@/middleware/upload.middleware'

router.post('/import', upload.single('file'), controller.import)
```

> **Note**: Unlike `documentUpload`, this middleware silently rejects unsupported files (`cb(null, false)`) rather than returning an error.

## Route Definition Pattern

```typescript
router.get(
  '/',
  canView(MODULE),
  validateSchema(schema),
  (req, res) => controller.method(req, res)
)
```

## Static Routes Priority

Static routes (`/search`, `/trash`, `/bulk/delete`) MUST be declared **before** `/:id`.

## Middleware Application Order (Lengkap)

```
app.use(requestLogger)          // 1. Log all requests
app.use(errorHandler)            // 2. (Registered last, catches all errors)

// Per-route:
authenticate →                  // 3. JWT verification
resolveBranchContext →           // 4. Company & branch injection
requireWriteAccess →             // 5. Write guard (fiscal period checks)
canView/canInsert/... →          // 6. Permission check
validateSchema →                 // 7. Request validation
rateLimiter →                    // 8. (Optional) Rate limiting
asyncHandler →                   // 9. Wrap async controller
controller.method                // 10. Business logic
```

## Related

- [[10-ARCHITECTURE/Auth-Flow]]
- [[10-ARCHITECTURE/Error-Handling]]
- [[80-RUNBOOKS/Debugging-Tips]]
