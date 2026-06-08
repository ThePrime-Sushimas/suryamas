---
type: table
table: daily_prep_orders
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
  - "daily_prep_orders.sql"
  - "migrasi gabungan dialy_preps.sql"
---

# daily_prep_orders

## Schema (Mermaid)

```mermaid
erDiagram
  daily_prep_orders {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- daily_prep_orders.sql
- migrasi gabungan dialy_preps.sql
