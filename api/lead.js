// Pithonix GCC Playbook — Lead & Partner Notification
// Flow: Form submit → send email via Resend
// To: satyajit.d@pithonix.ai  |  CC: info@pithonix.ai
// Tags: [Partnership Request] or [GCC Lead Request]

import { Resend } from 'resend';
import https from 'https';

async function postJSON(urlStr, payload) {
  const url = new URL(urlStr);
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 50000
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function sendEmail(subject, html) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: 'Pithonix GCC Platform <info@pithonix.ai>',
    to: 'satyajit.d@pithonix.ai',
    cc: 'info@pithonix.ai',
    subject,
    html
  });
}

function row(label, value) {
  if (!value) return '';
  return `<tr>
    <td style="padding:8px 12px;font-weight:600;color:#555;white-space:nowrap;vertical-align:top">${label}</td>
    <td style="padding:8px 12px;color:#111">${value}</td>
  </tr>`;
}

function buildPartnerEmail(data) {
  const { name, email, company, functions: category, country: website, fte: phone, priority: description } = data;
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;background:#f9f9f9;padding:24px">
    <div style="background:#0f172a;padding:20px 24px;border-radius:10px 10px 0 0">
      <p style="margin:0;color:#94a3b8;font-size:12px;letter-spacing:1px;text-transform:uppercase">Pithonix GCC Platform</p>
      <h2 style="margin:6px 0 0;color:#ffffff;font-size:20px">New Partnership Application</h2>
    </div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none">
      <table style="width:100%;border-collapse:collapse">
        ${row('Name', name)}
        ${row('Email', `<a href="mailto:${email}" style="color:#3b82f6">${email}</a>`)}
        ${row('Company', company)}
        ${row('Partner Category', category)}
        ${row('Website', website)}
        ${row('Phone', phone)}
        ${row('Description', description)}
        ${row('Submitted', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST')}
      </table>
      <div style="margin-top:20px;padding:14px 16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px">
        <p style="margin:0;font-size:13px;color:#166534">Review this application and respond within 48 hours as committed on the platform.</p>
      </div>
    </div>
  </div>`;
}

function buildLeadEmail(data) {
  const { name, email, company, industry, country, functions, fte, timeline, priority } = data;
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;background:#f9f9f9;padding:24px">
    <div style="background:#0f172a;padding:20px 24px;border-radius:10px 10px 0 0">
      <p style="margin:0;color:#94a3b8;font-size:12px;letter-spacing:1px;text-transform:uppercase">Pithonix GCC Platform</p>
      <h2 style="margin:6px 0 0;color:#ffffff;font-size:20px">New GCC Lead</h2>
    </div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none">
      <table style="width:100%;border-collapse:collapse">
        ${row('Name', name)}
        ${row('Email', `<a href="mailto:${email}" style="color:#3b82f6">${email}</a>`)}
        ${row('Company', company)}
        ${row('Industry', industry)}
        ${row('Country', country)}
        ${row('Functions Needed', functions)}
        ${row('Year 1 FTE', fte)}
        ${row('Timeline', timeline)}
        ${row('Top Priority', priority)}
        ${row('Submitted', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST')}
      </table>
      <div style="margin-top:20px;padding:14px 16px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px">
        <p style="margin:0;font-size:13px;color:#1e40af">Outreach emails are being generated and will follow in a second email shortly.</p>
      </div>
    </div>
  </div>`;
}

function buildOutreachEmail(data, outreach) {
  const { name, company } = data;
  function emailBlock(num, subject, body) {
    if (!subject) return '';
    return `
    <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#f1f5f9;padding:10px 16px">
        <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Email ${num}</span>
        <p style="margin:4px 0 0;font-weight:600;color:#0f172a;font-size:14px">${subject}</p>
      </div>
      <div style="padding:14px 16px;font-size:13px;color:#374151;white-space:pre-wrap;line-height:1.6">${body}</div>
    </div>`;
  }
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;background:#f9f9f9;padding:24px">
    <div style="background:#1e293b;padding:20px 24px;border-radius:10px 10px 0 0">
      <p style="margin:0;color:#94a3b8;font-size:12px;letter-spacing:1px;text-transform:uppercase">Pithonix Outreach Engine</p>
      <h2 style="margin:6px 0 0;color:#ffffff;font-size:20px">3 Ready-to-Send Emails — ${name}, ${company}</h2>
    </div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none">
      ${outreach.company_summary ? `<p style="font-size:13px;color:#555;margin-bottom:20px">${outreach.company_summary}</p>` : ''}
      ${emailBlock(1, outreach.email1_subject, outreach.email1_body)}
      ${emailBlock(2, outreach.email2_subject, outreach.email2_body)}
      ${emailBlock(3, outreach.email3_subject, outreach.email3_body)}
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

  const { name, email, company, industry, country, functions, fte, timeline, priority, source } = body;

  const isPartner = (source || '').toLowerCase().includes('partner');
  const tag = isPartner ? 'Partnership Request' : 'GCC Lead Request';
  const subjectSuffix = isPartner
    ? `${company || 'Unknown'} — ${functions || 'Partner'}`
    : `${company || 'Unknown'} — ${industry || 'GCC Enquiry'}`;
  const subject = `[${tag}] ${subjectSuffix}`;

  console.log('SUBMISSION', JSON.stringify({
    timestamp: new Date().toISOString(), tag, source, name, email, company
  }));

  // Send notification email before responding so it always fires
  if (process.env.RESEND_API_KEY) {
    try {
      const html = isPartner ? buildPartnerEmail(body) : buildLeadEmail(body);
      await sendEmail(subject, html);
    } catch(e) {
      console.error('Email send error:', e.message);
    }
  }

  // Respond to client
  res.status(200).json({ success: true });

  // For GCC leads only: call outreach engine and send enriched follow-up email
  if (!isPartner) {
    try {
      const outreachResult = await postJSON('https://pithonix-outreach-engine.vercel.app/api/research', {
        lead: {
          name: name || '',
          company: company || '',
          role: priority || 'Decision Maker',
          industry: industry || '',
          strategicContext: `GCC Setup enquiry from ${country || 'international'}. Functions needed: ${functions || ''}. Year 1 FTE: ${fte || ''}. Timeline: ${timeline || ''}. Top priority: ${priority || ''}.`
        }
      });

      let parsed = outreachResult;
      if (outreachResult?.content?.[0]?.text) {
        try { parsed = JSON.parse(outreachResult.content[0].text); } catch { parsed = null; }
      }

      if (parsed?.email1_subject && process.env.RESEND_API_KEY) {
        const outreachHtml = buildOutreachEmail(body, parsed);
        await sendEmail(`[GCC Lead Request] Outreach Emails — ${name}, ${company}`, outreachHtml);
      }
    } catch(e) {
      console.error('Outreach engine error:', e.message);
    }
  }
}
