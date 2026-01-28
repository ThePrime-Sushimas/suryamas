# Bank Statement Import Logic Fixes

## Pending Tasks
- [ ] Remove 'amount' field from BankStatementDuplicate interface in types.ts
- [ ] Update duplicate-detector.ts to remove usage of 'amount' and ensure matching on transaction_date + debit_amount + credit_amount
- [ ] Fix checkDuplicates method in bank-statement-import.repository.ts to query on debit_amount and credit_amount
- [ ] Update validateUploadedFile in schema.ts to throw proper error
- [ ] Test the changes for duplicate detection on debit and credit transactions
