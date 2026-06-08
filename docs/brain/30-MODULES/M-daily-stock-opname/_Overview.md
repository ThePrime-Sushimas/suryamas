---
type: module
slug: daily-stock-opname
status: active
domain: "[[20-DOMAINS/Inventory/_Index|Inventory]]"
backend_path: backend/src/modules/daily-stock-opname
api_base: /api/v1/daily-stock-opname
permission_module: daily-stock-opname
depends_on:
  - "[[30-MODULES/M-stock]]"
  - "[[30-MODULES/M-products]]"
  - "[[30-MODULES/M-warehouses]]"
  - "[[30-MODULES/M-branches]]"
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - daily_stock_opname
last_updated: 2026-06-08
---

# M-Daily Stock Opname

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
