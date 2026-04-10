// Save partner profile edits from dashboard
import pg from 'pg';
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
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
    const check = await client.query(
      'SELECT id FROM gcc_partner_applications WHERE session_token=$1 AND session_expires_at > NOW()',
      [token]
    );
    if (check.rows.length === 0) { res.status(401).json({ error: 'Session expired' }); return; }
    const id = check.rows[0].id;

    await client.query(
      `UPDATE gcc_partner_applications SET
        company_name = COALESCE($1, company_name),
        description = COALESCE($2, description),
        website = COALESCE($3, website),
        cities = COALESCE($4, cities),
        designation = COALESCE($5, designation)
       WHERE id = $6`,
      [
        body.company_name || null,
        body.description || null,
        body.website || null,
        body.cities || null,
        body.designation || null,
        id
      ]
    );

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('Profile save error:', e.message);
    res.status(500).json({ error: 'Failed to save profile' });
  } finally {
    client.release();
  }
}
