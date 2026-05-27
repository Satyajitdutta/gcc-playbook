// Pithonix GCC Playbook — Partner Portal API (consolidated)
// Replaces partner-auth.js, partner-dashboard.js, partner-update.js
//
// POST { action: 'send', email }               — send OTP
// POST { action: 'verify', email, otp }        — verify OTP → session token
// GET  (X-Partner-Token header)                — load dashboard
// POST { action: 'profile'|'availability'|'checklist', ...fields } + X-Partner-Token

import { Resend } from 'resend';
import crypto from 'crypto';
import pg from 'pg';
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

const CHECKLIST_ITEMS = [
  { key: 'profile_submitted',    label: 'Application submitted',                              auto: true },
  { key: 'application_approved', label: 'Application approved by Pithonix',                  auto: true },
  { key: 'profile_complete',     label: 'Profile fully completed (website, description, cities)', auto: true },
  { key: 'nda_signed',           label: 'Partner Agreement / NDA signed',                    auto: false },
  { key: 'intro_call_done',      label: 'Introduction call with Pithonix team completed',    auto: false },
  { key: 'teams_channel_added',  label: 'Added to Pithonix Microsoft Teams channel',         auto: false },
  { key: 'first_project_brief',  label: 'First project brief received',                      auto: false },
];
const MANUAL_KEYS = CHECKLIST_ITEMS.filter(i => !i.auto).map(i => i.key);

async function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  return JSON.parse(await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); }));
}

async function getPartnerByToken(client, token) {
  const r = await client.query(
    'SELECT id, is_available FROM gcc_partner_applications WHERE session_token=$1 AND session_expires_at > NOW()',
    [token]
  );
  return r.rows[0] || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Partner-Token');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!process.env.DATABASE_URL) { res.status(500).json({ error: 'Database not configured' }); return; }

  const token = req.headers['x-partner-token'];
  const client = await getPool().connect();

  try {

    // ── GET: load dashboard (requires session token) ────────────────────────
    if (req.method === 'GET') {
      if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

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

      const projR = await client.query(
        'SELECT * FROM gcc_partner_projects WHERE partner_id = $1 ORDER BY created_at DESC',
        [partner.id]
      );
      const ckR = await client.query(
        'SELECT item_key, completed, completed_at FROM gcc_partner_checklist WHERE partner_id = $1',
        [partner.id]
      );
      const ckMap = {};
      ckR.rows.forEach(c => { ckMap[c.item_key] = { completed: c.completed, completed_at: c.completed_at }; });

      const autoStates = {
        profile_submitted:    true,
        application_approved: (partner.status || '').toLowerCase().includes('approv'),
        profile_complete:     !!(partner.website && partner.description && partner.cities),
      };
      const checklist = CHECKLIST_ITEMS.map(item => {
        if (item.auto) return { ...item, completed: autoStates[item.key] || false, completed_at: null };
        const saved = ckMap[item.key];
        return { ...item, completed: saved ? saved.completed : false, completed_at: saved ? saved.completed_at : null };
      });

      return res.status(200).json({ partner, projects: projR.rows, checklist });
    }

    // ── POST ────────────────────────────────────────────────────────────────
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    let body;
    try { body = await parseBody(req); }
    catch { res.status(400).json({ error: 'Invalid JSON' }); return; }

    const { action } = body;

    // -- OTP: send --
    if (action === 'send') {
      const email = (body.email || '').trim().toLowerCase();
      if (!email) { res.status(400).json({ error: 'Email required' }); return; }

      const r = await client.query(
        'SELECT id, company_name, contact_name FROM gcc_partner_applications WHERE LOWER(email) = $1',
        [email]
      );
      if (r.rows.length === 0) { res.status(200).json({ sent: true }); return; }
      const partner = r.rows[0];

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000);
      await client.query(
        'UPDATE gcc_partner_applications SET otp_code=$1, otp_expires_at=$2 WHERE id=$3',
        [otp, expires, partner.id]
      );

      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'Pithonix GCC Platform <info@pithonix.ai>',
        to: email,
        subject: `Your Partner Portal Code: ${otp}`,
        html: `
          <div style="font-family:'DM Sans',Arial,sans-serif;background:#0a0f1e;color:#f1f5f9;padding:40px 0">
            <div style="max-width:480px;margin:0 auto;background:#0d1426;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#1e3a5f,#0d1426);padding:32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08)">
                <div style="font-size:13px;letter-spacing:3px;color:#94a3b8;margin-bottom:8px">PITHONIX GCC PLATFORM</div>
                <div style="font-size:22px;font-weight:700">Partner Portal Login</div>
              </div>
              <div style="padding:32px">
                <p style="color:#94a3b8;margin:0 0 8px">Hello ${partner.contact_name || partner.company_name},</p>
                <p style="color:#94a3b8;margin:0 0 28px">Your one-time login code is:</p>
                <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:24px;text-align:center;margin-bottom:28px">
                  <div style="font-size:40px;font-weight:700;color:#3b82f6;letter-spacing:10px">${otp}</div>
                  <div style="font-size:12px;color:#64748b;margin-top:8px">Expires in 10 minutes</div>
                </div>
                <p style="color:#64748b;font-size:13px;margin:0">Do not share this code with anyone.</p>
              </div>
              <div style="background:#060b18;padding:16px;text-align:center;border-top:1px solid rgba(255,255,255,0.05)">
                <div style="font-size:11px;color:#475569">PITHONIX AI INDIA PRIVATE LIMITED | pithonix.ai</div>
              </div>
            </div>
          </div>`
      });
      return res.status(200).json({ sent: true });
    }

    // -- OTP: verify --
    if (action === 'verify') {
      const email = (body.email || '').trim().toLowerCase();
      const otp = (body.otp || '').trim();
      if (!email || !otp) { res.status(400).json({ error: 'Email and OTP required' }); return; }

      const r = await client.query(
        'SELECT id, otp_code, otp_expires_at FROM gcc_partner_applications WHERE LOWER(email) = $1',
        [email]
      );
      if (r.rows.length === 0) { res.status(401).json({ error: 'Invalid code' }); return; }
      const partner = r.rows[0];

      if (!partner.otp_code || partner.otp_code !== otp) { res.status(401).json({ error: 'Invalid code' }); return; }
      if (!partner.otp_expires_at || new Date(partner.otp_expires_at) < new Date()) {
        res.status(401).json({ error: 'Code has expired. Please request a new one.' }); return;
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await client.query(
        'UPDATE gcc_partner_applications SET session_token=$1, session_expires_at=$2, otp_code=NULL, otp_expires_at=NULL WHERE id=$3',
        [sessionToken, tokenExpires, partner.id]
      );
      return res.status(200).json({ token: sessionToken, partnerId: partner.id });
    }

    // -- Profile / availability / checklist (all require session token) --
    if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const partner = await getPartnerByToken(client, token);
    if (!partner) { res.status(401).json({ error: 'Session expired' }); return; }

    if (action === 'profile') {
      await client.query(
        `UPDATE gcc_partner_applications SET
           company_name  = COALESCE($1, company_name),
           description   = COALESCE($2, description),
           website       = COALESCE($3, website),
           cities        = COALESCE($4, cities),
           designation   = COALESCE($5, designation)
         WHERE id = $6`,
        [body.company_name || null, body.description || null, body.website || null,
         body.cities || null, body.designation || null, partner.id]
      );
      return res.status(200).json({ success: true });
    }

    if (action === 'availability') {
      const newVal = typeof body.is_available === 'boolean' ? body.is_available : !partner.is_available;
      await client.query('UPDATE gcc_partner_applications SET is_available=$1 WHERE id=$2', [newVal, partner.id]);
      return res.status(200).json({ success: true, is_available: newVal });
    }

    if (action === 'checklist') {
      const { item_key, completed } = body;
      if (!item_key || !MANUAL_KEYS.includes(item_key)) { res.status(400).json({ error: 'Invalid checklist item' }); return; }
      await client.query(
        `INSERT INTO gcc_partner_checklist (partner_id, item_key, completed, completed_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (partner_id, item_key) DO UPDATE SET completed=$3, completed_at=$4`,
        [partner.id, item_key, !!completed, completed ? new Date() : null]
      );
      return res.status(200).json({ success: true });
    }

    res.status(400).json({ error: 'Invalid action' });

  } catch (e) {
    console.error('partner-portal error:', e.message);
    res.status(500).json({ error: 'Request failed' });
  } finally {
    client.release();
  }
}
