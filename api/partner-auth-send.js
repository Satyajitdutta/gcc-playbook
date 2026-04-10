// Send OTP to partner email for dashboard login
import { Resend } from 'resend';
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
  if (!email) { res.status(400).json({ error: 'Email required' }); return; }

  const client = await getPool().connect();
  try {
    const r = await client.query(
      'SELECT id, company_name, contact_name FROM gcc_partner_applications WHERE LOWER(email) = $1',
      [email]
    );

    // Always return sent:true to avoid email enumeration
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
        <div style="font-family:'DM Sans',Arial,sans-serif;background:#0a0f1e;color:#f1f5f9;padding:40px 0;min-height:100vh">
          <div style="max-width:480px;margin:0 auto;background:#0d1426;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#1e3a5f,#0d1426);padding:32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08)">
              <div style="font-size:13px;letter-spacing:3px;color:#94a3b8;margin-bottom:8px">PITHONIX GCC PLATFORM</div>
              <div style="font-size:22px;font-weight:700;color:#f1f5f9">Partner Portal Login</div>
            </div>
            <div style="padding:32px">
              <p style="color:#94a3b8;margin:0 0 8px">Hello ${partner.contact_name || partner.company_name},</p>
              <p style="color:#94a3b8;margin:0 0 28px">Your one-time login code for the Pithonix Partner Portal is:</p>
              <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:24px;text-align:center;margin-bottom:28px">
                <div style="font-size:40px;font-weight:700;color:#3b82f6;letter-spacing:10px">${otp}</div>
                <div style="font-size:12px;color:#64748b;margin-top:8px">Expires in 10 minutes</div>
              </div>
              <p style="color:#64748b;font-size:13px;margin:0">If you did not request this, please ignore this email. Do not share this code with anyone.</p>
            </div>
            <div style="background:#060b18;padding:16px;text-align:center;border-top:1px solid rgba(255,255,255,0.05)">
              <div style="font-size:11px;color:#475569">PITHONIX AI INDIA PRIVATE LIMITED | pithonix.ai</div>
            </div>
          </div>
        </div>
      `
    });

    res.status(200).json({ sent: true });
  } catch (e) {
    console.error('OTP send error:', e.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  } finally {
    client.release();
  }
}
