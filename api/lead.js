// Pithonix GCC Playbook — Lead Capture + Auto Outreach Generator
// Flow: Lead submits form → capture lead → call outreach engine → send full pack to Make webhook
// Make webhook → email to info@pithonix.ai with lead details + 3 ready-to-send outreach emails

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

  // Log lead
  console.log('GCC_LEAD', JSON.stringify({
    timestamp: new Date().toISOString(),
    source: source || 'GCC Simulator',
    name, email, company, industry, country, functions, fte, timeline, priority
  }));

  // Respond to client immediately so the form shows success without waiting
  res.status(200).json({ success: true });

  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  if (!webhookUrl) return;

  // Step 1 — Send immediate lead notification to Make (fast, no emails yet)
  const immediatePayload = {
    source: source || 'GCC Playbook Simulator',
    timestamp: new Date().toISOString(),
    name: name || 'Not provided',
    email, company: company || 'Not provided',
    industry, country, functions, fte, timeline, priority,
    outreach_status: 'Generating outreach emails...'
  };
  try { await postJSON(webhookUrl, immediatePayload); } catch(e) { console.error('Webhook error:', e.message); }

  // Step 2 — Call outreach engine to generate 3 personalised emails
  let outreachEmails = null;
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

    // Engine wraps output in content[0].text as stringified JSON
    let parsed = outreachResult;
    if (outreachResult && outreachResult.content && outreachResult.content[0] && outreachResult.content[0].text) {
      try { parsed = JSON.parse(outreachResult.content[0].text); } catch { parsed = null; }
    }
    if (parsed && parsed.email1_subject) {
      outreachEmails = parsed;
    }
  } catch(e) {
    console.error('Outreach engine error:', e.message);
  }

  // Step 3 — Send enriched payload to Make with outreach emails included
  if (outreachEmails) {
    const enrichedPayload = {
      source: source || 'GCC Playbook Simulator',
      timestamp: new Date().toISOString(),
      name: name || 'Not provided',
      email, company: company || 'Not provided',
      industry, country, functions, fte, timeline, priority,
      outreach_status: 'Ready — 3 emails generated',

      // Company intelligence
      company_summary: outreachEmails.company_summary || '',
      pain_points: Array.isArray(outreachEmails.pain_points) ? outreachEmails.pain_points.join(' | ') : '',
      pithonix_fit: outreachEmails.pithonix_fit || '',

      // Ready-to-send email sequence
      email1_subject: outreachEmails.email1_subject || '',
      email1_body: outreachEmails.email1_body || '',
      email2_subject: outreachEmails.email2_subject || '',
      email2_body: outreachEmails.email2_body || '',
      email3_subject: outreachEmails.email3_subject || '',
      email3_body: outreachEmails.email3_body || ''
    };
    try { await postJSON(webhookUrl, enrichedPayload); } catch(e) { console.error('Enriched webhook error:', e.message); }
  }
}
