---
type: table
table: notification_rules
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
  - "20260617_notification_rules.sql"
---

# notification_rules

## Schema (Mermaid)

```mermaid
erDiagram
  notification_rules {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260617_notification_rules.sql
