// Toggle partner availability for new GCC projects
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
      'SELECT id, is_available FROM gcc_partner_applications WHERE session_token=$1 AND session_expires_at > NOW()',
      [token]
    );
    if (check.rows.length === 0) { res.status(401).json({ error: 'Session expired' }); return; }
    const { id } = check.rows[0];
    const newVal = typeof body.is_available === 'boolean' ? body.is_available : !check.rows[0].is_available;

    await client.query('UPDATE gcc_partner_applications SET is_available=$1 WHERE id=$2', [newVal, id]);
    res.status(200).json({ success: true, is_available: newVal });
  } catch (e) {
    console.error('Toggle available error:', e.message);
    res.status(500).json({ error: 'Failed to update availability' });
  } finally {
    client.release();
  }
}
