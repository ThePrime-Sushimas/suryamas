---
type: table
table: variance_classification_lines
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
  - "20260610_variance_classification_lines.sql"
---

# variance_classification_lines

## Schema (Mermaid)

```mermaid
erDiagram
  variance_classification_lines {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260610_variance_classification_lines.sql
