---
type: module
slug: purchase-requests
status: active
domain: "[[20-DOMAINS/Purchasing/_Index|Purchasing]]"
backend_path: backend/src/modules/purchase-requests
api_base: /api/v1/purchase-requests
permission_module: purchase-requests
depends_on:
  # TODO: infer from import statements
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - purchase_requests
last_updated: 2026-06-08
---

# M-Purchase Requests

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
