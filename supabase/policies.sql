-- ==========================================
-- ROW LEVEL SECURITY POLICIES
-- ==========================================

-- Enable RLS on all synced tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_logs ENABLE ROW LEVEL SECURITY;

-- Create policies ensuring users can only manage their own data
CREATE POLICY "Users can manage their own data" ON rooms FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can manage their own data" ON students FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can manage their own data" ON student_documents FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can manage their own data" ON fee_records FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can manage their own data" ON attendance FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can manage their own data" ON movement_logs FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ==========================================
-- STORAGE POLICIES
-- ==========================================

-- Note: The hosteldesk-files bucket must be created first before applying these policies.
-- See SETUP_INSTRUCTIONS.md for details.

-- Allow authenticated users to manage files strictly within their own owner_id folder path
-- e.g. {owner_id}/students/{student_id}/photo.jpg
CREATE POLICY "Users can manage their own files"
ON storage.objects FOR ALL
USING (
    bucket_id = 'hosteldesk-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'hosteldesk-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);
