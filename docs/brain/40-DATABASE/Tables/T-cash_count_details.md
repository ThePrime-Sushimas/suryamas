---
type: table
table: cash_count_details
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
  - "migration_cash_counts.sql"
  - "migration_cash_deposits.sql"
---

# cash_count_details

## Schema (Mermaid)

```mermaid
erDiagram
  cash_count_details {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- migration_cash_counts.sql
- migration_cash_deposits.sql
