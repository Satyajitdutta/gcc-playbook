// Pithonix GCC Playbook — Partner Application API
// Saves to Neon DB + sends email via Resend with one-click Approve/Reject buttons

import { Resend } from 'resend';
import pg from 'pg';

const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

function generateToken() {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let t = '';
  for (let i = 0; i < 48; i++) t += c[Math.floor(Math.random() * c.length)];
  return t;
}

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS gcc_partner_applications (
      id SERIAL PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      contact_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      backup_email VARCHAR(255),
      phone VARCHAR(50),
      designation VARCHAR(100),
      website VARCHAR(255),
      partner_category VARCHAR(100),
      gst_number VARCHAR(50),
      cin_number VARCHAR(50),
      year_founded INTEGER,
      cities TEXT,
      gcc_projects VARCHAR(50),
      team_size VARCHAR(50),
      description TEXT,
      doc_link TEXT,
      document_names TEXT,
      approval_token VARCHAR(100),
      status VARCHAR(50) DEFAULT 'Pending Review',
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      approved_at TIMESTAMPTZ
    )
  `);
  // Add new columns if upgrading from older schema
  const cols = ['backup_email VARCHAR(255)', 'approval_token VARCHAR(100)', 'approved_at TIMESTAMPTZ'];
  for (const col of cols) {
    const name = col.split(' ')[0];
    await client.query(`ALTER TABLE gcc_partner_applications ADD COLUMN IF NOT EXISTS ${name} ${col.split(' ').slice(1).join(' ')}`).catch(() => {});
  }
}

function row(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:8px 14px;font-weight:600;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top;width:180px">${label}</td><td style="padding:8px 14px;color:#0f172a;font-size:13px">${value}</td></tr>`;
}

function buildNotificationEmail(d, id, token) {
  const base = 'https://gcc-playbook.pithonix.ai';
  const approveUrl = `${base}/api/partner-approve?id=${id}&token=${token}&action=approve`;
  const rejectUrl = `${base}/api/partner-approve?id=${id}&token=${token}&action=reject`;
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:680px;margin:0 auto;background:#f8fafc;padding:24px">
    <div style="background:#0f172a;padding:22px 28px;border-radius:12px 12px 0 0">
      <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase">Pithonix GCC Platform</p>
      <h2 style="margin:8px 0 4px;color:#fff;font-size:22px">New Partner Application</h2>
      <p style="margin:0;color:#38bdf8;font-size:13px">Application #${id} — ${d.partner_category || 'General Partner'}</p>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#64748b;font-size:12px;margin-top:0">Submitted: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>

      <h3 style="color:#0f172a;font-size:13px;font-weight:700;margin:16px 0 8px;padding-bottom:6px;border-bottom:2px solid #f1f5f9;text-transform:uppercase;letter-spacing:1px">Company</h3>
      <table style="width:100%;border-collapse:collapse">
        ${row('Company Name', d.company_name)}
        ${row('GST Number', d.gst_number)}
        ${row('CIN', d.cin_number)}
        ${row('Year Founded', d.year_founded)}
        ${row('Website', d.website)}
        ${row('Partner Category', d.partner_category)}
        ${row('Cities', d.cities)}
        ${row('GCC Projects', d.gcc_projects)}
        ${row('Team Size', d.team_size)}
      </table>

      <h3 style="color:#0f172a;font-size:13px;font-weight:700;margin:16px 0 8px;padding-bottom:6px;border-bottom:2px solid #f1f5f9;text-transform:uppercase;letter-spacing:1px">Contact Person</h3>
      <table style="width:100%;border-collapse:collapse">
        ${row('Full Name', d.contact_name)}
        ${row('Designation', d.designation)}
        ${row('Email', `<a href="mailto:${d.email}">${d.email}</a>`)}
        ${row('Backup Email', d.backup_email ? `<a href="mailto:${d.backup_email}">${d.backup_email}</a>` : '')}
        ${row('Phone', d.phone)}
      </table>

      ${d.description ? `<h3 style="color:#0f172a;font-size:13px;font-weight:700;margin:16px 0 8px;padding-bottom:6px;border-bottom:2px solid #f1f5f9;text-transform:uppercase;letter-spacing:1px">Services</h3><p style="color:#374151;font-size:13px;line-height:1.7;margin:0">${d.description}</p>` : ''}
      ${d.doc_link ? `<p style="margin-top:12px;font-size:13px">Document link: <a href="${d.doc_link}" style="color:#3b82f6">${d.doc_link}</a></p>` : ''}
      ${d.document_names ? `<p style="font-size:12px;color:#94a3b8;margin-top:8px">Files attached: ${d.document_names}</p>` : ''}

      <div style="margin-top:28px;padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;text-align:center">
        <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#0f172a">Review this application and take action:</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a href="${approveUrl}" style="display:inline-block;background:#22c55e;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Approve Partner</a>
          <a href="${rejectUrl}" style="display:inline-block;background:#ef4444;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Reject Application</a>
        </div>
        <p style="margin:12px 0 0;font-size:11px;color:#94a3b8">Clicking Approve will list them on the GCC Playbook site. Clicking Reject will notify the applicant.</p>
      </div>
    </div>
  </div>`;
}

function buildConfirmationEmail(d, id) {
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px">
    <div style="background:#0f172a;padding:22px 28px;border-radius:12px 12px 0 0">
      <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase">Pithonix GCC Platform</p>
      <h2 style="margin:8px 0 0;color:#fff;font-size:22px">Application Received</h2>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#374151;font-size:14px">Hi ${d.contact_name},</p>
      <p style="color:#374151;font-size:14px;line-height:1.6">Thank you for applying to join the Pithonix GCC Partner Network. We have received your application from <strong>${d.company_name}</strong> for the <strong>${d.partner_category || 'General'}</strong> category.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:20px 0;text-align:center">
        <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Application Reference</p>
        <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:#0f172a">#${id}</p>
      </div>
      <p style="color:#374151;font-size:14px;line-height:1.6">Our partnerships team will review your application and respond within <strong>48 hours</strong>. You can check your application status anytime:</p>
      <div style="text-align:center;margin-top:16px">
        <a href="https://gcc-playbook.pithonix.ai/partner-portal" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Check Application Status</a>
      </div>
      <p style="color:#94a3b8;font-size:11px;margin-top:28px;border-top:1px solid #f1f5f9;padding-top:16px">PITHONIX AI INDIA PRIVATE LIMITED | CIN: U62090TS2026PTC213220 | Hyderabad, Telangana | pithonix.ai</p>
    </div>
  </div>`;
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

  const { company_name, contact_name, email, backup_email, phone, designation, website,
    partner_category, gst_number, cin_number, year_founded, cities, gcc_projects,
    team_size, description, doc_link, documents } = body;

  if (!company_name || !email || !contact_name) {
    res.status(400).json({ error: 'Company name, contact name and email are required.' }); return;
  }

  const token = generateToken();
  let applicationId;

  if (process.env.DATABASE_URL) {
    try {
      const client = await getPool().connect();
      try {
        await ensureTable(client);
        const docNames = documents?.length ? documents.map(d => d.name).join(', ') : null;
        const result = await client.query(`
          INSERT INTO gcc_partner_applications
          (company_name, contact_name, email, backup_email, phone, designation, website,
           partner_category, gst_number, cin_number, year_founded, cities, gcc_projects,
           team_size, description, doc_link, document_names, approval_token)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
          RETURNING id
        `, [company_name, contact_name, email, backup_email || null, phone || null,
            designation || null, website || null, partner_category || null,
            gst_number || null, cin_number || null,
            year_founded ? parseInt(year_founded) : null,
            cities || null, gcc_projects || null, team_size || null,
            description || null, doc_link || null, docNames, token]);
        applicationId = result.rows[0].id;
      } finally { client.release(); }
    } catch(e) { console.error('DB error:', e.message); }
  }

  applicationId = applicationId || Math.floor(Math.random() * 90000) + 10000;

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const attachments = [];
      if (documents?.length) {
        for (const doc of documents) {
          if (doc.data && doc.name) attachments.push({ filename: doc.name, content: doc.data });
        }
      }
      const d = { company_name, contact_name, email, backup_email, phone, designation, website, partner_category, gst_number, cin_number, year_founded, cities, gcc_projects, team_size, description, doc_link, document_names: documents?.map(d => d.name).join(', ') };
      await resend.emails.send({
        from: 'Pithonix GCC Platform <info@pithonix.ai>',
        to: 'satyajit.d@pithonix.ai',
        cc: 'info@pithonix.ai',
        subject: `[New Partner Application] ${company_name} — ${partner_category || 'General'}`,
        html: buildNotificationEmail(d, applicationId, token),
        ...(attachments.length ? { attachments } : {})
      });
      await resend.emails.send({
        from: 'Pithonix GCC Platform <info@pithonix.ai>',
        to: email,
        subject: `Partnership Application Received — Ref #${applicationId}`,
        html: buildConfirmationEmail(d, applicationId)
      });
    } catch(e) { console.error('Email error:', e.message); }
  }

  res.status(200).json({ success: true, applicationId });
}
