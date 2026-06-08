---
type: table
table: general_ap_expense_coa_defaults
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
  - "20260527_general_ap_expense_coa_defaults.sql"
---

# general_ap_expense_coa_defaults

## Schema (Mermaid)

```mermaid
erDiagram
  general_ap_expense_coa_defaults {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260527_general_ap_expense_coa_defaults.sql
