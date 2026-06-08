---
type: table
table: ap_payments
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
  - "20260521_ap_payments.sql"
---

# ap_payments

## Schema (Mermaid)

```mermaid
erDiagram
  ap_payments {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260521_ap_payments.sql
