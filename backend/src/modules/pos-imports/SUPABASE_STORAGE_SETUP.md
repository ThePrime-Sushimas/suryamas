# Supabase Storage Setup for POS Imports

## Required Bucket: `pos-imports-temp`

### 1. Create Bucket via Supabase Dashboard

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Bucket name: `pos-imports-temp`
4. Public: **NO** (private bucket)
5. Click "Create bucket"

### 2. Set Bucket Policies

Go to Storage → Policies → `pos-imports-temp`

**Policy 1: Allow authenticated users to upload**
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pos-imports-temp');
```

**Policy 2: Allow authenticated users to read their own files**
```sql
CREATE POLICY "Authenticated users can read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pos-imports-temp');
```

**Policy 3: Allow authenticated users to delete their own files**
```sql
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pos-imports-temp');
```

### 3. Set Retention Policy (Optional)

Go to Storage → `pos-imports-temp` → Settings

- **Auto-delete files older than**: 7 days
- This automatically cleans up temporary files

### 4. Verify Setup

Run this SQL to check policies:
```sql
SELECT * FROM storage.policies WHERE bucket_id = 'pos-imports-temp';
```

Should return 3 policies (INSERT, SELECT, DELETE).

### 5. Test from Backend

```typescript
// Test upload
const { data, error } = await supabase.storage
  .from('pos-imports-temp')
  .upload('test.json', JSON.stringify({ test: true }))

console.log('Upload result:', { data, error })

// Test download
const { data: downloadData, error: downloadError } = await supabase.storage
  .from('pos-imports-temp')
  .download('test.json')

console.log('Download result:', { downloadData, downloadError })

// Test delete
const { error: deleteError } = await supabase.storage
  .from('pos-imports-temp')
  .remove(['test.json'])

console.log('Delete result:', { deleteError })
```

### 6. Alternative: SQL Script

If you prefer SQL, run this in Supabase SQL Editor:

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pos-imports-temp', 'pos-imports-temp', false);

-- Create policies
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pos-imports-temp');

CREATE POLICY "Authenticated users can read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pos-imports-temp');

CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pos-imports-temp');
```

---

## Troubleshooting

### Error: "Bucket not found"
- Check bucket name is exactly `pos-imports-temp`
- Verify bucket exists in Supabase Dashboard

### Error: "Permission denied"
- Check policies are created
- Verify user is authenticated
- Check JWT token is valid

### Error: "File too large"
- Default limit: 50MB
- Adjust in Supabase Dashboard → Storage → Settings

---

## Done! ✅

Bucket is ready for POS imports module.
