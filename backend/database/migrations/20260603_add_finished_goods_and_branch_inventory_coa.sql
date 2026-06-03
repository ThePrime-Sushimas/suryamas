-- Add new COA accounts for production flow
-- 110504 - Barang Jadi (Finished Goods) - output produksi central
-- 110505 - Persediaan Cabang - barang yang sudah di cabang

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, coa_category, parent_code, is_header, currency, is_active, created_by)
SELECT 
  id AS company_id,
  '110504',
  'Barang Jadi (Finished Goods)',
  'ASET',
  'POSTING',
  '110500',
  false,
  'IDR',
  true,
  (SELECT id FROM auth_users LIMIT 1)
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM chart_of_accounts WHERE account_code = '110504' AND company_id = companies.id
);

INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, coa_category, parent_code, is_header, currency, is_active, created_by)
SELECT 
  id AS company_id,
  '110505',
  'Persediaan Cabang',
  'ASET',
  'POSTING',
  '110500',
  false,
  'IDR',
  true,
  (SELECT id FROM auth_users LIMIT 1)
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM chart_of_accounts WHERE account_code = '110505' AND company_id = companies.id
);
