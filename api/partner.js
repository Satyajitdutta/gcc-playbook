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
  const cols = [
    'backup_email VARCHAR(255)', 'approval_token VARCHAR(100)', 'approved_at TIMESTAMPTZ',
    'partner_tier VARCHAR(50)', 'additional_categories TEXT', 'badge_fee_range VARCHAR(100)',
    'success_fee VARCHAR(50)', 'is_bundle BOOLEAN DEFAULT FALSE'
  ];
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
  const removeUrl = `${base}/api/partner-approve?id=${id}&token=${token}&action=remove`;
  const editUrl = `${base}/api/partner-edit?id=${id}&token=${token}`;
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
        ${row('Partner Tier', d.partner_tier ? `<strong style="color:${d.partner_tier==='Platinum'?'#B8860B':d.partner_tier==='Gold'?'#2A6080':'#555'}">${d.partner_tier}</strong>` : '')}
        ${row('Annual Badge Fee', d.badge_fee_range || '')}
        ${row('Success Fee', d.success_fee ? d.success_fee + ' of Year 1 contract' : '')}
        ${d.is_bundle && d.additional_categories?.length ? row('Additional Categories', d.additional_categories.map(c => c.split(' — ')[1]||c).join(', ') + ' <span style="color:#c2410c;font-weight:700">[BUNDLE — call to negotiate rate]</span>') : ''}
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
          <a href="${removeUrl}" style="display:inline-block;background:#1e293b;border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Remove if Already Live</a>
        </div>
        <div style="margin-top:12px">
          <a href="${editUrl}" style="display:inline-block;background:#1e293b;border:1px solid rgba(255,255,255,0.15);color:#94a3b8;padding:8px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px">Edit Details Before Deciding</a>
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
      <p style="color:#374151;font-size:14px;line-height:1.6">Thank you for applying to the Pithonix GCC Partner Network. We have received your application from <strong>${d.company_name}</strong>. Here is a summary of your submission.</p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:20px 0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div><p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Application Reference</p>
        <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#0f172a">#${id}</p></div>
        ${d.partner_tier ? `<div style="text-align:right"><p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Tier Applied For</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:${d.partner_tier==='Platinum'?'#B8860B':d.partner_tier==='Gold'?'#2A6080':'#555'}">${d.partner_tier}</p></div>` : ''}
      </div>

      ${d.badge_fee_range ? `
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px 18px;margin-bottom:20px">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:1px">Your Fee Summary</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:5px 0;font-size:13px;color:#374151">Annual Badge Fee (${(d.partner_category||'').split(' — ')[1]||d.partner_category})</td>
              <td style="padding:5px 0;font-size:13px;font-weight:700;color:#0f172a;text-align:right">${d.badge_fee_range}</td></tr>
          ${d.success_fee ? `<tr><td style="padding:5px 0;font-size:13px;color:#374151">Success Fee</td>
              <td style="padding:5px 0;font-size:13px;font-weight:700;color:#0f172a;text-align:right">${d.success_fee} of Year 1 contract value</td></tr>` : ''}
        </table>
        <p style="margin:8px 0 0;font-size:11px;color:#64748b">The final fee within this range is confirmed after vetting and agreed before onboarding.</p>
      </div>` : ''}

      ${d.is_bundle && d.additional_categories?.length ? `
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;margin-bottom:20px">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:1px">Bundle Interest Noted</p>
        <p style="margin:0 0 10px;font-size:13px;color:#374151;line-height:1.6">You have indicated interest in ${(d.additional_categories?.length||0)+1} service categories. Fees above are per-category individual rates. Our partnerships team will reach out to discuss a bundle rate. We typically offer 10 to 20% off the total annual badge fee for multi-category registrations.</p>
        <a href="mailto:partnerships@pithonix.ai?subject=Bundle%20Enquiry%20—%20Ref%20%23${id}" style="display:inline-block;background:#c2410c;color:#fff;font-weight:700;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px">Email Partnerships Team</a>
      </div>` : ''}

      <p style="color:#374151;font-size:14px;line-height:1.6">Our team reviews all applications within <strong>48 hours</strong>. Track your status anytime:</p>
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
    partner_category, partner_tier, additional_categories, badge_fee_range, success_fee, is_bundle,
    gst_number, cin_number, year_founded, cities, gcc_projects,
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
        const extraCatsStr = Array.isArray(additional_categories) ? additional_categories.join(', ') : null;
        const result = await client.query(`
          INSERT INTO gcc_partner_applications
          (company_name, contact_name, email, backup_email, phone, designation, website,
           partner_category, partner_tier, additional_categories, badge_fee_range, success_fee, is_bundle,
           gst_number, cin_number, year_founded, cities, gcc_projects,
           team_size, description, doc_link, document_names, approval_token)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
          RETURNING id
        `, [company_name, contact_name, email, backup_email || null, phone || null,
            designation || null, website || null, partner_category || null,
            partner_tier || null, extraCatsStr, badge_fee_range || null,
            success_fee || null, is_bundle || false,
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
      const extraCats = Array.isArray(additional_categories) ? additional_categories : [];
      const isBundle = is_bundle || extraCats.length > 0;
      const d = {
        company_name, contact_name, email, backup_email, phone, designation, website,
        partner_category, partner_tier, additional_categories: extraCats, badge_fee_range,
        success_fee, is_bundle: isBundle, gst_number, cin_number, year_founded, cities,
        gcc_projects, team_size, description, doc_link,
        document_names: documents?.map(d => d.name).join(', ')
      };

      const tierLabel = partner_tier ? ` — ${partner_tier}` : '';
      const bundleFlag = isBundle ? ' [BUNDLE]' : '';
      await resend.emails.send({
        from: 'Pithonix GCC Platform <info@pithonix.ai>',
        to: 'satyajit.d@pithonix.ai',
        cc: 'info@pithonix.ai',
        subject: `[New Partner Application${bundleFlag}] ${company_name}${tierLabel} — ${partner_category || 'General'}`,
        html: buildNotificationEmail(d, applicationId, token),
        ...(attachments.length ? { attachments } : {})
      });
      await resend.emails.send({
        from: 'Pithonix GCC Platform <info@pithonix.ai>',
        to: email,
        subject: `Application Confirmed — Pithonix GCC ${partner_tier || ''} Partner Programme — Ref #${applicationId}`,
        html: buildConfirmationEmail(d, applicationId)
      });
    } catch(e) { console.error('Email error:', e.message); }
  }

  res.status(200).json({ success: true, applicationId });
}
