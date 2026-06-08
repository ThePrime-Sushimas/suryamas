---
type: table
table: auth_users
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
  - "20260427000001_auth_users_table.sql"
---

# auth_users

## Schema (Mermaid)

```mermaid
erDiagram
  auth_users {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260427000001_auth_users_table.sql
