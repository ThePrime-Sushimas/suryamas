---
type: architecture
topic: error-handling
last_updated: 2026-06-08
---

# Error Handling

## Architecture

```
Service → throw CustomError
Controller → catch → handleError(res, error, req, context)
Error Registry → map CustomError → HTTP status code
```

## Custom Errors (from `*.errors.ts`)

Each module defines its own errors:
- `NotFoundError` — 404
- `DuplicateError` — 409 (PG 23505 → DuplicateError)
- `BusinessRuleError` — 422
- `InUseError` — 409 (has children)

**Never** `throw new Error()` — always use custom errors from `*.errors.ts`.

## Error Registry (`src/config/error-registry.ts`)

Register new error classes here for HTTP mapping.

## handleError Pattern

```typescript
await handleError(res, error, req, context)
```

Metadata object: `{ action: 'create', id?, query? }`

## Postgres Error Detection

```typescript
import { isPostgresError } from '@/utils/postgres-error.util.ts'
// isPostgresError(err, '23505') → true for duplicate key
```

## Related

- [[10-ARCHITECTURE/Middleware-Chain]]
- [[80-RUNBOOKS/Common-Errors]]