---
type: module
slug: cash-counts
status: active
domain: "[[20-DOMAINS/Treasury/_Index|Treasury]]"
backend_path: backend/src/modules/cash-counts
api_base: /api/v1/cash-counts
permission_module: cash-counts
depends_on:
  # TODO: infer from import statements
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - cash_counts
last_updated: 2026-06-08
---

# M-Cash Counts

## Purpose

<!-- TODO: Describe the business purpose -->

## Layer Map

```
Routes → Controller → Service → Repository
  Schema    handleError      Audit        SQL queries
```

## Key Business Rules

- Multi-tenant: all queries filter by `company_id`
- Soft delete: `deleted_at IS NULL` on all read queries
- Audit trail: `AuditService.log` on CREATE/UPDATE/DELETE/RESTORE
- Bank account: belongs to company, not branch
- Cash count: must be finalized before fiscal period close
- Reconciliation: single source of truth pattern

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
