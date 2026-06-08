---
type: architecture
topic: soft-delete
last_updated: 2026-06-08
---

# Soft Delete Pattern

## Schema Columns

```sql
is_deleted BOOLEAN NOT NULL DEFAULT false,
deleted_at TIMESTAMPTZ,
```

## Repository Methods

| Method | `deleted_at` | `company_id` |
|--------|--------------|-------------|
| `findAll`, `findById`, `search`, `update`, `softDelete` | `IS NULL` | ✅ |
| `create` | N/A | ✅ |
| `restore` | `IS NOT NULL` | ✅ |
| `findByIdIncludeDeleted` | No filter | ✅ |

## Business Rules

- `softDelete` sets both `deleted_at = now()` AND `is_deleted = true`
- `restore` resets both to `NULL` / `false`
- Before `softDelete`: `hasChildren()` must be called (throws `BusinessRuleError` if active children exist)
- Check deepest child tables first

## Related

- [[10-ARCHITECTURE/Audit-Pattern]]
- [[40-DATABASE/Patterns/Soft-Delete]]