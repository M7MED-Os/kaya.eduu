-- Add scheduling and expiration columns to announcements table
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Update existing records to have scheduled_for = created_at so they appear immediately
UPDATE announcements SET scheduled_for = created_at WHERE scheduled_for IS NULL;

-- Index for efficient querying of active/scheduled announcements
CREATE INDEX IF NOT EXISTS idx_announcements_schedule ON announcements(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_announcements_expiry ON announcements(expires_at);
