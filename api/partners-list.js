// Pithonix GCC Playbook — Public approved partners list

import pg from 'pg';
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }

  if (!process.env.DATABASE_URL) {
    res.status(200).json({ partners: [] }); return;
  }

  try {
    const client = await getPool().connect();
    try {
      // Only return public-safe fields — no email, phone, GST, CIN, tokens
      const result = await client.query(`
        SELECT id, company_name, partner_category, cities, description, website, approved_at
        FROM gcc_partner_applications
        WHERE status = 'Approved'
        ORDER BY approved_at ASC
      `);
      res.status(200).json({ partners: result.rows });
    } finally { client.release(); }
  } catch(e) {
    console.error('DB error:', e.message);
    res.status(200).json({ partners: [] });
  }
}
