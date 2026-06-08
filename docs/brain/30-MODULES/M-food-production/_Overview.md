---
type: module
slug: food-production
status: active
domain: "[[20-DOMAINS/Production/_Index|Production]]"
backend_path: backend/src/modules/food-production
api_base: /api/v1/food-production
permission_module: food-production
depends_on:
  # TODO: infer from import statements
used_by:
  # TODO: infer from reverse dependency scan
related_tables:
  - food_production
last_updated: 2026-06-08
---

# M-Food Production

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
