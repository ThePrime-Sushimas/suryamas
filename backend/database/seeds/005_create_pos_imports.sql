-- Migration: Create POS Imports tables
-- Description: Tables for importing POS Excel data with duplicate detection
-- Pattern: Following journal_headers + journal_lines structure

-- TODO: Add FK constraints after journals table is created:
--   ALTER TABLE pos_imports ADD CONSTRAINT fk_pos_imports_journal 
--     FOREIGN KEY (journal_id) REFERENCES journals(id);
--   ALTER TABLE pos_import_lines ADD CONSTRAINT fk_pos_import_lines_journal 
--     FOREIGN KEY (journal_id) REFERENCES journals(id);

-- Create ENUM type for POS import status
CREATE TYPE pos_import_status_enum AS ENUM (
  'PENDING',    -- File uploaded, not yet analyzed
  'ANALYZED',   -- Duplicates detected, waiting confirmation
  'IMPORTED',   -- Data imported to pos_import_lines
  'MAPPED',     -- Mapped to journal template
  'POSTED',     -- Journal created and posted
  'FAILED'      -- Import failed
);

-- Create pos_imports table (header)
CREATE TABLE IF NOT EXISTS pos_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  
  -- Import metadata
  import_date DATE NOT NULL DEFAULT CURRENT_DATE,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  
  -- Statistics
  total_rows INTEGER NOT NULL DEFAULT 0,
  new_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  status pos_import_status_enum NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  
  -- Journal reference (after mapping) - FK will be added later
  journal_id UUID,
  
  -- Audit fields (following journal pattern)
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create pos_import_lines table (detail)
CREATE TABLE IF NOT EXISTS pos_import_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pos_import_id UUID NOT NULL REFERENCES pos_imports(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  
  -- POS Excel columns (45 fields from user's Excel)
  sales_number VARCHAR(100),
  bill_number VARCHAR(100),
  sales_type VARCHAR(50),
  batch_order VARCHAR(100),
  table_section VARCHAR(100),
  table_name VARCHAR(100),
  sales_date DATE,
  sales_date_in TIMESTAMP,
  sales_date_out TIMESTAMP,
  branch VARCHAR(100),
  brand VARCHAR(100),
  city VARCHAR(100),
  area VARCHAR(100),
  visit_purpose VARCHAR(100),
  regular_member_code VARCHAR(100),
  regular_member_name VARCHAR(255),
  loyalty_member_code VARCHAR(100),
  loyalty_member_name VARCHAR(255),
  loyalty_member_type VARCHAR(100),
  employee_code VARCHAR(100),
  employee_name VARCHAR(255),
  external_employee_code VARCHAR(100),
  external_employee_name VARCHAR(255),
  customer_name VARCHAR(255),
  payment_method VARCHAR(100),
  menu_category VARCHAR(100),
  menu_category_detail VARCHAR(100),
  menu VARCHAR(255),
  custom_menu_name VARCHAR(255),
  menu_code VARCHAR(100),
  menu_notes TEXT,
  order_mode VARCHAR(50),
  qty DECIMAL(10,2),
  price DECIMAL(15,2),
  subtotal DECIMAL(15,2),
  discount DECIMAL(15,2),
  service_charge DECIMAL(15,2),
  tax DECIMAL(15,2),
  vat DECIMAL(15,2),
  total DECIMAL(15,2),
  nett_sales DECIMAL(15,2),
  dpp DECIMAL(15,2),
  bill_discount DECIMAL(15,2),
  total_after_bill_discount DECIMAL(15,2),
  waiter VARCHAR(255),
  order_time TIMESTAMP,
  
  -- Mapping to journal - FK will be added later
  journal_id UUID,
  mapped_at TIMESTAMP,
  
  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance (following journal pattern)
CREATE INDEX idx_pos_imports_company ON pos_imports(company_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_pos_imports_branch ON pos_imports(branch_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_pos_imports_date_range ON pos_imports(date_range_start, date_range_end) WHERE is_deleted = FALSE;
CREATE INDEX idx_pos_imports_status ON pos_imports(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_pos_imports_journal ON pos_imports(journal_id) WHERE journal_id IS NOT NULL;
CREATE INDEX idx_pos_imports_deleted ON pos_imports(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_pos_import_lines_import ON pos_import_lines(pos_import_id);
CREATE INDEX idx_pos_import_lines_sales_date ON pos_import_lines(sales_date);
CREATE INDEX idx_pos_import_lines_bill ON pos_import_lines(bill_number, sales_number);
CREATE INDEX idx_pos_import_lines_payment ON pos_import_lines(payment_method);

-- Unique constraint for duplicate detection
-- Prevents same transaction from being imported twice
CREATE UNIQUE INDEX unique_pos_transaction ON pos_import_lines(
  bill_number, 
  sales_number, 
  sales_date
) WHERE bill_number IS NOT NULL AND sales_number IS NOT NULL;

-- Comments
COMMENT ON TABLE pos_imports IS 'POS Excel import headers with duplicate tracking (follows journal_headers pattern)';
COMMENT ON TABLE pos_import_lines IS 'POS Excel import detail lines (follows journal_lines pattern)';
COMMENT ON COLUMN pos_imports.date_range_start IS 'Start date of transactions in the import file';
COMMENT ON COLUMN pos_imports.date_range_end IS 'End date of transactions in the import file';
COMMENT ON COLUMN pos_imports.new_rows IS 'Number of new transactions imported';
COMMENT ON COLUMN pos_imports.duplicate_rows IS 'Number of duplicate transactions skipped';
COMMENT ON COLUMN pos_imports.journal_id IS 'Reference to generated journal entry after mapping';
COMMENT ON TYPE pos_import_status_enum IS 'POS import status workflow: PENDING → ANALYZED → IMPORTED → MAPPED → POSTED';
