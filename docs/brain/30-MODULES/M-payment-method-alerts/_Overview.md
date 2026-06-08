---
type: module
slug: payment-method-alerts
status: active
domain: "[[20-DOMAINS/Sales-POS/_Index|Sales-POS]]"
backend_path: backend/src/modules/payment-method-alerts
api_base: /api/v1/payment-method-alerts
permission_module: payment-method-alerts
depends_on:
  # TODO: infer from import statements
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - payment_method_alerts
last_updated: 2026-06-08
---

# M-Payment Method Alerts

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
