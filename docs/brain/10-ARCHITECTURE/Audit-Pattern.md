---
type: architecture
topic: audit
last_updated: 2026-06-08
---

# Audit Pattern

## Audit Columns

Every table must have:

```sql
created_by UUID REFERENCES auth_users(id),
updated_by UUID REFERENCES auth_users(id),
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
```

## Source of Truth

- `created_by` / `updated_by`: **`req.user.id`** (from `auth_users` table)
- Helper: `getAuthUserId(req)` in service layer
- **NOT** `req.context.employee_id` — that is for branch/HR context (`employees` table) only

## Audit Log (AuditService.log)

Logged on all mutations: CREATE, UPDATE, DELETE, RESTORE

```typescript
AuditService.log({
  user_id: req.user.id,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
  entity: 'purchase_orders',
  entity_id: record.id,
  before: previousRecord,  // null on CREATE
  after: newRecord,        // null on DELETE
  timestamp: new Date()
})
```

## DTO Convention

All DTOs include `created_by` / `updated_by` fields in their TypeScript interfaces.

## Related

- [[10-ARCHITECTURE/Soft-Delete-Pattern]]
- [[10-ARCHITECTURE/Error-Handling]]