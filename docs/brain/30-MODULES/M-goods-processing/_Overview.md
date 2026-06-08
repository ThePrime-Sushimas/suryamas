---
type: module
slug: goods-processing
status: active
domain: "[[20-DOMAINS/Purchasing/_Index|Purchasing]]"
backend_path: backend/src/modules/goods-processing
api_base: /api/v1/goods-processing
permission_module: goods-processing
depends_on:
  - "[[30-MODULES/M-production-requests]]"
  - "[[30-MODULES/M-products]]"
  - "[[30-MODULES/M-stock]]"
  - "[[30-MODULES/M-product-output-template]]"
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - goods_processing
last_updated: 2026-06-08
---

# M-Goods Processing

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
- Fiscal period check via `requireWriteAccess` before confirm/post
- Duplicate check: `UNIQUE(company_id, code)` constraint
- Status state machine: draft → confirmed → closed
- Children guard: `hasChildren()` before soft delete

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
