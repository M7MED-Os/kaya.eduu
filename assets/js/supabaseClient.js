import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://glvanbhpmbrxdfhqqrvu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsdmFuYmhwbWJyeGRmaHFxcnZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNjEyMTYsImV4cCI6MjA4MzczNzIxNn0.zHlIKgGz9CGWWPmd4RNCVG6NVquRDOuQYLKFrvypZ30'

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
)