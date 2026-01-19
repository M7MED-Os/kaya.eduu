-- Add image columns to questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS question_image TEXT,
ADD COLUMN IF NOT EXISTS choice_a_image TEXT,
ADD COLUMN IF NOT EXISTS choice_b_image TEXT,
ADD COLUMN IF NOT EXISTS choice_c_image TEXT,
ADD COLUMN IF NOT EXISTS choice_d_image TEXT;

-- Create a storage bucket for exam attachments if it doesn't exist
-- Note: Creating buckets via SQL requires specific extensions/permissions. 
-- It is recommended to create a new public bucket named 'exam_attachments' in your Supabase dashboard.
