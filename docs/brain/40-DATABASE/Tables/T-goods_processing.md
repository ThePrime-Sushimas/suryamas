---
type: table
table: goods_processing
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
  - "20260513_goods_processing.sql"
---

# goods_processing

## Schema (Mermaid)

```mermaid
erDiagram
  goods_processing {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260513_goods_processing.sql
