---
type: module
slug: purchase-invoices
status: active
domain: "[[20-DOMAINS/Purchasing/_Index|Purchasing]]"
backend_path: backend/src/modules/purchase-invoices
api_base: /api/v1/purchase-invoices
permission_module: purchase_invoices
depends_on:
  - "[[30-MODULES/M-goods-receipts]]"
  - "[[30-MODULES/M-purchase-orders]]"
  - "[[30-MODULES/M-suppliers]]"
  - "[[30-MODULES/M-products]]"
  - "[[30-MODULES/M-branches]]"
  - "[[30-MODULES/M-accounting]]"
used_by:
  - "[[30-MODULES/M-ap-payments]]"
  - "[[30-MODULES/M-accounting]]"
related_tables:
  - purchase_invoices
  - purchase_invoice_lines
  - purchase_invoice_charges
  - purchase_invoice_attachments
last_updated: 2026-06-08
---

# M-Purchase Invoices

## Purpose
Handles supplier invoices linked to goods receipts and purchase orders. Supports invoice charges, tax, DPP adjustments, and merged invoices.

## Layer Map
```
Routes → Controller → Service → Repository
```

## Key Business Rules
- PI requires at least one GR before creation
- Charges affect DPP (`20260525_purchase_invoice_charge_affects_dpp`)
- `merged_from_invoice_ids` for split billing scenarios
- Tax account per invoice line (`20260529_add_tax_account_id_to_invoice_lines`)
- Assigned bank account for payment routing

## Known Gotchas / Pitfalls
- `gp_outputs_index_pi_list_post_ready` — check for PI-ready flag on GP outputs
- Fiscal period check on posting
- Payment terms from supplier default, but editable per invoice

## Related
- [[70-FLOWS/PO-to-Payment]]
- [[_Data-Model]]