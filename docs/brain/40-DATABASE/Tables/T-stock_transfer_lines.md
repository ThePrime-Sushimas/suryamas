---
type: table
table: stock_transfer_lines
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
  - "20260531000000_create_stock_transfers.sql"
---

# stock_transfer_lines

## Schema (Mermaid)

```mermaid
erDiagram
  stock_transfer_lines {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260531000000_create_stock_transfers.sql
