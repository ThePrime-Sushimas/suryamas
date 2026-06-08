---
type: table
table: marketplace_checkout_attachments
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
  - "001_marketplace_po.sql"
  - "20260516_marketplace_po.sql"
---

# marketplace_checkout_attachments

## Schema (Mermaid)

```mermaid
erDiagram
  marketplace_checkout_attachments {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 001_marketplace_po.sql
- 20260516_marketplace_po.sql
