// Beyond CURE Corridor Signal Tracker API
// Auth required for write actions; public_stats and list_public are open read-only.
// Uses ADMIN_DATABASE_URL (same Neon DB as gcc_admin).

import { Pool } from 'pg';
import https from 'https';

const pool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL, ssl: { rejectUnauthorized: false } });
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

const CORS_ORIGINS = [
  'https://gcc-playbook.pithonix.ai',
  'https://pithonix.ai',
];

function setCors(req, res) {
  const origin = req.headers['origin'] || '';
  if (CORS_ORIGINS.includes(origin) || /satyajit-duttas-projects\.vercel\.app$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
}

async function verifyToken(token) {
  if (!token) return false;
  const r = await pool.query(
    `SELECT email FROM gcc_admin_sessions WHERE token=$1 AND session_expires_at>NOW()`,
    [token]
  );
  return r.rows.length > 0;
}

function geminiSearch(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      tools: [{ google_search: {} }],
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const action = (req.method === 'GET' ? req.query.action : req.body?.action) || '';
  const token = req.headers['x-admin-token'] || '';

  // ── PUBLIC READ ──────────────────────────────────────────────────────────────
  if (action === 'public_stats') {
    const r = await pool.query(
      `SELECT corridor, COUNT(*) as cnt, MAX(added_date) as last_date
       FROM beyond_cure_signals WHERE status='active' GROUP BY corridor`
    );
    const total = r.rows.reduce((s, row) => s + parseInt(row.cnt), 0);
    const last = r.rows.reduce((d, row) => (!d || row.last_date > d ? row.last_date : d), null);
    const byCorr = { warangal: 0, karimnagar: 0, nizamabad: 0 };
    r.rows.forEach(row => { if (byCorr[row.corridor] !== undefined) byCorr[row.corridor] = parseInt(row.cnt); });
    res.json({ total, last_updated: last, by_corridor: byCorr });
    return;
  }

  if (action === 'list_public') {
    const r = await pool.query(
      `SELECT company, corridor, signal_cat, signal_detail, source, added_date, probability
       FROM beyond_cure_signals WHERE status='active' ORDER BY added_date DESC, probability DESC LIMIT 50`
    );
    res.json({ signals: r.rows });
    return;
  }

  // ── AUTH WALL ────────────────────────────────────────────────────────────────
  const authed = await verifyToken(token);
  if (!authed) { res.status(401).json({ error: 'Unauthorised' }); return; }

  // ── ADMIN: LIST ALL ──────────────────────────────────────────────────────────
  if (action === 'list') {
    const showArchived = req.body?.archived === true;
    const r = await pool.query(
      `SELECT * FROM beyond_cure_signals WHERE status=$1 ORDER BY added_date DESC, probability DESC`,
      [showArchived ? 'archived' : 'active']
    );
    res.json({ signals: r.rows });
    return;
  }

  // ── ADMIN: ADD MANUAL SIGNAL ─────────────────────────────────────────────────
  if (action === 'add') {
    const { company, corridor, signal_cat, signal_detail, source, probability, notes } = req.body;
    if (!company || !corridor || !signal_cat) { res.status(400).json({ error: 'company, corridor, signal_cat required' }); return; }
    await pool.query(
      `INSERT INTO beyond_cure_signals (company, corridor, signal_cat, signal_detail, source, probability, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [company.trim(), corridor, signal_cat, signal_detail || '', source || '', probability || 0, notes || '']
    );
    res.json({ ok: true });
    return;
  }

  // ── ADMIN: ARCHIVE / UNARCHIVE ───────────────────────────────────────────────
  if (action === 'archive' || action === 'unarchive') {
    const { id } = req.body;
    await pool.query(`UPDATE beyond_cure_signals SET status=$1 WHERE id=$2`, [action === 'archive' ? 'archived' : 'active', id]);
    res.json({ ok: true });
    return;
  }

  // ── ADMIN: DELETE ────────────────────────────────────────────────────────────
  if (action === 'delete') {
    const { id } = req.body;
    await pool.query(`DELETE FROM beyond_cure_signals WHERE id=$1`, [id]);
    res.json({ ok: true });
    return;
  }

  // ── ADMIN: DISCOVER (Gemini + Google Search grounding) ───────────────────────
  if (action === 'discover') {
    const prompt =
      `You are an intelligence analyst identifying companies that may be planning to set up a GCC (Global Capability Centre) or large data centre in one of three specific corridors in Telangana, India: Warangal, Karimnagar, or Nizamabad. These corridors have been named in a Government of Telangana directive (CM Revanth Reddy, May 2026) as priority destinations for GCC decentralisation beyond Hyderabad.\n\n` +
      `Search the open web for INDIRECT, INFERRED signals only. A signal qualifies if it is unconfirmed intent, NOT a confirmed, publicly announced GCC setup.\n\n` +
      `SIGNAL TYPES TO LOOK FOR:\n` +
      `- talent: job postings in Warangal/Karimnagar/Nizamabad by companies with no existing presence there\n` +
      `- regulatory: new company/branch registrations (MCA/ROC) in these districts\n` +
      `- real_estate: commercial leasing reports or permits mentioning these cities\n` +
      `- infrastructure: large power/fibre connections applied for in these corridors\n` +
      `- government_policy: company names mentioned in government pipeline documents or MoU signings for these corridors\n` +
      `- earnings: earnings call or investor communication mentioning tier-2 India or these specific cities\n` +
      `- vendor_ecosystem: staffing agency branch openings or fit-out RFPs for these corridors\n` +
      `- digital_footprint: LinkedIn location additions, patent filings with new India address, domain registrations\n` +
      `- informal_network: news, forum posts, or alumni network signals specifically mentioning these corridors\n\n` +
      `STRICT EXCLUSION RULE: Do NOT include any company that has already made a public confirmed announcement of a GCC in Warangal, Karimnagar, or Nizamabad. Only inferred, unconfirmed intent qualifies.\n\n` +
      `Return a JSON array of up to 8 candidates. Each object:\n` +
      `{"company":"","corridor":"warangal|karimnagar|nizamabad","signal_cat":"<type from list above>","signal_detail":"<what was found, 1-2 sentences>","source":"<where you found this>","probability":<0-100 integer based on signal strength>}\n\n` +
      `Return ONLY the JSON array, no markdown, no explanation. If you find nothing credible, return [].`;

    let result;
    try { result = await geminiSearch(prompt); }
    catch (e) { res.status(500).json({ error: 'Gemini error: ' + e.message }); return; }

    const txt = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const m = txt.match(/\[[\s\S]*\]/);
    if (!m) { res.json({ added: 0, candidates: [] }); return; }

    let candidates;
    try { candidates = JSON.parse(m[0]); }
    catch (e) { res.status(500).json({ error: 'JSON parse error' }); return; }

    const validCorridors = ['warangal', 'karimnagar', 'nizamabad'];
    const validCats = ['talent','regulatory','real_estate','infrastructure','government_policy','earnings','vendor_ecosystem','digital_footprint','informal_network'];
    let added = 0;

    for (const c of candidates) {
      if (!c.company || !validCorridors.includes(c.corridor) || !validCats.includes(c.signal_cat)) continue;
      // Skip if company already active in this corridor
      const existing = await pool.query(
        `SELECT id FROM beyond_cure_signals WHERE LOWER(company)=LOWER($1) AND corridor=$2 AND status='active'`,
        [c.company, c.corridor]
      );
      if (existing.rows.length > 0) continue;
      await pool.query(
        `INSERT INTO beyond_cure_signals (company, corridor, signal_cat, signal_detail, source, probability)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [c.company, c.corridor, c.signal_cat, c.signal_detail || '', c.source || '', c.probability || 0]
      );
      added++;
    }

    res.json({ added, candidates: candidates.length });
    return;
  }

  res.status(400).json({ error: 'Unknown action' });
}
