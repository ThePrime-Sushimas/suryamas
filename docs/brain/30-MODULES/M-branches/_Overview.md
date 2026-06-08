---
type: module
slug: branches
status: active
domain: "[[20-DOMAINS/Sales-POS/_Index|Sales-POS]]"
backend_path: backend/src/modules/branches
api_base: /api/v1/branches
permission_module: branches
depends_on:
  # TODO: infer from import statements
used_by:
  - "[[30-MODULES/M-purchase-orders]]"
  - "[[30-MODULES/M-goods-receipts]]"
  - "[[30-MODULES/M-purchase-invoices]]"
  - "[[30-MODULES/M-stock]]"
related_tables:
  - branches
  - branch_opname_config
last_updated: 2026-06-08
---

# M-Branches

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
- POS sync: aggregated transactions pattern
- Pricelist: branch-level price override via `menu_branch_prices`

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
