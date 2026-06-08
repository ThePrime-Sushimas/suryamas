---
type: table
table: daily_closing_counts
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
  - "20260530000000_daily_stock_opname.sql"
---

# daily_closing_counts

## Schema (Mermaid)

```mermaid
erDiagram
  daily_closing_counts {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260530000000_daily_stock_opname.sql
