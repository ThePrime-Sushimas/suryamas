---
type: table
table: public_holidays
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
  - "migrasi gabungan dialy_preps.sql"
  - "public_holidays.sql"
---

# public_holidays

## Schema (Mermaid)

```mermaid
erDiagram
  public_holidays {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- migrasi gabungan dialy_preps.sql
- public_holidays.sql
