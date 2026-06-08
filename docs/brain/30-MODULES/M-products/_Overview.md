---
type: module
slug: products
status: active
domain: "[[20-DOMAINS/Inventory/_Index|Inventory]]"
backend_path: backend/src/modules/products
api_base: /api/v1/products
permission_module: products
depends_on:
  - "[[30-MODULES/M-categories]]"
  - "[[30-MODULES/M-metric-units]]"
  - "[[30-MODULES/M-companies]]"
used_by:
  - "[[30-MODULES/M-purchase-orders]]"
  - "[[30-MODULES/M-goods-receipts]]"
  - "[[30-MODULES/M-purchase-invoices]]"
  - "[[30-MODULES/M-stock]]"
  - "[[30-MODULES/M-stock-adjustments]]"
  - "[[30-MODULES/M-production-requests]]"
related_tables:
  - products
  - product_uoms
  - product_stock_configs
last_updated: 2026-06-08
---

# M-Products

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
