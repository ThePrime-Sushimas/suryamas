---
type: module
slug: employees
status: active
domain: "[[20-DOMAINS/HR/_Index|HR]]"
backend_path: backend/src/modules/employees
api_base: /api/v1/employees
permission_module: employees
depends_on:
  # TODO: infer from import statements
used_by:
  - "[[30-MODULES/M-employee-branches]]"
  - "[[30-MODULES/M-employee-positions]]"
related_tables:
  - employees
  - employee_branches
  - employee_positions
last_updated: 2026-06-08
---

# M-Employees

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
- Employee data: branch-scoped access via `employee_branches`
- Position hierarki: `position_id` references parent

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
