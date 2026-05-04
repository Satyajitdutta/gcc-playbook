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

async function sendEmail(subject, html, toOverride) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: 'Pithonix GCC Platform <info@pithonix.ai>',
    to: toOverride || 'satyajit.d@pithonix.ai',
    cc: toOverride ? 'satyajitv.d@pithonix.ai' : 'info@pithonix.ai',
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

function fmt(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + n;
}

function buildBlueprintEmail(data, bp) {
  const { name, company } = data;
  const city = bp.city_primary || 'Hyderabad';
  const cityReason = bp.city_primary_reason || '';
  const setup = fmt(bp.setup_budget_total_usd);
  const yr1 = bp.yearly_budget && bp.yearly_budget[0] ? fmt(bp.yearly_budget[0].budget_usd) : '—';
  const yr2 = bp.yearly_budget && bp.yearly_budget[1] ? fmt(bp.yearly_budget[1].budget_usd) : '—';
  const yr3 = bp.yearly_budget && bp.yearly_budget[2] ? fmt(bp.yearly_budget[2].budget_usd) : '—';
  const savings5yr = fmt(bp.total_5yr_savings_usd);
  const breakEven = bp.break_even_months ? `Month ${bp.break_even_months}` : '—';

  const incentiveRows = (bp.govt_incentives || []).slice(0, 3).map(i =>
    `<tr><td style="padding:8px 12px;font-weight:600;color:#0f172a;vertical-align:top">${i.scheme || ''}</td>
     <td style="padding:8px 12px;color:#374151;font-size:13px">${i.benefit || ''}</td></tr>`
  ).join('');

  const riskRows = (bp.risks || []).slice(0, 3).map(r =>
    `<tr><td style="padding:8px 12px;font-weight:600;color:#0f172a;vertical-align:top">${r.risk || ''}</td>
     <td style="padding:8px 12px;color:#374151;font-size:13px">${r.mitigation || ''}</td></tr>`
  ).join('');

  const phase0Items = (bp.phase0_actions || []).map(a =>
    `<li style="margin-bottom:6px;color:#374151;font-size:13px;line-height:1.5">${a}</li>`
  ).join('');

  const budgetRows = (bp.setup_budget_breakdown || []).map(b =>
    `<tr><td style="padding:7px 12px;color:#374151;font-size:13px">${b.category || ''}</td>
     <td style="padding:7px 12px;color:#0f172a;font-weight:600;font-size:13px;text-align:right">${fmt(b.cost_usd)}</td>
     <td style="padding:7px 12px;color:#64748b;font-size:12px">${b.notes || ''}</td></tr>`
  ).join('');

  const hiddenInsight = bp.hidden_insight
    ? `<div style="margin:20px 0;padding:14px 16px;background:#fefce8;border-left:4px solid #f59e0b;border-radius:4px">
        <p style="margin:0;font-size:13px;color:#92400e"><strong>Hidden Insight:</strong> ${bp.hidden_insight}</p>
       </div>`
    : '';

  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:680px;margin:0 auto;background:#f8fafc;padding:24px">

    <div style="background:#0f172a;padding:24px;border-radius:12px 12px 0 0">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;letter-spacing:1.5px;text-transform:uppercase">Pithonix AI — GCC Playbook</p>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Your Custom GCC Blueprint</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:13px">${name ? name + ', ' : ''}${company || 'Your Company'}</p>
    </div>

    <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">

      <!-- Recommended City -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:20px">
        <p style="margin:0 0 4px;font-size:11px;color:#16a34a;font-weight:700;letter-spacing:1px;text-transform:uppercase">Recommended City</p>
        <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">${city}</h2>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.6">${cityReason}</p>
        ${bp.city_alt ? `<p style="margin:8px 0 0;font-size:12px;color:#64748b">Alt: <strong>${bp.city_alt}</strong> — ${bp.city_alt_reason || ''}</p>` : ''}
      </div>

      ${hiddenInsight}

      <!-- Budget Summary -->
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a;letter-spacing:0.5px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:8px">Investment Summary</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr style="background:#f1f5f9">
          <td style="padding:10px 12px;font-weight:700;color:#0f172a">Setup Budget (One-Time)</td>
          <td style="padding:10px 12px;font-weight:700;color:#0f172a;text-align:right">${setup}</td>
        </tr>
        <tr><td style="padding:8px 12px;color:#374151">Year 1 Operational Budget</td><td style="padding:8px 12px;color:#0f172a;font-weight:600;text-align:right">${yr1}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:8px 12px;color:#374151">Year 2 Budget</td><td style="padding:8px 12px;color:#0f172a;font-weight:600;text-align:right">${yr2}</td></tr>
        <tr><td style="padding:8px 12px;color:#374151">Year 3 Budget</td><td style="padding:8px 12px;color:#0f172a;font-weight:600;text-align:right">${yr3}</td></tr>
        <tr style="background:#f0fdf4">
          <td style="padding:10px 12px;font-weight:700;color:#166534">5-Year Net Savings vs US/UK</td>
          <td style="padding:10px 12px;font-weight:700;color:#166534;text-align:right">${savings5yr}</td>
        </tr>
        <tr style="background:#eff6ff">
          <td style="padding:8px 12px;color:#1e40af;font-weight:600">Break-Even Point</td>
          <td style="padding:8px 12px;color:#1e40af;font-weight:600;text-align:right">${breakEven}</td>
        </tr>
      </table>

      ${budgetRows ? `
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a;letter-spacing:0.5px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:8px">Setup Budget Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:700;letter-spacing:1px;text-transform:uppercase">Category</th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:700;letter-spacing:1px;text-transform:uppercase">Cost</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:700;letter-spacing:1px;text-transform:uppercase">Notes</th>
        </tr></thead>
        <tbody>${budgetRows}</tbody>
      </table>` : ''}

      ${incentiveRows ? `
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a;letter-spacing:0.5px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:8px">Government Incentives Available</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:#f0fdf4">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#16a34a;font-weight:700;letter-spacing:1px;text-transform:uppercase">Scheme</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#16a34a;font-weight:700;letter-spacing:1px;text-transform:uppercase">Benefit</th>
        </tr></thead>
        <tbody>${incentiveRows}</tbody>
      </table>` : ''}

      ${phase0Items ? `
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a;letter-spacing:0.5px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:8px">First 30 Days — Actions</h3>
      <ul style="margin:0 0 20px;padding-left:20px">${phase0Items}</ul>` : ''}

      ${riskRows ? `
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a;letter-spacing:0.5px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:8px">Top Risks and Mitigations</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead><tr style="background:#fff7ed">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#c2410c;font-weight:700;letter-spacing:1px;text-transform:uppercase">Risk</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#c2410c;font-weight:700;letter-spacing:1px;text-transform:uppercase">Mitigation</th>
        </tr></thead>
        <tbody>${riskRows}</tbody>
      </table>` : ''}

      <!-- CTA -->
      <div style="margin-top:24px;padding:20px;background:#0f172a;border-radius:10px;text-align:center">
        <p style="margin:0 0 6px;color:#94a3b8;font-size:12px">Ready to move from blueprint to live GCC?</p>
        <p style="margin:0 0 16px;color:#ffffff;font-size:16px;font-weight:700">Pithonix builds, operates, and transfers your GCC.</p>
        <a href="https://gcc-playbook.pithonix.ai/#contact" style="display:inline-block;background:#3b82f6;color:#ffffff;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px">Book a GCC Strategy Call</a>
      </div>

      <p style="margin:20px 0 0;font-size:11px;color:#94a3b8;text-align:center">
        Generated by Pithonix GCC Playbook Simulator · <a href="https://gcc-playbook.pithonix.ai" style="color:#3b82f6;text-decoration:none">gcc-playbook.pithonix.ai</a>
      </p>
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

  const { name, email, company, industry, country, functions, fte, timeline, priority, source, blueprint } = body;

  const isPartner = (source || '').toLowerCase().includes('partner');
  const tag = isPartner ? 'Partnership Request' : 'GCC Lead Request';
  const subjectSuffix = isPartner
    ? `${company || 'Unknown'} — ${functions || 'Partner'}`
    : `${company || 'Unknown'} — ${industry || 'GCC Enquiry'}`;
  const subject = `[${tag}] ${subjectSuffix}`;

  console.log('SUBMISSION', JSON.stringify({
    timestamp: new Date().toISOString(), tag, source, name, email, company
  }));

  // Send notification email to Pithonix team
  if (process.env.RESEND_API_KEY) {
    try {
      const html = isPartner ? buildPartnerEmail(body) : buildLeadEmail(body);
      await sendEmail(subject, html);
    } catch(e) {
      console.error('Email send error:', e.message);
    }

    // For GCC leads: send blueprint copy to submitter + CC satyajitv.d
    if (!isPartner && email && blueprint) {
      try {
        let bp = {};
        try { bp = JSON.parse(blueprint); } catch {}
        if (bp.city_primary) {
          const bpHtml = buildBlueprintEmail(body, bp);
          await sendEmail(
            `Your GCC Blueprint — ${bp.city_primary} | Pithonix`,
            bpHtml,
            email
          );
        }
      } catch(e) {
        console.error('Blueprint email error:', e.message);
      }
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
