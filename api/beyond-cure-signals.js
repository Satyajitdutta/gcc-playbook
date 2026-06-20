// Beyond CURE Corridor Signal Tracker API
// Auth required for write actions; public_stats and list_public are open read-only.
// Uses ADMIN_DATABASE_URL (same Neon DB as gcc_admin).

import { Pool } from 'pg';
import https from 'https';

const pool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL, ssl: { rejectUnauthorized: false } });
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

// Companies with confirmed, established GCC / captive / major tech hub presence in India.
// Any candidate matching this list is rejected before Pass 2 validation.
// Normalised to lowercase for comparison.
const ESTABLISHED_INDIA_GCC = new Set([
  // Big Tech
  'google','microsoft','amazon','apple','meta','netflix','adobe','salesforce','oracle','ibm',
  'sap','intel','qualcomm','nvidia','cisco','hp','dell','vmware','servicenow','workday',
  'autodesk','splunk','palo alto networks','crowdstrike','fortinet','zscaler',
  // Indian IT (never a "new entrant")
  'tcs','tata consultancy services','infosys','wipro','hcl','hcl technologies',
  'tech mahindra','cognizant','mphasis','hexaware','ltimindtree','l&t technology services',
  'persistent systems','coforge','zensar','birlasoft','niit technologies','mastech',
  'kpit technologies','cyient','sasken','sonata software',
  // Consulting / Big 4
  'deloitte','pwc','pricewaterhousecoopers','ernst & young','ey','kpmg','accenture',
  'capgemini','mckinsey','boston consulting group','bcg','bain','oliver wyman','pa consulting',
  // BFSI — long-established India GCCs
  'jpmorgan','jp morgan','goldman sachs','morgan stanley','citi','citibank','hsbc',
  'barclays','deutsche bank','ubs','credit suisse','bnp paribas','societe generale',
  'standard chartered','bank of america','wells fargo','american express','visa','mastercard',
  'fidelity','blackrock','vanguard','state street','northern trust','charles schwab',
  'blackstone','kkr','carlyle','franklin templeton','wellington management',
  'zurich insurance','axa','prudential','manulife','sun life',
  // Insurance / risk
  'aon','marsh','willis towers watson','wtw',
  // Pharma / Life Sciences
  'astrazeneca','novartis','pfizer','johnson & johnson','j&j','roche','sanofi',
  'gsk','glaxosmithkline','abbott','baxter','medtronic','bd','becton dickinson',
  'lilly','eli lilly','merck','msd','bms','bristol myers squibb','abbvie','amgen',
  'biogen','regeneron','genentech','alexion','shire','takeda','astellas',
  // Healthcare / Insurance (US)
  'unitedhealth','unitedhealth group','aetna','cigna','humana','anthem','elevance',
  'centene','molina','magellan','optum',
  // CPG / FMCG with long-established GCCs
  'pepsi','pepsico','coca cola','unilever','procter & gamble','p&g','nestle',
  'colgate','henkel','reckitt','kimberly clark','mondelez','kraft heinz',
  'general mills','kellanova','conagra','campbells','hershey',
  'l oreal','loreal','estee lauder','revlon','coty','shiseido','kao',
  // Retail / e-commerce
  'walmart','target','costco','kroger','carrefour','tesco','ikea','zara','inditex',
  'h&m','gap','nike','adidas','puma','under armour',
  // Auto
  'toyota','honda','volkswagen','bmw','mercedes','ford','general motors','gm',
  'stellantis','hyundai','kia','renault','nissan','volvo','bosch','continental',
  'denso','magna','valeo','aptiv',
  // Telecom / Media
  'at&t','verizon','t-mobile','comcast','charter','vodafone','ericsson','nokia',
  'genesys','genesys telecom labs','avaya','nice','verint','aspect',
  'dish','directv','fox','disney','warner','paramount','sony',
  // Logistics / Supply chain
  'ups','fedex','dhl','maersk','kuehne nagel','db schenker','ceva','dsv','geodis',
  // SaaS / Cloud (established)
  'twilio','zendesk','hubspot','freshworks','zoho','atlassian','datadog','dynatrace',
  'new relic','elastic','mongodb','databricks','snowflake','cloudera','hortonworks',
  'confluent','hashicorp','chef','puppet','ansible','redhat','suse',
  // Semiconductors / EDA
  'arm','synopsys','cadence','mentor graphics','ansys','siemens eda',
  'broadcom','marvell','micron','western digital','seagate','kingston',
  // Aerospace / Defence
  'boeing','airbus','lockheed martin','raytheon','northrop grumman','general dynamics',
  'l3harris','bae systems','thales','safran','rolls royce','ge aerospace',
  // Energy / Utilities
  'shell','bp','exxon','chevron','total','engie','schneider electric','abb',
  'siemens','ge','honeywell','emerson','rockwell','yokogawa','aspentech',
  // Engineering / Industrial
  '3m','caterpillar','john deere','parker hannifin','eaton','danaher','illinois tool works',
  'ingersoll rand','carrier','trane','johnson controls','otis','dover',
]);

function isKnownIndia(name) {
  const n = name.toLowerCase().trim();
  return ESTABLISHED_INDIA_GCC.has(n) ||
    [...ESTABLISHED_INDIA_GCC].some(k => n.includes(k) || k.includes(n));
}

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

function geminiCall(prompt, useSearch) {
  return new Promise((resolve, reject) => {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    };
    if (useSearch) payload.tools = [{ google_search: {} }];
    const body = JSON.stringify(payload);
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

// Pass 2: pure reasoning check — does this company already have India GCC presence?
async function hasIndiaPresence(company) {
  const prompt =
    `Does the company "${company}" already have an established GCC, captive centre, or major technology/engineering hub in India with more than 200 employees?\n` +
    `Answer with a single word: YES or NO.\n` +
    `Do not explain. Do not add any other text.`;
  try {
    const result = await geminiCall(prompt, false);
    const txt = (result?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toUpperCase();
    return txt.startsWith('YES');
  } catch (e) {
    return false; // if uncertain, let it through to human review
  }
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

  // ── ADMIN: DISCOVER (two-pass: Search grounding + India presence validation) ──
  if (action === 'discover') {
    // PASS 1: Google-grounded search for raw candidates.
    // Rules:
    //   - Signal must cite one of the three corridor cities BY NAME in the actual signal evidence.
    //   - Company must have NO existing India GCC, captive centre, or large technology hub.
    //   - Company must be an international (non-Indian headquartered) organisation.
    //   - Signal must be unconfirmed intent only — no already-announced GCC setups.
    const discoverPrompt =
      `You are a GCC intelligence analyst. Search for international companies (headquartered outside India) that are showing early, unconfirmed signals of interest in setting up a GCC or large technology centre in one of these three specific cities in Telangana, India: Warangal, Karimnagar, or Nizamabad.\n\n` +
      `These are tier-2 cities designated by the Government of Telangana (CM Revanth Reddy directive, May 2026) for GCC decentralisation beyond Hyderabad.\n\n` +
      `CRITICAL REQUIREMENTS — all three must be true for a candidate to qualify:\n` +
      `1. The signal evidence must explicitly mention WARANGAL, KARIMNAGAR, or NIZAMABAD by name. Signals that only mention Hyderabad, Telangana, or India do NOT qualify.\n` +
      `2. The company must have NO existing GCC, captive centre, or major technology hub in India. Companies already operating large India offices (PepsiCo, Genesys, Google, Microsoft, Infosys, Wipro, TCS, Accenture, Deloitte, JPMorgan, etc.) do NOT qualify.\n` +
      `3. The company must be headquartered outside India.\n\n` +
      `SIGNAL TYPES:\n` +
      `- talent: job postings explicitly listing Warangal/Karimnagar/Nizamabad as the work location (not remote, not Hyderabad)\n` +
      `- regulatory: new MCA/ROC entity registration in these districts by a foreign company\n` +
      `- real_estate: commercial lease or office fit-out reports for these specific cities\n` +
      `- infrastructure: power/fibre connection applications for commercial capacity in these corridors\n` +
      `- government_policy: company name in Telangana government MoU pipeline documents citing these corridors\n` +
      `- earnings: earnings call or investor document naming one of these three cities specifically\n` +
      `- vendor_ecosystem: staffing agency or fit-out contractor RFP naming these corridors on behalf of an unnamed client\n` +
      `- digital_footprint: LinkedIn company page location addition for these cities, or new India entity domain\n` +
      `- informal_network: credible news or industry forum signal naming one of these cities\n\n` +
      `Return a JSON array of up to 8 candidates. Format:\n` +
      `[{"company":"","corridor":"warangal|karimnagar|nizamabad","signal_cat":"<type>","signal_detail":"<exactly what the signal says, 1-2 sentences, cite the city by name>","source":"<URL or publication>","probability":<0-100>}]\n\n` +
      `Return ONLY the JSON array. No markdown fences. No explanation. If nothing credible found, return [].`;

    let result;
    try { result = await geminiCall(discoverPrompt, true); }
    catch (e) { res.status(500).json({ error: 'Gemini search error: ' + e.message }); return; }

    const txt = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const m = txt.match(/\[[\s\S]*\]/);
    if (!m) { res.json({ added: 0, scanned: 0, rejected_exclusion: 0, rejected_validation: 0, candidates: [] }); return; }

    let candidates;
    try { candidates = JSON.parse(m[0]); }
    catch (e) { res.status(500).json({ error: 'JSON parse error in Pass 1 output' }); return; }

    const validCorridors = ['warangal', 'karimnagar', 'nizamabad'];
    const validCats = ['talent','regulatory','real_estate','infrastructure','government_policy','earnings','vendor_ecosystem','digital_footprint','informal_network'];
    const corridorWords = ['warangal','karimnagar','nizamabad'];

    let added = 0;
    let rejectedExclusion = 0;
    let rejectedValidation = 0;
    const scanned = candidates.length;

    for (const c of candidates) {
      if (!c.company || !validCorridors.includes(c.corridor) || !validCats.includes(c.signal_cat)) continue;

      // Hardcoded exclusion list check (Layer 1)
      if (isKnownIndia(c.company)) {
        rejectedExclusion++;
        continue;
      }

      // Signal must mention the corridor city in the detail text (Layer 2)
      const detailLower = (c.signal_detail || '').toLowerCase();
      if (!corridorWords.some(w => detailLower.includes(w))) {
        rejectedExclusion++;
        continue;
      }

      // Skip if already in DB for this corridor (dedup)
      const existing = await pool.query(
        `SELECT id FROM beyond_cure_signals WHERE LOWER(company)=LOWER($1) AND corridor=$2 AND status='active'`,
        [c.company, c.corridor]
      );
      if (existing.rows.length > 0) continue;

      // PASS 2: Gemini reasoning check — does this company already have India presence?
      const alreadyInIndia = await hasIndiaPresence(c.company);
      if (alreadyInIndia) {
        rejectedValidation++;
        continue;
      }

      await pool.query(
        `INSERT INTO beyond_cure_signals (company, corridor, signal_cat, signal_detail, source, probability)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [c.company, c.corridor, c.signal_cat, c.signal_detail || '', c.source || '', c.probability || 0]
      );
      added++;
    }

    res.json({ added, scanned, rejected_exclusion: rejectedExclusion, rejected_validation: rejectedValidation });
    return;
  }

  res.status(400).json({ error: 'Unknown action' });
}
