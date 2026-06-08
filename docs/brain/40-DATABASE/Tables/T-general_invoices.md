---
type: table
table: general_invoices
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
  - "001_create_general_ap_tables.sql"
---

# general_invoices

## Schema (Mermaid)

```mermaid
erDiagram
  general_invoices {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 001_create_general_ap_tables.sql
