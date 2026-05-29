-- Add contact_person (PIC) column to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150) NULL;

COMMENT ON COLUMN vendors.contact_person IS 'PIC / Contact Person for this vendor';
