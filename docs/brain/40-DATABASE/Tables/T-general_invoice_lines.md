---
type: table
table: general_invoice_lines
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

# general_invoice_lines

## Schema (Mermaid)

```mermaid
erDiagram
  general_invoice_lines {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 001_create_general_ap_tables.sql
