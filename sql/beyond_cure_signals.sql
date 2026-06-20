-- Run once in the Neon SQL console (same ADMIN_DATABASE_URL as gcc_admin_leads).
CREATE TABLE IF NOT EXISTS beyond_cure_signals (
  id SERIAL PRIMARY KEY,
  company       TEXT NOT NULL,
  corridor      TEXT NOT NULL,       -- 'warangal' | 'karimnagar' | 'nizamabad'
  signal_cat    TEXT NOT NULL,       -- e.g. 'talent', 'regulatory', 'real_estate', 'infrastructure', 'government_policy', 'earnings', 'vendor_ecosystem', 'digital_footprint', 'informal_network'
  signal_detail TEXT,
  source        TEXT,
  probability   INT  DEFAULT 0,      -- 0-100
  status        TEXT DEFAULT 'active', -- 'active' | 'archived'
  added_date    DATE DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
