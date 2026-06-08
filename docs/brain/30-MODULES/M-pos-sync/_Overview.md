---
type: module
slug: pos-sync
status: active
domain: "[[20-DOMAINS/Sales-POS/_Index|Sales-POS]]"
backend_path: backend/src/modules/pos-sync
api_base: /api/v1/pos-sync
permission_module: pos-sync
depends_on:
  # TODO: infer from import statements
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - pos_sync
last_updated: 2026-06-08
---

# M-Pos Sync

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
- POS sync: aggregated transactions pattern
- Pricelist: branch-level price override via `menu_branch_prices`

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
