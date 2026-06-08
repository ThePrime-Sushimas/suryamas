---
type: table
table: pricelist_price_changes
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
  - "20260529_pricelist_price_changes.sql"
---

# pricelist_price_changes

## Schema (Mermaid)

```mermaid
erDiagram
  pricelist_price_changes {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260529_pricelist_price_changes.sql
