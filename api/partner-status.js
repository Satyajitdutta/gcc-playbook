// Pithonix GCC Playbook — Partner Application Status Check

import pg from 'pg';

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1
    });
  }
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
    if (typeof req.body === 'object') body = req.body;
    else body = JSON.parse(await new Promise((resolve) => {
      let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d));
    }));
  } catch(e) { res.status(400).json({ error: 'Invalid JSON' }); return; }

  const { email, application_id } = body;
  if (!email) { res.status(400).json({ error: 'Email required' }); return; }

  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: 'Database not configured' }); return;
  }

  try {
    const client = await getPool().connect();
    try {
      let query, params;
      if (application_id) {
        query = 'SELECT id, company_name, partner_category, status, submitted_at FROM gcc_partner_applications WHERE email = $1 AND id = $2';
        params = [email.toLowerCase(), parseInt(application_id)];
      } else {
        query = 'SELECT id, company_name, partner_category, status, submitted_at FROM gcc_partner_applications WHERE LOWER(email) = $1 ORDER BY submitted_at DESC LIMIT 5';
        params = [email.toLowerCase()];
      }
      const result = await client.query(query, params);
      if (result.rows.length === 0) {
        res.status(404).json({ found: false, message: 'No application found for this email.' });
      } else {
        res.status(200).json({ found: true, applications: result.rows });
      }
    } finally {
      client.release();
    }
  } catch(e) {
    console.error('DB error:', e.message);
    res.status(500).json({ error: 'Could not retrieve status. Please try again.' });
  }
}
