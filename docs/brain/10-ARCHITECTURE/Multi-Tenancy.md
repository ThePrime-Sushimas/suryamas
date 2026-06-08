---
type: architecture
topic: multi-tenancy
last_updated: 2026-06-08
---

# Multi-Tenancy

## Core Rule

Every table must have `company_id UUID NOT NULL REFERENCES companies(id)`. Every query must filter `WHERE company_id = $N`.

## Implementation

- `company_id` sourced from `req.context?.company_id` (NOT from query params)
- Injected by `resolveBranchContext` middleware
- All repositories filter `WHERE company_id = $N AND deleted_at IS NULL`

## Branch vs Header Company (Multi-Company Refactor, May 2026)

- Transaction tables carry their **header** company
- Base/lookup tables inherit from parent
- See [[20-DOMAINS/Accounting/_Index]] for detail

## Index Pattern

```sql
CREATE INDEX idx_{table}_company ON {table}(company_id) WHERE deleted_at IS NULL;
```

## Related

- [[10-ARCHITECTURE/Middleware-Chain]]
- [[40-DATABASE/Patterns/Multi-Tenant]]