// Partner update: profile save, availability toggle, checklist update
// POST { action: 'profile', ...fields } — update profile
// POST { action: 'availability', is_available: bool } — toggle availability
// POST { action: 'checklist', item_key, completed } — update checklist item
import pg from 'pg';
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

const MANUAL_KEYS = ['nda_signed', 'intro_call_done', 'teams_channel_added', 'first_project_brief'];

async function getPartnerByToken(client, token) {
  const r = await client.query(
    'SELECT id, is_available FROM gcc_partner_applications WHERE session_token=$1 AND session_expires_at > NOW()',
    [token]
  );
  return r.rows[0] || null;
}

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

  const client = await getPool().connect();
  try {
    const partner = await getPartnerByToken(client, token);
    if (!partner) { res.status(401).json({ error: 'Session expired' }); return; }

    if (body.action === 'profile') {
      await client.query(
        `UPDATE gcc_partner_applications SET
          company_name = COALESCE($1, company_name),
          description = COALESCE($2, description),
          website = COALESCE($3, website),
          cities = COALESCE($4, cities),
          designation = COALESCE($5, designation)
         WHERE id = $6`,
        [body.company_name || null, body.description || null, body.website || null, body.cities || null, body.designation || null, partner.id]
      );
      res.status(200).json({ success: true });

    } else if (body.action === 'availability') {
      const newVal = typeof body.is_available === 'boolean' ? body.is_available : !partner.is_available;
      await client.query('UPDATE gcc_partner_applications SET is_available=$1 WHERE id=$2', [newVal, partner.id]);
      res.status(200).json({ success: true, is_available: newVal });

    } else if (body.action === 'checklist') {
      const { item_key, completed } = body;
      if (!item_key || !MANUAL_KEYS.includes(item_key)) { res.status(400).json({ error: 'Invalid checklist item' }); return; }
      await client.query(
        `INSERT INTO gcc_partner_checklist (partner_id, item_key, completed, completed_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (partner_id, item_key) DO UPDATE SET completed=$3, completed_at=$4`,
        [partner.id, item_key, !!completed, completed ? new Date() : null]
      );
      res.status(200).json({ success: true });

    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (e) {
    console.error('partner-update error:', e.message);
    res.status(500).json({ error: 'Request failed' });
  } finally {
    client.release();
  }
}
