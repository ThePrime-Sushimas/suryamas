-- COA Seed for Restaurant Company
-- Generated automatically
-- Company ID: 3576839e-d83a-4061-8551-fe9b5d971111
-- User ID: 8a130a3e-0490-48b9-abe5-769af0dee345

DELETE FROM chart_of_accounts WHERE company_id = '3576839e-d83a-4061-8551-fe9b5d971111';

-- Level 1: Header accounts
INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '100000', 'Asset', 'ASSET', NULL, 1, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '200000', 'Liability', 'LIABILITY', NULL, 1, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '300000', 'Equity', 'EQUITY', NULL, 1, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '400000', 'Revenue', 'REVENUE', NULL, 1, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '500000', 'Cost Of Sales', 'EXPENSE', NULL, 1, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '600000', 'Expenses', 'EXPENSE', NULL, 1, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '700000', 'Others - non operating', 'EXPENSE', NULL, 1, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

-- Level 2: Header accounts
INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110000', 'Current asset', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '100000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 2, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120000', 'Non current asset', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '100000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 2, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210000', 'Current liability', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '200000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 2, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '220000', 'Non current liability', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '200000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 2, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310000', 'Shareholders equity', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '300000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 2, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410000', 'Revenue From Business', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '400000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 2, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '510000', 'Material Usage', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '500000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 2, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610000', 'Operating Expense', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '600000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 2, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '620000', 'Depreciation Expense', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '600000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 2, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710000', 'Non operating income/(expenses)', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '700000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 2, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

-- Level 3: Header accounts
INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110100', 'Cash', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110200', 'Bank', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110300', 'Restaurant sales receivables', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110400', 'Account receivables', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110500', 'Inventory', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110600', 'Prepaid expenses', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110700', 'Advances', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110800', 'Suspense Account - Debit', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120100', 'Fixed asset', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120200', 'Accumulated depreciation', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120300', 'Investment', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120400', 'Security deposit', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210100', 'Account payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210200', 'Tax payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210300', 'Accrued expense reserve', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210400', 'Restaurant Other Payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210500', 'Other current payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210600', 'Suspense Account - Credit', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '220100', 'Shareholders loan', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '220000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '220200', 'Bank Loan', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '220000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '220300', 'Other non current payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '220000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310100', 'Share capital', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '310000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310200', 'Accumulated earnings', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '310000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310300', 'Dividend', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '310000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310400', 'Beginning Balance', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '310000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310500', 'Other equity', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '310000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410100', 'Revenue From Restaurant', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410200', 'Revenue From Non Restaurant Sales', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410300', 'Discount', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410400', 'Other Business Revenue', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '510100', 'COGS Restaurant', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '510000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '510200', 'COGS Non-Restaurant', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '510000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '510300', 'COGS Adjustments', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '510000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610100', 'Selling Expense', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610200', 'Employee Expenses', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610300', 'Premise Expenses', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610400', 'Transportation Expenses', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610500', 'Services Expenses', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610600', 'Asset Maintenance Expenses', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610700', 'General Expenses', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '620100', 'Asset Depreciation Expense', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '620000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710100', 'Non Operating Income / Expense - net', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710200', 'Corporate Tax', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710000' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 3, true, false, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

-- Level 4: Detail accounts
INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110101', 'Petty cash HO', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110102', 'Petty cash outlet', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110201', 'Bank 1', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110202', 'Bank 2', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110301', 'Cash sales receivable', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110302', 'Credit card sales receivable', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110303', 'Debit card sales receivable', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110304', 'OVO sales receivable', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110305', 'Shopeepay sales receivable', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110306', 'Grab merchant sales receivable', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110307', 'Gopay sales receivable', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110308', 'Goresto sales receivable', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110309', 'Shopeefood sales receivable', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110310', 'Self Order sales receivable', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110401', 'B2B sales receivables', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110400' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110501', 'Raw material', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110502', 'WIP', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110503', 'Kitchenware & supplies', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110598', 'Inventory in transit', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110599', 'Inventory in production', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110601', 'Prepaid rent', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110600' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110602', 'Prepaid other', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110600' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110603', 'Prepaid tax', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110600' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110701', 'Advance to suppliers', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110700' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110801', 'Debit suspense account', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110800' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '110802', 'Release payment account', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '110800' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120101', 'Building', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120102', 'Renovation', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120103', 'Equipment', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120104', 'Vehicle', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120105', 'Asset in transit', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120201', 'Acc. Depr - Building', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120202', 'Acc. Depr - Renovation', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120203', 'Acc. Depr - Equipment', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120204', 'Acc. Depr - Vehicle', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120301', 'Investment in PT AAA', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '120401', 'Rental deposit', 'ASSET', (SELECT id FROM chart_of_accounts WHERE account_code = '120400' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210101', 'Account payable purchase', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210201', 'PPh 21', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210202', 'PPh 23', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210203', 'PPh 25', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210204', 'PPh 26', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210205', 'PPh 4 - 2', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210206', 'Pb1 payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210207', 'PPh 29', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210208', 'PPN', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210209', 'Other tax', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210301', 'Salary payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210302', 'Utilities payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210303', 'Professional fees payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210304', 'Breakage Fund', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210305', 'Service charge fees', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210306', 'Other accrued expenses', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210401', 'Restaurant service charge payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210400' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210402', 'Member Deposit', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210400' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210403', 'Delivery cost payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210400' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210404', 'Voucher payable', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210400' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210501', 'Customer deposit', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210502', 'Franchise', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210503', 'Royalty', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210504', 'Bank loan - short term', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210505', 'Others', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '210601', 'Credit Suspense Account', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '210600' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '220101', 'Loan from Shareholder A', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '220100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '220201', 'Bank loan - long term', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '220200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '220301', 'AP suspense', 'LIABILITY', (SELECT id FROM chart_of_accounts WHERE account_code = '220300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310101', 'Shares A', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '310100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310201', 'RE previous period', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '310200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310202', 'RE current period', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '310200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310301', 'Dividend disbursement', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '310300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310401', 'Opening balance', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '310400' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '310501', 'Additional paid in capital', 'EQUITY', (SELECT id FROM chart_of_accounts WHERE account_code = '310500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410101', 'Sales - Food', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410102', 'Sales - Beverage', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410103', 'Sales - Other', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410104', 'Sales - Order fee', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410201', 'Sales - Material', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410301', 'Bill Discount', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410302', 'Food Discount', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410303', 'Beverage Discount', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410304', 'Material Sales Discount', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410305', 'Other Discount', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '410401', 'Other Revenue/Income', 'REVENUE', (SELECT id FROM chart_of_accounts WHERE account_code = '410400' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'CREDIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '510101', 'COGS - Food', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '510100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '510102', 'COGS - Beverage', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '510100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '510103', 'COGS - Other', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '510100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '510201', 'COGS - Material Sold', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '510200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '510301', 'COGS Variance', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '510300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '510302', 'COGS Minus Resolve Variance', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '510300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610101', 'Advertisement & Promotion Exp', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610102', 'MDR Expenses', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610103', 'Entertainment', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610201', 'Salary', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610202', 'THR', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610203', 'Employee Income Tax', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610204', 'Casual Labour', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610205', 'BPJS', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610206', 'Staff Welfare', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610301', 'Eating House Rental', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610302', 'Utilities', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610303', 'Electricity Cost', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610304', 'Water Cost', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610305', 'Gas Cost', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610306', 'Cleaning & Up Keep Shop', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610307', 'Washe/Spoil', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610300' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610401', 'Freight Charges', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610400' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610402', 'Delivery/Handling', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610400' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610403', 'Travelling & Accommodation', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610400' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610501', 'Professional fees', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610502', 'Consultancy Expense', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610503', 'License Expense', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610504', 'Technology expenses', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610500' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610601', 'Repair & Maintenance', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610600' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610701', 'Insurance', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610700' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610702', 'Office expense', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610700' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610703', 'Postage & Stamps', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610700' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610704', 'Printing & Stationary', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610700' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610705', 'Telecommunication', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610700' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610706', 'Uniform', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610700' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610707', 'Kitchenware & Related Cost', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610700' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '610708', 'Miscellaneous Expense', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '610700' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '620101', 'Depr - Building', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '620100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '620102', 'Depr - Renovation', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '620100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '620103', 'Depr - Equipment', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '620100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '620104', 'Depr - Vehicle', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '620100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710101', 'Asset Sales Gain or Losses/ Asset Revaluation', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710102', 'Foreign Exchange Gain/(Loss)', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710103', 'Interest Income/(expense)', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710104', 'Bank Charges', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710105', 'PB 1 Income', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710106', 'Tax expenses', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710107', 'Investment income', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710108', 'Service charge income', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710109', 'Miscellaneous Income/(Expense)', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710110', 'Rounding/ POS Adjustment', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710100' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, parent_account_id, level, is_header, is_postable, normal_balance, created_by)
VALUES ('3576839e-d83a-4061-8551-fe9b5d971111', '710201', 'Final Tax', 'EXPENSE', (SELECT id FROM chart_of_accounts WHERE account_code = '710200' AND company_id = '3576839e-d83a-4061-8551-fe9b5d971111'), 4, false, true, 'DEBIT', '8a130a3e-0490-48b9-abe5-769af0dee345');

-- Total: 196 accounts
