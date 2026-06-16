-- Run once in the Neon SQL console (same DATABASE_URL as the rest of the site).
CREATE TABLE IF NOT EXISTS gcc_admin_leads (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  industry TEXT,
  country TEXT,
  functions_needed TEXT,
  year1_fte TEXT,
  timeline TEXT,
  top_priority TEXT,
  source_notes TEXT,
  research_summary TEXT,
  designated_zone TEXT,
  blueprint_json JSONB,
  status TEXT DEFAULT 'New',
  created_by TEXT,
  probability_score INT,
  signal_factors JSONB,
  source_urls TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gcc_admin_sessions (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT,
  otp_expires_at TIMESTAMP,
  session_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
