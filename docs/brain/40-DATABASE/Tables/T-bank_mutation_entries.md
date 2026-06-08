---
type: table
table: bank_mutation_entries
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
  - "migration_bank_mutation_entries.sql"
---

# bank_mutation_entries

## Schema (Mermaid)

```mermaid
erDiagram
  bank_mutation_entries {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- migration_bank_mutation_entries.sql
