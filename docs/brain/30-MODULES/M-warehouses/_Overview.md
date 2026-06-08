---
type: module
slug: warehouses
status: active
domain: "[[20-DOMAINS/Inventory/_Index|Inventory]]"
backend_path: backend/src/modules/warehouses
api_base: /api/v1/warehouses
permission_module: warehouses
depends_on:
  # TODO: infer from import statements
used_by:
  - "[[30-MODULES/M-stock]]"
  - "[[30-MODULES/M-stock-adjustments]]"
  - "[[30-MODULES/M-stock-transfers]]"
  - "[[30-MODULES/M-goods-receipts]]"
related_tables:
  - warehouses
last_updated: 2026-06-08
---

# M-Warehouses

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
