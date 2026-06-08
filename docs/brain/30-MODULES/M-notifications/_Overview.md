---
type: module
slug: notifications
status: active
domain: "[[20-DOMAINS/Auth/_Index|Auth]]"
backend_path: backend/src/modules/notifications
api_base: /api/v1/notifications
permission_module: notifications
depends_on:
  # TODO: infer from import statements
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - notifications
last_updated: 2026-06-08
---

# M-Notifications

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
- JWT authentication: `authenticate` middleware
- Permission check: `canView/canInsert/canUpdate/canDelete`

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
