---
type: table
table: stock_balances
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
  - "20260615_inventory_warehouses_stock.sql"
---

# stock_balances

## Schema (Mermaid)

```mermaid
erDiagram
  stock_balances {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260615_inventory_warehouses_stock.sql
