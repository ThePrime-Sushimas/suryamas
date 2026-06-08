---
type: table
table: menu_branch_prices
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
  - "20250620000001_menu_branch_prices.sql"
---

# menu_branch_prices

## Schema (Mermaid)

```mermaid
erDiagram
  menu_branch_prices {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20250620000001_menu_branch_prices.sql
