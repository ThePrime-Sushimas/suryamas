---
type: table
table: opname_reopen_requests
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
  - "20260619_opname_reopen_requests.sql"
---

# opname_reopen_requests

## Schema (Mermaid)

```mermaid
erDiagram
  opname_reopen_requests {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260619_opname_reopen_requests.sql
