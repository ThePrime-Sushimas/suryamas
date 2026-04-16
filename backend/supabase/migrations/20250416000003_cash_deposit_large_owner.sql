ALTER TABLE public.cash_deposits
  ADD COLUMN IF NOT EXISTS large_amount numeric(18, 2) null,
  ADD COLUMN IF NOT EXISTS owner_top_up numeric(18, 2) null default 0;

COMMENT ON COLUMN public.cash_deposits.large_amount 
  IS 'Total large_denomination dari semua cash counts — uang fisik kasir yang disetor';
COMMENT ON COLUMN public.cash_deposits.owner_top_up 
  IS 'Total small_denomination — ditransfer owner lalu ditarik tunai untuk genapi setoran. Utang perusahaan ke owner.';
