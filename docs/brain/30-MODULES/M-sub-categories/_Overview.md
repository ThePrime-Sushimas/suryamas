---
type: module
slug: sub-categories
status: active
domain: "[[20-DOMAINS/Inventory/_Index|Inventory]]"
backend_path: backend/src/modules/sub-categories
api_base: /api/v1/sub-categories
permission_module: sub-categories
depends_on:
  # TODO: infer from import statements
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - sub_categories
last_updated: 2026-06-08
---

# M-Sub Categories

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
- Stock balance updates trigger on confirm/finalize
- Quantity precision: DECIMAL with 2 decimal places
- Warehouse access: filtered by user branch context
- Cost calculation: `average_cost × conversion_factor`

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
