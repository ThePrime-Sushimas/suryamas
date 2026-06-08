---
type: module
slug: dashboard
status: active
domain: "[[20-DOMAINS/HR/_Index|HR]]"
backend_path: backend/src/modules/dashboard
api_base: /api/v1/dashboard
permission_module: dashboard
depends_on:
  # TODO: infer from import statements
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - dashboard
last_updated: 2026-06-08
---

# M-Dashboard

## Purpose

<!-- TODO: Describe the business purpose -->

## Layer Map

```
Routes → Controller → Service → Repository
    handleError      Audit        SQL queries
```

## Key Business Rules

- Multi-tenant: all queries filter by `company_id`
- Soft delete: `deleted_at IS NULL` on all read queries
- Audit trail: `AuditService.log` on CREATE/UPDATE/DELETE/RESTORE
- Employee data: branch-scoped access via `employee_branches`
- Position hierarki: `position_id` references parent

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
