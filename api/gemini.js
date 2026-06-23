// Pithonix GCC Playbook — Gemini Proxy
// Receives: full Gemini generateContent request body + _model field
// Adds server-side GEMINI_API_KEY and forwards to Gemini

import https from 'https';

const ALLOWED_ORIGINS = [
  'https://gcc-playbook.pithonix.ai',
  'https://pithonix.ai',
  'https://www.pithonix.ai',
  'https://wealth.pithonix.ai',
  'https://jeva.pithonix.ai',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow all Vercel preview deployments for this project
  if (/^https:\/\/gcc-playbook-[a-z0-9]+-satyajit-duttas-projects\.vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+-satyajit-duttas-projects\.vercel\.app$/.test(origin)) return true;
  return false;
}

export default async function handler(req, res) {
  const origin = req.headers['origin'] || '';

  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  // Require either a valid browser origin OR a matching proxy secret (for server-side calls)
  const proxySecret = req.headers['x-proxy-secret'] || '';
  const validSecret = process.env.GEMINI_PROXY_SECRET && proxySecret === process.env.GEMINI_PROXY_SECRET;
  if (!isAllowedOrigin(origin) && !validSecret) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  let body;
  try {
    if (typeof req.body === 'object') body = req.body;
    else {
      const raw = await new Promise((resolve) => {
        let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d));
      });
      body = JSON.parse(raw);
    }
  } catch(e) { res.status(400).json({ error: 'Invalid JSON' }); return; }

  const model = body._model || 'gemini-2.5-flash';
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) { res.status(500).json({ error: 'GEMINI_API_KEY not configured' }); return; }

  const { _model, ...geminiBody } = body;

  // Remove maxOutputTokens cap — let Gemini return full responses
  if (geminiBody.generationConfig) {
    delete geminiBody.generationConfig.maxOutputTokens;
  }

  const data = JSON.stringify(geminiBody);
  const path = `/v1beta/models/${model}:generateContent?key=${apiKey}`;

  return new Promise((resolve) => {
    const geminiReq = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (geminiRes) => {
      let raw = '';
      geminiRes.on('data', c => raw += c);
      geminiRes.on('end', () => {
        try { res.status(geminiRes.statusCode).json(JSON.parse(raw)); }
        catch(e) { res.status(geminiRes.statusCode).send(raw); }
        resolve();
      });
    });
    geminiReq.on('error', (e) => { res.status(500).json({ error: e.message }); resolve(); });
    geminiReq.write(data);
    geminiReq.end();
  });
}
