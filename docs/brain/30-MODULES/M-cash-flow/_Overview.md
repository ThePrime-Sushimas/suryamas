---
type: module
slug: cash-flow
status: active
domain: "[[20-DOMAINS/Accounting/_Index|Accounting]]"
backend_path: backend/src/modules/cash-flow
api_base: /api/v1/cash-flow
permission_module: cash-flow
depends_on:
  # TODO: infer from import statements
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - cash_flow
last_updated: 2026-06-08
---

# M-Cash Flow

## Purpose

<!-- TODO: Describe the business purpose -->

## Layer Map

```
Controller → Service → Repository
  Schema    handleError      Audit        SQL queries
```

## Key Business Rules

- Multi-tenant: all queries filter by `company_id`
- Soft delete: `deleted_at IS NULL` on all read queries
- Audit trail: `AuditService.log` on CREATE/UPDATE/DELETE/RESTORE
- Double-entry: debit/credit must balance per journal
- Fiscal period must be open before posting
- COA hierarchy: account parent-child validation

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
