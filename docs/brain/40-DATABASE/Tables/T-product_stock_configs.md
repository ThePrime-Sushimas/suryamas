---
type: table
table: product_stock_configs
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
  - "20260524000001_product_stock_configs.sql"
---

# product_stock_configs

## Schema (Mermaid)

```mermaid
erDiagram
  product_stock_configs {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260524000001_product_stock_configs.sql
