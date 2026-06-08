---
type: table
table: branch_opname_config
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

# branch_opname_config

## Schema (Mermaid)

```mermaid
erDiagram
  branch_opname_config {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260530000000_daily_stock_opname.sql
