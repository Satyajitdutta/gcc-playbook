// Pithonix GCC Playbook — Lead Capture API
// Receives: name, email, company, industry, country, functions, fte, timeline, priority
// Sends notification to LEAD_WEBHOOK_URL (set in Vercel env vars)
// Set up a Power Automate HTTP trigger → Send Email to info@pithonix.ai

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

  const { name, email, company, industry, country, functions, fte, timeline, priority } = body;

  // Log lead to Vercel function logs (always available)
  console.log('GCC_LEAD', JSON.stringify({
    timestamp: new Date().toISOString(),
    name, email, company, industry, country, functions, fte, timeline, priority
  }));

  // Forward to webhook if configured (Power Automate / Make.com / Zapier)
  const webhookUrl = process.env.LEAD_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const https = await import('https');
      const payload = JSON.stringify({
        source: 'GCC Playbook Simulator',
        timestamp: new Date().toISOString(),
        name: name || 'Not provided',
        email,
        company: company || 'Not provided',
        industry, country, functions, fte, timeline, priority
      });

      await new Promise((resolve) => {
        const url = new URL(webhookUrl);
        const reqOpts = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        };
        const r = https.default.request(reqOpts, (resp) => {
          resp.resume();
          resp.on('end', resolve);
        });
        r.on('error', resolve);
        r.write(payload);
        r.end();
      });
    } catch(e) {
      console.error('Webhook error:', e.message);
    }
  }

  res.status(200).json({ success: true });
}
