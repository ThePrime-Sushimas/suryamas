---
type: table
table: ap_payment_batches
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
  - "20260522_ap_payment_batches.sql"
---

# ap_payment_batches

## Schema (Mermaid)

```mermaid
erDiagram
  ap_payment_batches {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260522_ap_payment_batches.sql
