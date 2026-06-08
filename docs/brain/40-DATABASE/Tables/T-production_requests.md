---
type: table
table: production_requests
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
  - "20260620_create_production_requests.sql"
---

# production_requests

## Schema (Mermaid)

```mermaid
erDiagram
  production_requests {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260620_create_production_requests.sql
