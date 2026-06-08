---
type: table
table: dpo_forecast_configs
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
  - "dpo_forecast_configs.sql"
  - "migrasi gabungan dialy_preps.sql"
---

# dpo_forecast_configs

## Schema (Mermaid)

```mermaid
erDiagram
  dpo_forecast_configs {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- dpo_forecast_configs.sql
- migrasi gabungan dialy_preps.sql
