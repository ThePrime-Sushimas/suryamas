---
type: module
slug: supplier-products
status: active
domain: "[[20-DOMAINS/Purchasing/_Index|Purchasing]]"
backend_path: backend/src/modules/supplier-products
api_base: /api/v1/supplier-products
permission_module: supplier-products
depends_on:
  # TODO: infer from import statements
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - supplier_products
last_updated: 2026-06-08
---

# M-Supplier Products

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
