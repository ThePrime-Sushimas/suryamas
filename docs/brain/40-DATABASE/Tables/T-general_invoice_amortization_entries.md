---
type: table
table: general_invoice_amortization_entries
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
  - "20260528000001_transaction_type_and_amortization.sql"
---

# general_invoice_amortization_entries

## Schema (Mermaid)

```mermaid
erDiagram
  general_invoice_amortization_entries {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260528000001_transaction_type_and_amortization.sql
