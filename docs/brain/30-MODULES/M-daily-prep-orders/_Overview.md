---
type: module
slug: daily-prep-orders
status: active
domain: "[[20-DOMAINS/Production/_Index|Production]]"
backend_path: backend/src/modules/daily-prep-orders
api_base: /api/v1/daily-prep-orders
permission_module: daily-prep-orders
depends_on:
  # TODO: infer from import statements
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - daily_prep_orders
last_updated: 2026-06-08
---

# M-Daily Prep Orders

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
- Standard CRUD operations

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
