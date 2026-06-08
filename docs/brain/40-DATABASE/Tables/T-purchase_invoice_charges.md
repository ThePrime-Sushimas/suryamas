---
type: table
table: purchase_invoice_charges
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
  - "20260524_purchase_invoice_charges.sql"
---

# purchase_invoice_charges

## Schema (Mermaid)

```mermaid
erDiagram
  purchase_invoice_charges {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260524_purchase_invoice_charges.sql
