// Update a checklist item completion for a partner
import pg from 'pg';
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

const MANUAL_KEYS = ['nda_signed', 'intro_call_done', 'teams_channel_added', 'first_project_brief'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Partner-Token');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const token = req.headers['x-partner-token'];
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

  let body;
  try {
    if (typeof req.body === 'object' && req.body !== null) body = req.body;
    else body = JSON.parse(await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); }));
  } catch { res.status(400).json({ error: 'Invalid JSON' }); return; }

  const { item_key, completed } = body;
  if (!item_key || !MANUAL_KEYS.includes(item_key)) {
    res.status(400).json({ error: 'Invalid checklist item' }); return;
  }

  const client = await getPool().connect();
  try {
    const check = await client.query(
      'SELECT id FROM gcc_partner_applications WHERE session_token=$1 AND session_expires_at > NOW()',
      [token]
    );
    if (check.rows.length === 0) { res.status(401).json({ error: 'Session expired' }); return; }
    const id = check.rows[0].id;

    await client.query(
      `INSERT INTO gcc_partner_checklist (partner_id, item_key, completed, completed_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (partner_id, item_key) DO UPDATE
       SET completed=$3, completed_at=$4`,
      [id, item_key, !!completed, completed ? new Date() : null]
    );

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('Checklist update error:', e.message);
    res.status(500).json({ error: 'Failed to update checklist' });
  } finally {
    client.release();
  }
}
