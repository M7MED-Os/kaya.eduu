import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://cpaguaefzbhnifeztbin.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYWd1YWVmemJobmlmZXp0YmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDEwODYsImV4cCI6MjA4ODM3NzA4Nn0.hiqLrsHSmgiEMTYvl7HefshPK0z8Q_ARE416442q4zY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
