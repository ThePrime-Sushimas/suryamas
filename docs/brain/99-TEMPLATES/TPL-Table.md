---
type: table
table: 
module: 
columns_count: 
soft_delete: true
multi_tenant: true
audit: true
indexes:
  - 
unique_constraints:
  - 
fk_to:
  - 
fk_from:
  - 
migrations:
  - 
last_updated: {{date:YYYY-MM-DD}}
---

# {{title}}

## Schema (Mermaid)

```mermaid
erDiagram
  TABLE {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Sample Query

```sql

```

## Migration History

-