// Pithonix GCC Playbook — Weekly partner digest email
// Triggered every Monday at 4:00 AM UTC (9:30 AM IST) via Vercel cron

import { Resend } from 'resend';
import pg from 'pg';

const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

function buildDigestEmail(partners, pendingCount) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });

  const partnerRows = partners.map((p, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9">${p.company_name}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9">${p.partner_category || '—'}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9">${p.cities || '—'}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9">${p.approved_at ? new Date(p.approved_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</td>
      <td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #f1f5f9">${p.website ? `<a href="${p.website}" style="color:#3b82f6">${p.website.replace(/^https?:\/\//, '')}</a>` : '—'}</td>
    </tr>
  `).join('');

  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;background:#f8fafc;padding:24px">
    <div style="background:#0f172a;padding:22px 28px;border-radius:12px 12px 0 0">
      <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase">Pithonix GCC Platform — Weekly Digest</p>
      <h2 style="margin:8px 0 4px;color:#fff;font-size:22px">Partner Network Summary</h2>
      <p style="margin:0;color:#38bdf8;font-size:13px">${today}</p>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">

      <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">
        <div style="flex:1;min-width:140px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;text-align:center">
          <p style="margin:0;font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:1px">Approved Partners</p>
          <p style="margin:6px 0 0;font-size:32px;font-weight:700;color:#15803d">${partners.length}</p>
        </div>
        <div style="flex:1;min-width:140px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;text-align:center">
          <p style="margin:0;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:1px">Pending Review</p>
          <p style="margin:6px 0 0;font-size:32px;font-weight:700;color:#b45309">${pendingCount}</p>
        </div>
        <div style="flex:1;min-width:140px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;text-align:center">
          <p style="margin:0;font-size:11px;color:#1e40af;text-transform:uppercase;letter-spacing:1px">Total Network</p>
          <p style="margin:6px 0 0;font-size:32px;font-weight:700;color:#1d4ed8">${partners.length + pendingCount}</p>
        </div>
      </div>

      ${partners.length > 0 ? `
      <h3 style="font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">Active Partners</h3>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f1f5f9">
              <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #e2e8f0">Company</th>
              <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #e2e8f0">Category</th>
              <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #e2e8f0">Cities</th>
              <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #e2e8f0">Approved On</th>
              <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #e2e8f0">Website</th>
            </tr>
          </thead>
          <tbody>${partnerRows}</tbody>
        </table>
      </div>
      ` : `<p style="color:#94a3b8;font-size:14px;text-align:center;padding:2rem 0">No approved partners yet.</p>`}

      ${pendingCount > 0 ? `
      <div style="margin-top:20px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px">
        <p style="margin:0;font-size:13px;color:#92400e"><strong>${pendingCount} application${pendingCount > 1 ? 's' : ''} pending review.</strong> Log in to your email to find the approval links, or visit the partner portal.</p>
      </div>` : ''}

      <div style="margin-top:24px;text-align:center">
        <a href="https://gcc-playbook.pithonix.ai" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">View GCC Playbook Site</a>
      </div>

      <p style="color:#94a3b8;font-size:11px;margin-top:28px;border-top:1px solid #f1f5f9;padding-top:16px">PITHONIX AI INDIA PRIVATE LIMITED | CIN: U62090TS2026PTC213220 | Hyderabad, Telangana | pithonix.ai<br>This is an automated weekly digest sent every Monday morning.</p>
    </div>
  </div>`;
}

export default async function handler(req, res) {
  // Allow GET (cron trigger) or POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' }); return;
  }

  if (!process.env.DATABASE_URL || !process.env.RESEND_API_KEY) {
    res.status(500).json({ error: 'Missing DATABASE_URL or RESEND_API_KEY' }); return;
  }

  let partners = [], pendingCount = 0;
  try {
    const client = await getPool().connect();
    try {
      const approved = await client.query(`
        SELECT company_name, partner_category, cities, website, approved_at
        FROM gcc_partner_applications
        WHERE status = 'Approved'
        ORDER BY approved_at ASC
      `);
      partners = approved.rows;

      const pending = await client.query(`
        SELECT COUNT(*) FROM gcc_partner_applications WHERE status NOT IN ('Approved', 'Rejected')
      `);
      pendingCount = parseInt(pending.rows[0].count);
    } finally { client.release(); }
  } catch(e) {
    console.error('DB error:', e.message);
    res.status(500).json({ error: 'Database error' }); return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Pithonix GCC Platform <info@pithonix.ai>',
      to: 'satyajit.d@pithonix.ai',
      subject: `GCC Partner Network — Weekly Digest (${partners.length} active partners)`,
      html: buildDigestEmail(partners, pendingCount)
    });
    console.log(`Weekly digest sent: ${partners.length} partners, ${pendingCount} pending`);
    res.status(200).json({ success: true, partnersSent: partners.length, pendingCount });
  } catch(e) {
    console.error('Email error:', e.message);
    res.status(500).json({ error: 'Email send failed' });
  }
}
