# TODO - Failed Transactions Feature

## Backend Tasks
- [ ] 1. Add `FAILED` status to AggregatedTransactionStatus type
- [ ] 2. Update repository with batch insert + transaction support
- [ ] 3. Add progress tracking to generateFromImport service
- [ ] 4. Create new API endpoint: `GET /aggregated-transactions/failed`
- [ ] 5. Create new API endpoint: `POST /aggregated-transactions/:id/fix`
- [ ] 6. Create new API endpoint: `POST /aggregated-transactions/batch-fix`
- [ ] 7. Update error types for failed transactions

## Frontend Tasks
- [ ] 8. Create `FailedTransactionsPage.tsx` component
- [ ] 9. Create `FailedTransactionsTable.tsx` component
- [ ] 10. Create `FailedTransactionEditModal.tsx` component
- [ ] 11. Add API functions for failed transactions
- [ ] 12. Add navigation link in sidebar/menu
- [ ] 13. Add route in App.tsx
- [ ] 14. Store integration for failed transactions

## Testing
- [ ] 15. Test batch insert with Supabase
- [ ] 16. Test failed transaction listing
- [ ] 17. Test fix/retry functionality

