---
type: table
table: stock_adjustments
module: ""
columns_count: 0
soft_delete: true
multi_tenant: true
audit: true
indexes: []
unique_constraints: []
fk_to: []
fk_from: []
migrations:
  - "20260531000001_create_stock_adjustments.sql"
---

# stock_adjustments

## Schema (Mermaid)

```mermaid
erDiagram
  stock_adjustments {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260531000001_create_stock_adjustments.sql
