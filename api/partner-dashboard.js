// Return full partner dashboard data (requires session token)
import pg from 'pg';
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

const CHECKLIST_ITEMS = [
  { key: 'profile_submitted', label: 'Application submitted', auto: true },
  { key: 'application_approved', label: 'Application approved by Pithonix', auto: true },
  { key: 'profile_complete', label: 'Profile fully completed (website, description, cities)', auto: true },
  { key: 'nda_signed', label: 'Partner Agreement / NDA signed', auto: false },
  { key: 'intro_call_done', label: 'Introduction call with Pithonix team completed', auto: false },
  { key: 'teams_channel_added', label: 'Added to Pithonix Microsoft Teams channel', auto: false },
  { key: 'first_project_brief', label: 'First project brief received', auto: false },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Partner-Token');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }

  const token = req.headers['x-partner-token'];
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const client = await getPool().connect();
  try {
    const r = await client.query(
      `SELECT id, company_name, contact_name, email, designation, phone,
              website, partner_category, cities, description, status,
              is_available, submitted_at, approved_at, doc_link, document_names, year_founded, team_size, gcc_projects
       FROM gcc_partner_applications
       WHERE session_token = $1 AND session_expires_at > NOW()`,
      [token]
    );

    if (r.rows.length === 0) { res.status(401).json({ error: 'Session expired. Please log in again.' }); return; }
    const partner = r.rows[0];

    // Fetch projects
    const projR = await client.query(
      'SELECT * FROM gcc_partner_projects WHERE partner_id = $1 ORDER BY created_at DESC',
      [partner.id]
    );

    // Fetch checklist completions
    const ckR = await client.query(
      'SELECT item_key, completed, completed_at FROM gcc_partner_checklist WHERE partner_id = $1',
      [partner.id]
    );
    const ckMap = {};
    ckR.rows.forEach(c => { ckMap[c.item_key] = { completed: c.completed, completed_at: c.completed_at }; });

    // Auto-compute some checklist items
    const autoStates = {
      profile_submitted: true,
      application_approved: (partner.status || '').toLowerCase().includes('approv'),
      profile_complete: !!(partner.website && partner.description && partner.cities),
    };

    const checklist = CHECKLIST_ITEMS.map(item => {
      if (item.auto) {
        return { ...item, completed: autoStates[item.key] || false, completed_at: null };
      }
      const saved = ckMap[item.key];
      return { ...item, completed: saved ? saved.completed : false, completed_at: saved ? saved.completed_at : null };
    });

    res.status(200).json({
      partner,
      projects: projR.rows,
      checklist
    });
  } catch (e) {
    console.error('Dashboard error:', e.message);
    res.status(500).json({ error: 'Failed to load dashboard' });
  } finally {
    client.release();
  }
}
