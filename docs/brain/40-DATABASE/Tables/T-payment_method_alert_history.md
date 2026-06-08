---
type: table
table: payment_method_alert_history
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
  - "20260506_add_payment_method_alert_history.sql"
---

# payment_method_alert_history

## Schema (Mermaid)

```mermaid
erDiagram
  payment_method_alert_history {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260506_add_payment_method_alert_history.sql
