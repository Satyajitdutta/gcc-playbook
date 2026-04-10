// Verify OTP and issue session token for partner dashboard
import crypto from 'crypto';
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  let body;
  try {
    if (typeof req.body === 'object' && req.body !== null) body = req.body;
    else body = JSON.parse(await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); }));
  } catch { res.status(400).json({ error: 'Invalid JSON' }); return; }

  const email = (body.email || '').trim().toLowerCase();
  const otp = (body.otp || '').trim();
  if (!email || !otp) { res.status(400).json({ error: 'Email and OTP required' }); return; }

  const client = await getPool().connect();
  try {
    const r = await client.query(
      'SELECT id, otp_code, otp_expires_at FROM gcc_partner_applications WHERE LOWER(email) = $1',
      [email]
    );

    if (r.rows.length === 0) { res.status(401).json({ error: 'Invalid code' }); return; }
    const partner = r.rows[0];

    if (!partner.otp_code || partner.otp_code !== otp) {
      res.status(401).json({ error: 'Invalid code' }); return;
    }
    if (!partner.otp_expires_at || new Date(partner.otp_expires_at) < new Date()) {
      res.status(401).json({ error: 'Code has expired. Please request a new one.' }); return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await client.query(
      'UPDATE gcc_partner_applications SET session_token=$1, session_expires_at=$2, otp_code=NULL, otp_expires_at=NULL WHERE id=$3',
      [token, tokenExpires, partner.id]
    );

    res.status(200).json({ token, partnerId: partner.id });
  } catch (e) {
    console.error('OTP verify error:', e.message);
    res.status(500).json({ error: 'Verification failed' });
  } finally {
    client.release();
  }
}
