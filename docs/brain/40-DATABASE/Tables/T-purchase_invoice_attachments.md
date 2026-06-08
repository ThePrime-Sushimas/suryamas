---
type: table
table: purchase_invoice_attachments
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
  - "20260515_add_pi_attachments.sql"
---

# purchase_invoice_attachments

## Schema (Mermaid)

```mermaid
erDiagram
  purchase_invoice_attachments {} ||--o{ CHILD_TABLE : ""
```

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| company_id | UUID | Multi-tenant |
| ... | | |

## Migration History

- 20260515_add_pi_attachments.sql
