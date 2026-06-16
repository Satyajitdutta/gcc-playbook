// Pithonix GCC Lead Admin — Weekly partner-facing pipeline report email
// Triggered every Monday at 4:00 AM UTC (9:30 AM IST) via Vercel cron.
// After sending, archives the leads included in the report so the admin's
// active list stays manageable for the next round of scans. Nothing is
// deleted — archived leads remain in the database, just out of the default view.

import { Resend } from 'resend';
import pg from 'pg';

const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

function tierLabel(score) {
  if (score >= 70) return { label: 'Hot', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' };
  if (score >= 40) return { label: 'Watch', bg: '#fffbeb', border: '#fde68a', text: '#b45309' };
  return { label: 'Low Signal', bg: '#f1f5f9', border: '#e2e8f0', text: '#64748b' };
}

function buildReportEmail(leads) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });
  const hot = leads.filter(l => (l.probability_score || 0) >= 70).length;
  const watch = leads.filter(l => (l.probability_score || 0) >= 40 && (l.probability_score || 0) < 70).length;
  const low = leads.length - hot - watch;

  const rows = leads.map((l, i) => {
    const t = tierLabel(l.probability_score || 0);
    return `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9">${l.company_name}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9">${l.industry || '—'}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9">${l.country || '—'}</td>
      <td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #f1f5f9"><span style="background:${t.bg};border:1px solid ${t.border};color:${t.text};border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700">${l.probability_score ?? '—'}% · ${t.label}</span></td>
      <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9">${l.status}</td>
    </tr>`;
  }).join('');

  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;background:#f8fafc;padding:24px">
    <div style="background:#0f172a;padding:22px 28px;border-radius:12px 12px 0 0">
      <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase">Pithonix GCC Lead Admin — Weekly Report</p>
      <h2 style="margin:8px 0 4px;color:#fff;font-size:22px">GCC Probable-Lead Pipeline</h2>
      <p style="margin:0;color:#38bdf8;font-size:13px">${today}</p>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">

      <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;text-align:center">
          <p style="margin:0;font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:1px">Hot (70%+)</p>
          <p style="margin:6px 0 0;font-size:32px;font-weight:700;color:#15803d">${hot}</p>
        </div>
        <div style="flex:1;min-width:120px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;text-align:center">
          <p style="margin:0;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:1px">Watch (40-69%)</p>
          <p style="margin:6px 0 0;font-size:32px;font-weight:700;color:#b45309">${watch}</p>
        </div>
        <div style="flex:1;min-width:120px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;text-align:center">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Low Signal</p>
          <p style="margin:6px 0 0;font-size:32px;font-weight:700;color:#475569">${low}</p>
        </div>
      </div>

      ${leads.length > 0 ? `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <thead><tr style="background:#f1f5f9">
            <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #e2e8f0">Company</th>
            <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #e2e8f0">Industry</th>
            <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #e2e8f0">Country</th>
            <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #e2e8f0">Probability</th>
            <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;text-align:left;border-bottom:2px solid #e2e8f0">Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : `<p style="color:#94a3b8;font-size:14px;text-align:center;padding:2rem 0">No active leads this week.</p>`}

      <p style="color:#94a3b8;font-size:11px;margin-top:24px">These leads have now been archived in the admin tool to make room for next week's scans. The full history remains in the database and is not deleted.</p>
      <div style="margin-top:20px;text-align:center">
        <a href="https://gcc-playbook.pithonix.ai/gcc-admin" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Open GCC Lead Admin</a>
      </div>

      <p style="color:#94a3b8;font-size:11px;margin-top:28px;border-top:1px solid #f1f5f9;padding-top:16px">PITHONIX AI INDIA PRIVATE LIMITED | CIN: U62090TS2026PTC213220 | Hyderabad, Telangana | pithonix.ai<br>Automated weekly report, sent every Monday morning. Leads shown are AI pattern-detected probabilities, not confirmed deals.</p>
    </div>
  </div>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' }); return;
  }
  if (!process.env.ADMIN_DATABASE_URL || !process.env.RESEND_API_KEY) {
    res.status(500).json({ error: 'Missing ADMIN_DATABASE_URL or RESEND_API_KEY' }); return;
  }

  let leads = [];
  const client = await getPool().connect();
  try {
    const r = await client.query(
      `SELECT id, company_name, industry, country, probability_score, status
       FROM gcc_admin_leads WHERE status IN ('Detected','Researched','Simulated')
       ORDER BY probability_score DESC NULLS LAST`
    );
    leads = r.rows;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Pithonix GCC Platform <info@pithonix.ai>',
      to: 'satyajitv.d@pithonix.ai',
      subject: `GCC Lead Pipeline — Weekly Report (${leads.length} lead${leads.length === 1 ? '' : 's'})`,
      html: buildReportEmail(leads)
    });

    if (leads.length > 0) {
      await client.query(
        `UPDATE gcc_admin_leads SET status='Archived', updated_at=NOW() WHERE id = ANY($1::int[])`,
        [leads.map(l => l.id)]
      );
    }
    console.log(`Weekly GCC lead report sent and archived: ${leads.length} leads`);
    res.status(200).json({ success: true, reported: leads.length });
  } catch (e) {
    console.error('Weekly GCC report error:', e.message);
    res.status(500).json({ error: 'Report failed' });
  } finally {
    client.release();
  }
}
