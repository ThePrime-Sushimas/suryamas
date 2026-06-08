---
type: module
slug: production-requests
status: active
domain: "[[20-DOMAINS/Production/_Index|Production]]"
backend_path: backend/src/modules/production-requests
api_base: /api/v1/production-requests
permission_module: production-requests
depends_on:
  - "[[30-MODULES/M-products]]"
  - "[[30-MODULES/M-branches]]"
  - "[[30-MODULES/M-product-output-template]]"
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - production_requests
last_updated: 2026-06-08
---

# M-Production Requests

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
- WIP tracking: status per production request line
- Material BOM: sourced from product-output-template
- COGS calculation on output confirmation

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
