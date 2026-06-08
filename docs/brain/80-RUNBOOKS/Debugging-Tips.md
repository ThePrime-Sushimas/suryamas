---
type: runbook
topic: debugging
last_updated: 2026-06-08
---

# Debugging Tips

## 1. Flow Debugging Checklist

When debugging an issue in a business flow, follow this order:

```
1. Identify the flow → find in 70-FLOWS/
2. Check the status chain → where is the document stuck?
3. Audit log → what action happened last?
4. Fiscal period → is it open?
5. Middleware → which one rejected the request?
6. SQL → verify with a direct query against the table
```

## 2. Common Errors

| Error Message | Module | Root Cause | Fix |
|---------------|--------|------------|-----|
| "duplicate key value violates unique constraint" | Any | PG 23505 | Check unique constraint in schema, likely `(company_id, code)` |
| "Fiscal period is closed" | Accounting | `requireWriteAccess` blocks mutation | Reopen fiscal period |
| "Cannot delete: has active children" | Any | `hasChildren()` guard | Delete or reassign children first |
| "Branch is closed" | Branches | Branch closure guard | Reopen branch |
| "Not found" | Any | Record doesn't exist or `deleted_at` filter | Check `findByIdIncludeDeleted` |

## 3. Quick SQL Checks

```sql
-- Check company_id filter
SELECT * FROM purchase_orders WHERE company_id = '...' AND deleted_at IS NULL;

-- Check audit trail
SELECT * FROM audit_log WHERE entity = 'purchase_orders' ORDER BY timestamp DESC LIMIT 10;

-- Check fiscal period status
SELECT * FROM fiscal_periods WHERE company_id = '...' AND NOW() BETWEEN start_date AND end_date;

-- Find orphan records
SELECT * FROM purchase_order_lines l
LEFT JOIN purchase_orders h ON l.purchase_order_id = h.id
WHERE h.id IS NULL;
```

## 4. Module-Specific Known Issues

- **Goods Processing**: Unconfirm resets confirmed inputs — if GP unconfirm fails, check `20260604_gp_unconfirm_reset_confirmed_inputs`
- **AP Payments**: If release fails, check `bank_account_id` on PI header
- **Stock Transfers**: Journal IDs on stock transfers must be non-null (`20260603_add_journal_ids_to_stock_transfers`)
- **Daily Stock Opname**: Position-based classification, check `variance_classification_lines`

## 5. Performance Tips

- Check query plans: `EXPLAIN ANALYZE SELECT ...`
- Ensure indexes exist for `(company_id, deleted_at)` on every table
- No `for...of` + `await query()` loops (N+1 prevention)
- Use `WHERE id = ANY($1::uuid[])` for batch queries

## 6. Environment Connections

```bash
# DB tunnel (must be running)
alias tunnel='ssh -f -N -L 5433:localhost:5432 -L 5050:localhost:5050 root@65.108.60.217'

# Direct PSQL
psql -h localhost -p 5433 -U postgres -d suryamas

# Check PM2 logs
ssh root@65.108.60.217 'pm2 logs suryamas-backend --lines 50'
```

## Related
- [[80-RUNBOOKS/Common-Errors]]
- [[70-FLOWS/PO-to-Payment]]