// Pithonix GCC Playbook — Internal Lead Identification Tool (Admin only)
// Access restricted to @pithonix.ai email addresses via OTP login.
// Dedicated Neon Postgres (ADMIN_DATABASE_URL) — separate from the partner portal's DATABASE_URL.
//
// POST { action: 'send', email }                          — send OTP (pithonix.ai only)
// POST { action: 'verify', email, otp }                   — verify OTP → session token
// GET  (X-Admin-Token header)                              — list all leads
// POST { action: 'save_lead', ...fields } + X-Admin-Token  — create/update a lead
// POST { action: 'research', id } + X-Admin-Token          — AI research pass on a lead
// POST { action: 'run_simulation', id } + X-Admin-Token    — zone-aware tentative blueprint
// POST { action: 'delete_lead', id } + X-Admin-Token       — remove a lead
// POST { action: 'archive_leads', ids:[...] } + X-Admin-Token   — manually archive selected leads
// POST { action: 'unarchive_leads', ids:[...] } + X-Admin-Token — bring selected leads back to active

import { Resend } from 'resend';
import https from 'https';
import crypto from 'crypto';
import pg from 'pg';
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

// Same designated-zone logic as the public simulator (index.html ZONE_MAP), kept in sync manually.
const ZONE_MAP = {
  'Healthcare & Life Sciences': { zone: 'Genome Valley', city: 'Hyderabad', type: 'Life Sciences & Pharma Cluster',
    benefit: '200+ resident life-sciences companies (incl. Novartis, GSK, Lonza), ~15,000-strong scientific workforce, plus the dedicated GCC zone at Bharat Future City for clinical analytics, drug design, and AI-led drug discovery.' },
  'Automotive / Manufacturing': { zone: 'Hardware Park (Shamshabad SEZ)', city: 'Hyderabad', type: 'Electronics & Hardware Manufacturing SEZ',
    benefit: '1,700-acre dedicated SEZ for electronics and hardware manufacturing with established supply-chain and logistics infrastructure.' },
  'BFSI (Banking, Financial Services, Insurance)': { zone: 'Financial District, Gachibowli', city: 'Hyderabad', type: 'BFSI & Fintech Corridor',
    benefit: 'Existing BFSI GCC concentration (incl. Vanguard, LPL Financial), Grade-A office supply, proximity to the Gachibowli talent corridor.' },
  'Technology / SaaS': { zone: 'HITEC City / Gachibowli', city: 'Hyderabad', type: 'IT & Software Corridor',
    benefit: 'Largest concentration of GCC and IT campuses in the state, deepest entry-to-mid talent pool for engineering roles.' },
};

// ── PITHONIX INTERNAL CORRIDOR INTELLIGENCE ─────────────────────────────────────────────────────
// Proprietary. Not for external sharing. Used only to enrich AI research and simulation prompts.
// Source: Pithonix AI Corridor Intelligence Series, Report 1 v4 (Japan, 2026-06-28) & Report 2 v3 (Germany, 2026-06-27).
// Market baseline (Nasscom-Zinnov FY2026): 2,117 GCCs | USD 98.4B revenue | 2.36M professionals | 506 Forbes G2000 firms present.
const CORRIDOR_INTEL = {
  germany: {
    anchor: 'Deutsche Börse (opened Hyderabad GCC August 2025 via ANSR GCC-as-a-service model — 1,000+ jobs planned, capital-markets platforms, AI/ML analytics, cybersecurity, cloud). CM Revanth Reddy met German Consul General and Deutsche Börse CIO in November 2025. Herrenknecht (tunnelling-tech Mittelstand) opened Hyderabad digital center in 2024.',
    decisionNotes: 'German corporates respond to regulatory predictability and verifiable engineering evidence — NOT cost or peer reference alone. ITE&C rule-of-law framing resonates. Mittelstand firms are family-owned; decisions take 12-18 months but are sticky once made. Works Council (Betriebsrat) approval often required before India announcement goes public — frame as additive capability, never job substitution. Lead with IP security, regulatory predictability, and de-risked entry (BOT/GaaS). Two-track outreach: large enterprise (corporate-to-government, evidence-led) and Mittelstand (via IGCC/AHK chambers and de-risking partners). IGCC has no Hyderabad office — getting one is highest-leverage state action.',
    marketStats: '80+ German enterprises, 150+ GCC units, 130K professionals, ~4B euros value in India. Mittelstand: 31% of units, +108% in 5 years, now entering independently for first time. 68% of German companies rank India top-5 market (up 14 pts in one year). 79% plan India investment by 2030. 42% plan GCC by 2030. Cost saving: 40-60% vs Germany. Lufthansa Hyderabad-Frankfurt direct, 5x weekly (early 2025).',
    costModel: 'Hyderabad Rs 25-31 lakh/FTE/year, 15-20% below Bengaluru. Tier 2 city multiplier applies to Warangal, Karimnagar, Nizamabad corridors. Mid-size German center ~350 people = ~Rs 98 crore/year.',
    watchlist: [
      { name: 'Munich Re', tier: 1, rank: 1, sector: 'BFSI (Banking, Financial Services, Insurance)', note: 'Reinsurance giant, Hyderabad BFSI corridor natural fit. Peer Deutsche Börse already here.' },
      { name: 'Hannover Re', tier: 1, rank: 2, sector: 'BFSI (Banking, Financial Services, Insurance)', note: 'Second-largest reinsurer globally. High actuarial and data analytics demand aligns with Hyderabad talent.' },
      { name: 'Talanx', tier: 1, rank: 3, sector: 'BFSI (Banking, Financial Services, Insurance)', note: 'Industrial insurance group, owns HDI. Strong IT modernization agenda — GCC likely for claims tech.' },
      { name: 'Commerzbank', tier: 1, rank: 4, sector: 'BFSI (Banking, Financial Services, Insurance)', note: 'Digital transformation underway, India GCC gap vs Deutsche Bank and DZ Bank peers.' },
      { name: 'DWS Group', tier: 1, rank: 5, sector: 'BFSI (Banking, Financial Services, Insurance)', note: 'Asset management arm of Deutsche Bank. Fund ops and data engineering functions viable for Hyderabad.' },
      { name: 'Merck KGaA', tier: 2, rank: 6, sector: 'Healthcare & Life Sciences', note: 'Science and technology company. Genome Valley fit. Existing India commercial presence, GCC gap.' },
      { name: 'Fresenius', tier: 2, rank: 7, sector: 'Healthcare & Life Sciences', note: 'Healthcare services and products. Clinical data, supply chain analytics use case.' },
      { name: 'Boehringer Ingelheim', tier: 2, rank: 8, sector: 'Healthcare & Life Sciences', note: 'Private pharma, no public shareholders — decisions faster than listed peers. Genome Valley fit.' },
      { name: 'B. Braun', tier: 2, rank: 9, sector: 'Healthcare & Life Sciences', note: 'Medical devices and pharma. Family-owned Mittelstand at scale. R&D digitization driver.' },
      { name: 'BASF', tier: 2, rank: 10, sector: 'Healthcare & Life Sciences', note: 'Chemicals giant, India commercial ops exist. GCC for procurement, engineering, IT plausible.' },
      { name: 'Symrise', tier: 2, rank: 11, sector: 'Healthcare & Life Sciences', note: 'Fragrance and flavor science. Niche but high-value R&D digitization use case.' },
      { name: 'Beiersdorf', tier: 2, rank: 12, sector: 'Healthcare & Life Sciences', note: 'NIVEA parent. Consumer science and supply chain analytics.' },
      { name: 'Evonik', tier: 2, rank: 13, sector: 'Healthcare & Life Sciences', note: 'Specialty chemicals. Process digitization and engineering analytics GCC potential.' },
      { name: 'Covestro', tier: 2, rank: 14, sector: 'Healthcare & Life Sciences', note: 'Polymer materials. Sustainability analytics and R&D support functions.' },
      { name: 'Sartorius', tier: 2, rank: 15, sector: 'Healthcare & Life Sciences', note: 'Lab instruments and bioprocess solutions. Strong post-COVID R&D investment wave.' },
      { name: 'Software AG', tier: 3, rank: 16, sector: 'Technology / SaaS', note: 'Enterprise integration software. HITEC City natural fit, India talent for product engineering.' },
      { name: 'TeamViewer', tier: 3, rank: 17, sector: 'Technology / SaaS', note: 'Remote connectivity SaaS. Engineering GCC likely as product scales.' },
      { name: 'Nemetschek', tier: 3, rank: 18, sector: 'Technology / SaaS', note: 'AEC software. BIM and digital construction analytics — niche but growing.' },
      { name: 'CompuGroup Medical', tier: 3, rank: 19, sector: 'Healthcare & Life Sciences', note: 'Health IT software. Intersection of tech and life sciences corridors.' },
      { name: 'Bechtle', tier: 3, rank: 20, sector: 'Technology / SaaS', note: 'IT services and infrastructure. India delivery center plausible for managed services.' },
      { name: 'Siemens Energy', tier: 3, rank: 21, sector: 'Energy & Utilities', note: 'Spun off from Siemens 2020. Grid digitization and energy transition analytics.' },
      { name: 'GEA Group', tier: 3, rank: 22, sector: 'Automotive / Manufacturing', note: 'Food processing equipment. Engineering design and simulation support.' },
      { name: 'Heidelberg Materials', tier: 3, rank: 23, sector: 'Automotive / Manufacturing', note: 'Cement and aggregates. Sustainability reporting and procurement analytics.' },
      { name: 'KION Group', tier: 3, rank: 24, sector: 'Automotive / Manufacturing', note: 'Forklifts and warehouse automation. Supply chain tech GCC potential.' },
      { name: 'Thyssenkrupp', tier: 3, rank: 25, sector: 'Automotive / Manufacturing', note: 'Industrial conglomerate undergoing restructuring. IT rationalization may drive GCC.' },
      { name: 'DHL', tier: 3, rank: 26, sector: 'Professional Services', note: 'Logistics giant. Existing India ops but GCC for tech/analytics functions gap.' },
      { name: 'Adidas', tier: 3, rank: 27, sector: 'Retail / E-Commerce', note: 'Global sportswear. India sourcing hub, GCC for digital commerce and analytics likely.' },
      { name: 'Drägerwerk', tier: 3, rank: 28, sector: 'Healthcare & Life Sciences', note: 'Medical and safety tech. Family-owned. Niche engineering and regulatory analytics.' },
      { name: 'Zalando', tier: 3, rank: 29, sector: 'Retail / E-Commerce', note: 'European fashion e-commerce. Engineering and data GCC — HITEC City fit.' },
      { name: 'Delivery Hero', tier: 3, rank: 30, sector: 'Retail / E-Commerce', note: 'Food delivery platform. India engineering hub potential.' },
      // Mittelstand track
      { name: 'Trumpf', tier: 'M', rank: 'M1', sector: 'Automotive / Manufacturing', note: 'Laser tech and machine tools. Industrial engineering and simulation.' },
      { name: 'Dürr', tier: 'M', rank: 'M2', sector: 'Automotive / Manufacturing', note: 'Automotive paint and assembly systems. Engineering analytics.' },
      { name: 'SEW-Eurodrive', tier: 'M', rank: 'M3', sector: 'Automotive / Manufacturing', note: 'Drive technology. Engineering design support.' },
      { name: 'Phoenix Contact', tier: 'M', rank: 'M4', sector: 'Automotive / Manufacturing', note: 'Electrical connectors and industrial automation.' },
      { name: 'SICK', tier: 'M', rank: 'M5', sector: 'Automotive / Manufacturing', note: 'Sensors and industrial automation. IoT analytics potential.' },
      { name: 'Krones', tier: 'M', rank: 'M6', sector: 'Automotive / Manufacturing', note: 'Beverage bottling systems. Engineering and service analytics.' },
      { name: 'Kärcher', tier: 'M', rank: 'M7', sector: 'Automotive / Manufacturing', note: 'Cleaning technology. R&D digitization.' },
      { name: 'Brainlab', tier: 'M', rank: 'M8', sector: 'Healthcare & Life Sciences', note: 'Surgical navigation technology. Clinical data and AI.' },
      { name: 'Karl Storz', tier: 'M', rank: 'M9', sector: 'Healthcare & Life Sciences', note: 'Endoscopy systems. Medtech engineering support.' },
      { name: 'Ottobock', tier: 'M', rank: 'M10', sector: 'Healthcare & Life Sciences', note: 'Prosthetics and orthotics. R&D and clinical analytics.' },
      { name: 'DATEV', tier: 'M', rank: 'M11', sector: 'Technology / SaaS', note: 'Tax and accounting software cooperative. Product engineering.' },
      { name: 'Atoss', tier: 'M', rank: 'M12', sector: 'Technology / SaaS', note: 'Workforce management software. SaaS engineering GCC.' },
      { name: 'USU Software', tier: 'M', rank: 'M13', sector: 'Technology / SaaS', note: 'IT service management software. Product and delivery.' },
      { name: 'Freudenberg', tier: 'M', rank: 'M14', sector: 'Automotive / Manufacturing', note: 'Diversified industrial group. Sealing and performance materials.' },
      { name: 'Wacker Chemie', tier: 'M', rank: 'M15', sector: 'Healthcare & Life Sciences', note: 'Specialty chemicals and silicon. Process digitization.' },
    ]
  },
  japan: {
    anchor: 'Dai-ichi Life (opened Hyderabad GCC June 2025 with Capgemini, scaling 60 to 600 by 2027 — first Japanese insurer to open an overseas GCC anywhere in the world. Also in Hyderabad: Hitachi Digital Services, Renault Nissan Alliance satellite, Mitsubishi Electric research link with IIT Hyderabad, signalled SMBC center).',
    decisionNotes: 'Japanese corporates follow nemawashi (informal consensus-building, 18-30 months) then ringi (formal written approval chain). Decision is never owned by one executive — equip internal champions with full ringi-ready evidence packs. Follow-the-leader agglomeration is the strongest predictor of location choice (Belderbos-Carree, Pugel-Kimura). Japan scores 92/100 on uncertainty avoidance — demand more scenario modeling, 5-7yr retention analysis, contingency plans than Western firms. High-context communication: absent "no" is not a "yes." Never rush or pressure. A peer-led roadshow featuring Dai-ichi Life leadership is the single most powerful conversion tool for the insurance cohort. JETRO engages governments, not private vendors — prioritise G2G channel through Japan Desk.',
    marketStats: 'India GCC base: 2,117 centers, USD 98.4B revenue, 2.36M professionals (Nasscom-Zinnov FY2026). Japan: 192 Forbes G2000 companies, ~115 (~60%) have NO India GCC — single largest underrepresented cohort. ~60 Japanese GCCs operational by end-2025, up from ~30 in 2020 (+100% in 4 years). Non-US GCC CAGR 6.8% vs 3.8% for US. Japan national target: 5,000 companies to India by 2029. USD 9.9B Japan-India finance facility. Average Japanese GCC: 500-750 staff. Single mid-size anchor = ~Rs 98 crore/year economic activity.',
    costModel: 'Hyderabad Rs 25-31 lakh/FTE/year, 15-20% below Bengaluru. India engineering talent ~USD 25K/year vs Japan USD 80-120K (60-70% arbitrage). Tier 2 city multiplier applies to Warangal, Karimnagar, Nizamabad corridors.',
    watchlist: [
      { name: 'Nippon Life', tier: 1, rank: 1, sector: 'BFSI (Banking, Financial Services, Insurance)', note: 'Largest Japanese life insurer. Dai-ichi Life peer — follow-the-leader behavior expected. Ringi-ready evidence from Dai-ichi Life is the trigger.' },
      { name: 'Tokio Marine', tier: 1, rank: 2, sector: 'BFSI (Banking, Financial Services, Insurance)', note: 'P&C insurance giant. Global digital transformation underway, India GCC gap.' },
      { name: 'MS&AD Insurance', tier: 1, rank: 3, sector: 'BFSI (Banking, Financial Services, Insurance)', note: 'Mitsui Sumitomo Insurance parent. Strong agglomeration incentive.' },
      { name: 'Sompo Holdings', tier: 1, rank: 4, sector: 'BFSI (Banking, Financial Services, Insurance)', note: 'Non-life insurance. Digital and data analytics modernization program.' },
      { name: 'Meiji Yasuda Life', tier: 1, rank: 5, sector: 'BFSI (Banking, Financial Services, Insurance)', note: 'Mutual life insurer. Conservative but follows peers. Long decision cycle but high conviction once decided.' },
      { name: 'Mitsubishi Corporation', tier: 2, rank: 6, sector: 'Professional Services', note: 'Sogo shosha (general trading). Vast India commercial interests. Shared services GCC logical.' },
      { name: 'Mitsui & Co.', tier: 2, rank: 7, sector: 'Professional Services', note: 'Trading house. India infrastructure and energy investments. Analytics and finance GCC.' },
      { name: 'Itochu', tier: 2, rank: 8, sector: 'Professional Services', note: 'Trading conglomerate, strong in textiles and food. India supply chain analytics.' },
      { name: 'Sumitomo Corporation', tier: 2, rank: 9, sector: 'Professional Services', note: 'Trading house. India metals and energy exposure. GCC for commodity analytics.' },
      { name: 'Marubeni', tier: 2, rank: 10, sector: 'Professional Services', note: 'Trading house. Agri and energy focus. India analytics and procurement support.' },
      { name: 'Panasonic', tier: 3, rank: 11, sector: 'Automotive / Manufacturing', note: 'Consumer and industrial electronics. India manufacturing base, GCC for IoT and supply chain.' },
      { name: 'Canon', tier: 3, rank: 12, sector: 'Automotive / Manufacturing', note: 'Imaging and printing. R&D and service analytics GCC potential.' },
      { name: 'Toyota Tsusho', tier: 3, rank: 13, sector: 'Automotive / Manufacturing', note: 'Toyota trading arm. India auto sector deep integration.' },
      { name: 'Murata Manufacturing', tier: 3, rank: 14, sector: 'Automotive / Manufacturing', note: 'Electronic components. Engineering and quality analytics.' },
      { name: 'Ricoh', tier: 3, rank: 15, sector: 'Technology / SaaS', note: 'Document solutions. Digital workplace transformation. India IT talent fit.' },
      { name: 'Otsuka Holdings', tier: 3, rank: 16, sector: 'Healthcare & Life Sciences', note: 'Pharma and nutraceuticals. Clinical data and regulatory analytics. Genome Valley fit.' },
      { name: 'Chugai Pharmaceutical', tier: 3, rank: 17, sector: 'Healthcare & Life Sciences', note: 'Roche subsidiary. Oncology focus. Clinical bioinformatics GCC potential.' },
      { name: 'Shionogi', tier: 3, rank: 18, sector: 'Healthcare & Life Sciences', note: 'Pharma. Infectious disease focus. R&D data and regulatory support.' },
      { name: 'Komatsu', tier: 3, rank: 19, sector: 'Automotive / Manufacturing', note: 'Construction equipment. Digital construction and IoT analytics platform.' },
      { name: 'Kubota', tier: 3, rank: 20, sector: 'Automotive / Manufacturing', note: 'Agricultural machinery. India agri sector presence. Precision agriculture analytics.' },
      { name: 'Mitsubishi Heavy Industries', tier: 3, rank: 21, sector: 'Automotive / Manufacturing', note: 'Defense, energy, and infrastructure. Engineering simulation and analytics.' },
      { name: 'Keyence', tier: 3, rank: 22, sector: 'Automotive / Manufacturing', note: 'Industrial automation sensors. No India GCC but high-value engineering talent demand.' },
      { name: 'Shin-Etsu Chemical', tier: 3, rank: 23, sector: 'Healthcare & Life Sciences', note: 'Semiconductor materials. Process engineering analytics.' },
      { name: 'Kyocera', tier: 3, rank: 24, sector: 'Automotive / Manufacturing', note: 'Electronics and ceramics. Engineering design support.' },
      { name: 'TDK', tier: 3, rank: 25, sector: 'Automotive / Manufacturing', note: 'Electronic components. IoT and energy solutions analytics.' },
      { name: 'Fast Retailing', tier: 3, rank: 26, sector: 'Retail / E-Commerce', note: 'UNIQLO parent. Supply chain analytics and digital commerce.' },
      { name: 'SoftBank', tier: 3, rank: 27, sector: 'Technology / SaaS', note: 'Telecom and tech investments. India deep — Paytm, Ola. Tech GCC for portfolio analytics.' },
      { name: 'KDDI', tier: 3, rank: 28, sector: 'Telecom / Media', note: 'Telecom operator. Digital transformation and IoT analytics.' },
      { name: 'Nidec', tier: 3, rank: 29, sector: 'Automotive / Manufacturing', note: 'Electric motors. EV drivetrain analytics and engineering.' },
      { name: 'Mitsui O.S.K. Lines', tier: 3, rank: 30, sector: 'Professional Services', note: 'Shipping and logistics. Fleet analytics and supply chain optimization.' },
    ]
  }
};

function getCorridorContext(companyName, country) {
  const name = (companyName || '').toLowerCase().trim();
  const ctry = (country || '').toLowerCase();
  let corridor = null;
  if (ctry.includes('germany') || ctry.includes('german') || ctry.includes('deutschland')) corridor = 'germany';
  else if (ctry.includes('japan') || ctry.includes('japanese')) corridor = 'japan';
  if (!corridor) {
    // Try name match against both lists
    for (const [key, data] of Object.entries(CORRIDOR_INTEL)) {
      if (data.watchlist.some(c => c.name.toLowerCase() === name)) { corridor = key; break; }
    }
  }
  if (!corridor) return null;
  const data = CORRIDOR_INTEL[corridor];
  const match = data.watchlist.find(c => c.name.toLowerCase() === name);
  let ctx = `\nPITHONIX INTERNAL CORRIDOR INTELLIGENCE (${corridor.toUpperCase()} CORRIDOR — DO NOT CITE OR SHARE):\n`;
  ctx += `Anchor company already in Hyderabad: ${data.anchor}\n`;
  ctx += `Decision-process notes: ${data.decisionNotes}\n`;
  ctx += `Cost model: ${data.costModel}\n`;
  if (match) {
    ctx += `This company is on the Pithonix ${corridor.charAt(0).toUpperCase()+corridor.slice(1)} Watchlist:\n`;
    ctx += `  Rank: ${match.rank} | Tier: ${match.tier} | Sector: ${match.sector}\n`;
    ctx += `  Strategic note: ${match.note}\n`;
  }
  ctx += `Use this intelligence to inform your analysis. Do not quote it directly or attribute it — treat it as analyst background knowledge.\n`;
  return ctx;
}

// Deterministic, auditable probability score. Each factor is visible in signal_factors so the
// number can be defended to a government partner, not a single opaque LLM-judged figure.
// 25 signal types across 7 clusters. GOT-style scoring: signals from MORE DISTINCT CLUSTERS
// reinforce each other (a hiring post + a leasing report = a stronger combined story than
// either alone), so the diversity bonus rewards corroboration, not just a longer list.
const SIGNAL_CLUSTERS = {
  // Talent
  senior_hiring_post: 'talent', leadership_relocation_post: 'talent', glassdoor_jobs_surge: 'talent',
  linkedin_employee_count_jump: 'talent', niche_skill_hiring_burst: 'talent',
  // Real estate
  leasing_report: 'real_estate', sez_land_allocation: 'real_estate', coworking_largeblock_booking: 'real_estate',
  new_office_permit_filed: 'real_estate',
  // Financial / investor
  earnings_call_mention: 'financial', analyst_report_mention: 'financial', capex_guidance_increase: 'financial',
  sec_filing_india_mention: 'financial',
  // Government / policy
  government_pipeline_listed: 'government', tsipass_application_filed: 'government', sez_approval_listed: 'government',
  trade_mission_delegation: 'government',
  // Industry / peer
  competitor_already_landed: 'industry', conference_signal: 'industry', industry_association_membership: 'industry',
  vendor_rfp_india_scope: 'industry',
  // Media / PR
  news_article: 'media', press_release_india_expansion: 'media', executive_interview_mention: 'media',
  ma_or_jv_announcement: 'media',
  // Digital footprint
  domain_registration_india: 'digital', job_portal_company_page_created: 'digital', social_media_india_office_post: 'digital',
  other: 'media',
};
const SIGNAL_WEIGHTS = {
  senior_hiring_post: 30, leasing_report: 25, earnings_call_mention: 25, sez_land_allocation: 24,
  government_pipeline_listed: 20, tsipass_application_filed: 22, sez_approval_listed: 22, competitor_already_landed: 12,
  leadership_relocation_post: 22, analyst_report_mention: 18, capex_guidance_increase: 18, sec_filing_india_mention: 20,
  conference_signal: 15, industry_association_membership: 10, vendor_rfp_india_scope: 18, trade_mission_delegation: 16,
  press_release_india_expansion: 20, executive_interview_mention: 14, ma_or_jv_announcement: 18,
  glassdoor_jobs_surge: 14, linkedin_employee_count_jump: 14, niche_skill_hiring_burst: 16,
  coworking_largeblock_booking: 16, new_office_permit_filed: 18,
  domain_registration_india: 8, job_portal_company_page_created: 10, social_media_india_office_post: 8,
  news_article: 10, other: 5,
};
// Only these exact slugs are valid signal types. A value like "talent" or "real_estate" (a
// cluster name, not a signal) gets dropped rather than silently scored as a weak "other" signal —
// that mismatch is what let low-quality candidates slip through with misleading low scores.
const VALID_SIGNAL_TYPES = new Set(Object.keys(SIGNAL_CLUSTERS).filter(s => s !== 'other'));

function scoreCandidate(c) {
  const rawSignals = Array.isArray(c.signals) && c.signals.length ? c.signals : [c];
  const signals = rawSignals.filter(s => VALID_SIGNAL_TYPES.has(s.signal_type));
  if (signals.length === 0) return null;
  const detail = [];
  const clustersSeen = new Set();
  let signalPoints = 0;
  for (const s of signals) {
    const type = s.signal_type;
    const points = SIGNAL_WEIGHTS[type] || SIGNAL_WEIGHTS.other;
    const cluster = SIGNAL_CLUSTERS[type];
    clustersSeen.add(cluster);
    signalPoints += points;
    detail.push({ signal_type: type, cluster, points, named_explicitly: !!s.named_explicitly,
      recency_days: typeof s.recency_days === 'number' ? s.recency_days : 9999,
      source_count: Math.max(1, parseInt(s.source_count) || 1), evidence: s.evidence || '' });
  }
  const namedExplicitly = detail.some(d => d.named_explicitly);
  const namedPoints = namedExplicitly ? 15 : 0;
  const bestRecency = Math.min(...detail.map(d => d.recency_days));
  const recencyPoints = bestRecency <= 30 ? 20 : bestRecency <= 90 ? 10 : 0;
  const maxSources = Math.max(...detail.map(d => d.source_count));
  const sourcePoints = maxSources >= 2 ? 15 : 0;
  // Cross-cluster corroboration bonus: independent categories of evidence pointing the same way.
  const clusterDiversityPoints = clustersSeen.size >= 3 ? 20 : clustersSeen.size === 2 ? 10 : 0;
  const total = Math.min(100, Math.round(signalPoints / signals.length) + namedPoints + recencyPoints + sourcePoints + clusterDiversityPoints);
  return {
    total, signals_used: detail.length, clusters_used: Array.from(clustersSeen), cluster_diversity_points: clusterDiversityPoints,
    named_explicitly: namedExplicitly, named_explicitly_points: namedPoints, recency_days: bestRecency, recency_points: recencyPoints,
    source_count: maxSources, source_count_points: sourcePoints, signal_detail: detail,
  };
}

function callGemini(prompt, useSearch) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) { reject(new Error('GEMINI_API_KEY not configured')); return; }
    const reqBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, thinkingConfig: { thinkingBudget: 0 } }
    };
    if (useSearch) reqBody.tools = [{ google_search: {} }];
    const body = JSON.stringify(reqBody);
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (r) => {
      let raw = '';
      r.on('data', c => raw += c);
      r.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const text = data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
          if (!text) { reject(new Error('Empty Gemini response')); return; }
          resolve(text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  return JSON.parse(await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); }));
}

async function requireSession(client, req) {
  const token = req.headers['x-admin-token'];
  if (!token) return null;
  const r = await client.query(
    'SELECT email FROM gcc_admin_sessions WHERE token=$1 AND session_expires_at > NOW()',
    [token]
  );
  return r.rows[0] || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!process.env.ADMIN_DATABASE_URL) { res.status(500).json({ error: 'Database not configured' }); return; }

  const client = await getPool().connect();
  try {

    if (req.method === 'GET') {
      // Public blog endpoint — no auth required
      if (req.query && req.query.blog === '1') {
        await client.query(`CREATE TABLE IF NOT EXISTS gcc_blog_posts (id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, excerpt TEXT, content TEXT, linkedin_copy TEXT, tags TEXT[], status TEXT DEFAULT 'draft', scheduled_at TIMESTAMPTZ, published_at TIMESTAMPTZ, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
        if (req.query.slug) {
          const r = await client.query(`SELECT id,title,slug,excerpt,content,tags,published_at FROM gcc_blog_posts WHERE slug=$1 AND status='published'`, [req.query.slug]);
          if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
          return res.status(200).json({ post: r.rows[0] });
        }
        const r = await client.query(`SELECT id,title,slug,excerpt,tags,published_at FROM gcc_blog_posts WHERE status='published' ORDER BY published_at DESC LIMIT 20`);
        return res.status(200).json({ posts: r.rows });
      }
      const session = await requireSession(client, req);
      if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const showArchived = req.query && req.query.archived === '1';
      const r = showArchived
        ? await client.query('SELECT * FROM gcc_admin_leads ORDER BY updated_at DESC')
        : await client.query("SELECT * FROM gcc_admin_leads WHERE status != 'Archived' ORDER BY created_at DESC");
      return res.status(200).json({ leads: r.rows });
    }

    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    let body;
    try { body = await parseBody(req); } catch { res.status(400).json({ error: 'Invalid JSON' }); return; }
    const { action } = body;

    // -- OTP: send (pithonix.ai only) --
    if (action === 'send') {
      const email = (body.email || '').trim().toLowerCase();
      if (!email.endsWith('@pithonix.ai')) { res.status(403).json({ error: 'Access restricted to pithonix.ai accounts' }); return; }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 10 * 60 * 1000);
      // Drop any pending (unverified) OTP rows for this email, then issue a fresh one
      await client.query(`DELETE FROM gcc_admin_sessions WHERE email=$1 AND session_expires_at IS NULL`, [email]);
      await client.query(
        `INSERT INTO gcc_admin_sessions (token, email, otp_code, otp_expires_at)
         VALUES ($1, $2, $3, $4)`,
        [crypto.randomBytes(16).toString('hex'), email, otp, expires]
      );

      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'Pithonix GCC Platform <info@pithonix.ai>',
          to: email,
          subject: `Your GCC Lead Admin Code: ${otp}`,
          html: `<div style="font-family:Arial,sans-serif;background:#0a0f1e;color:#f1f5f9;padding:32px"><div style="max-width:420px;margin:0 auto;background:#0d1426;border-radius:12px;padding:28px;text-align:center"><p style="color:#94a3b8;font-size:12px;letter-spacing:2px;text-transform:uppercase">GCC LEAD ADMIN</p><div style="font-size:36px;font-weight:700;color:#22c55e;letter-spacing:8px;margin:16px 0">${otp}</div><p style="color:#64748b;font-size:12px">Expires in 10 minutes.</p></div></div>`
        });
      }
      return res.status(200).json({ sent: true });
    }

    // -- OTP: verify --
    if (action === 'verify') {
      const email = (body.email || '').trim().toLowerCase();
      const otp = (body.otp || '').trim();
      const r = await client.query(
        'SELECT token, otp_code, otp_expires_at FROM gcc_admin_sessions WHERE email=$1 AND session_expires_at IS NULL ORDER BY created_at DESC LIMIT 1',
        [email]
      );
      if (r.rows.length === 0 || r.rows[0].otp_code !== otp) { res.status(401).json({ error: 'Invalid code' }); return; }
      if (new Date(r.rows[0].otp_expires_at) < new Date()) { res.status(401).json({ error: 'Code expired' }); return; }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 12 * 60 * 60 * 1000);
      await client.query(
        `UPDATE gcc_admin_sessions SET token=$1, session_expires_at=$2, otp_code=NULL WHERE email=$3 AND token=$4`,
        [sessionToken, tokenExpires, email, r.rows[0].token]
      );
      return res.status(200).json({ token: sessionToken, email });
    }

    // -- public_stats: no auth required, called from the public site's live tracker --
    if (action === 'public_stats') {
      const r = await client.query(
        `SELECT COUNT(*)::int AS detected_count, COALESCE(AVG(probability_score),0)::int AS avg_score, MAX(created_at) AS last_scan
         FROM gcc_admin_leads WHERE status IN ('Detected','Researched','Simulated')`
      );
      const landed = await client.query(`SELECT COUNT(*)::int AS landed_count FROM gcc_admin_leads WHERE status = 'Landed'`);
      return res.status(200).json({
        tracked_count: r.rows[0].detected_count,
        avg_probability: r.rows[0].avg_score,
        last_scan: r.rows[0].last_scan,
        landed_count: landed.rows[0].landed_count,
        signal_types: Object.keys(SIGNAL_CLUSTERS).filter(s => s !== 'other').length,
        clusters: 7,
      });
    }

    // -- everything below requires a valid session --
    const session = await requireSession(client, req);
    if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }

    if (action === 'save_lead') {
      const f = body.fields || {};
      if (body.id) {
        const r = await client.query(
          `UPDATE gcc_admin_leads SET company_name=$1, industry=$2, country=$3, functions_needed=$4,
             year1_fte=$5, timeline=$6, top_priority=$7, source_notes=$8, status=$9, updated_at=NOW()
           WHERE id=$10 RETURNING *`,
          [f.company_name, f.industry, f.country, f.functions_needed, f.year1_fte, f.timeline, f.top_priority, f.source_notes, f.status || 'New', body.id]
        );
        return res.status(200).json({ lead: r.rows[0] });
      }
      const r = await client.query(
        `INSERT INTO gcc_admin_leads (company_name, industry, country, functions_needed, year1_fte, timeline, top_priority, source_notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [f.company_name, f.industry, f.country, f.functions_needed, f.year1_fte, f.timeline, f.top_priority, f.source_notes, session.email]
      );
      return res.status(200).json({ lead: r.rows[0] });
    }

    if (action === 'delete_lead') {
      await client.query('DELETE FROM gcc_admin_leads WHERE id=$1', [body.id]);
      return res.status(200).json({ success: true });
    }

    if (action === 'archive_leads') {
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
      if (ids.length === 0) { res.status(400).json({ error: 'No leads selected' }); return; }
      await client.query(`UPDATE gcc_admin_leads SET status='Archived', updated_at=NOW() WHERE id = ANY($1::int[])`, [ids]);
      return res.status(200).json({ success: true, archived: ids.length });
    }

    if (action === 'unarchive_leads') {
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
      if (ids.length === 0) { res.status(400).json({ error: 'No leads selected' }); return; }
      await client.query(`UPDATE gcc_admin_leads SET status='Detected', updated_at=NOW() WHERE id = ANY($1::int[])`, [ids]);
      return res.status(200).json({ success: true, unarchived: ids.length });
    }

    if (action === 'research') {
      const r = await client.query('SELECT * FROM gcc_admin_leads WHERE id=$1', [body.id]);
      if (r.rows.length === 0) { res.status(404).json({ error: 'Lead not found' }); return; }
      const lead = r.rows[0];
      const industryOptions = Object.keys(ZONE_MAP).concat([
        'Retail / E-Commerce', 'Consumer Packaged Goods (CPG)', 'Energy & Utilities', 'Professional Services', 'Telecom / Media', 'Other'
      ]);
      const corridorCtx = getCorridorContext(lead.company_name, lead.country || '');
      const prompt = 'You are a GCC market analyst at Pithonix researching a probable lead BEFORE any company contact has been made. '+
        'Using what is publicly known or reasonably inferable about this company (its sector, scale, and how similar companies have approached India GCCs), '+
        'fill in the dropdown fields a Pithonix analyst would otherwise have to guess manually. Be honest about uncertainty, do not invent named deals, dates, or quotes.\n\n'+
        'Company: '+lead.company_name+'\n'+(lead.source_notes?'Signal / source notes: '+lead.source_notes+'\n':'')+
        (corridorCtx ? corridorCtx : '')+'\n'+
        'Return ONLY valid JSON in this exact shape:\n'+
        '{"industry":"one of: '+industryOptions.join(' | ')+'","country":"likely HQ country","functions_needed":"comma-separated list of likely functions, e.g. Technology Hub (Engineering, AI/ML, Cloud, DevOps), Data & Analytics (BI, Data Engineering)","year1_fte":"a range like 80-150 FTEs","timeline":"one of: Fast-Track (9-12 months) | Balanced (18-24 months) | Phased (24-36 months)","top_priority":"one of: Cost Leadership | Innovation Engine | Talent Access | Risk Diversification","research_summary":"150-250 word honest brief explaining the reasoning behind each field above, ending with one line on what must be confirmed directly with the company before this is treated as fact","confidence_level":"High/Medium/Low"}';
      let text;
      try { text = await callGemini(prompt); }
      catch (e) { res.status(502).json({ error: 'Research generation failed: ' + e.message }); return; }
      const m = text.match(/\{[\s\S]*\}/);
      let parsed;
      try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
      if (!parsed) { res.status(502).json({ error: 'Could not parse research output' }); return; }
      const r2 = await client.query(
        `UPDATE gcc_admin_leads SET industry=$1, country=$2, functions_needed=$3, year1_fte=$4, timeline=$5, top_priority=$6,
           research_summary=$7, status='Researched', updated_at=NOW() WHERE id=$8 RETURNING *`,
        [parsed.industry || lead.industry, parsed.country || lead.country, parsed.functions_needed || lead.functions_needed,
         parsed.year1_fte || lead.year1_fte, parsed.timeline || lead.timeline, parsed.top_priority || lead.top_priority,
         (parsed.research_summary || '') + (parsed.confidence_level ? '\n\nConfidence: ' + parsed.confidence_level : ''), body.id]
      );
      return res.status(200).json({ lead: r2.rows[0] });
    }

    if (action === 'discover') {
      const industryOptions = Object.keys(ZONE_MAP).concat([
        'Retail / E-Commerce', 'Consumer Packaged Goods (CPG)', 'Energy & Utilities', 'Professional Services', 'Telecom / Media', 'Other'
      ]);
      const signalList = Object.keys(SIGNAL_CLUSTERS).filter(s => s !== 'other').join(', ');
      const prompt = 'You are a GCC market intelligence analyst at Pithonix. Your job is to find companies that DO NOT YET HAVE a GCC in India but show early, indirect signals of intent to set one up — specifically in Hyderabad/Telangana.\n\n'+
        'STEP 1 — GCC STATUS GATE (do this FIRST for every company you consider, before anything else):\n'+
        'Search for "[Company Name] GCC India" and "[Company Name] Global Capability Centre India" and "[Company Name] India operations center". Determine which of these three statuses applies:\n'+
        '  STATUS-A: OPERATIONAL — The company already has a live, running GCC or captive center in India. ANY evidence of an existing office, delivery center, or GCC already open = STATUS-A. DISCARD immediately. Do not score, do not include.\n'+
        '  STATUS-B: FORMALLY ANNOUNCED — The company has issued a press release, public statement, or news article naming a city and/or headcount for a GCC they are setting up. DISCARD immediately.\n'+
        '  STATUS-C: NO GCC YET — No public GCC or captive center in India confirmed. Only STATUS-C companies may proceed to Step 2.\n\n'+
        'STEP 2 — SIGNAL SEARCH (only for STATUS-C companies):\n'+
        'Look for indirect intent signals: senior India-based hiring in strategy/leadership roles (not just support), real-estate leasing chatter without public GCC announcement, earnings-call language about "evaluating" or "exploring" India, government inbound-pipeline mentions, or industry conference signals. '+
        'Each signal must be from a real, findable source. Do not infer from the company\'s general size or peer behavior alone.\n\n'+
        'Each signal_type value MUST be EXACTLY one of these strings: '+signalList+'.\n'+
        'Report every distinct signal type found — multiple signals from different clusters make a stronger lead.\n\n'+
        'STEP 3 — OUTPUT (STATUS-C companies with real signals only):\n'+
        'Return ONLY valid JSON, no markdown:\n'+
        '{"candidates":[{\n'+
        '  "company_name":"exact legal name, or \\"Unnamed European Aerospace Firm\\" if genuinely anonymized in the source",\n'+
        '  "gcc_status":"must be STATUS-C",\n'+
        '  "gcc_status_reasoning":"1 sentence: what you searched and what confirmed no existing GCC",\n'+
        '  "industry":"one of: '+industryOptions.join(' | ')+'",\n'+
        '  "country":"HQ country",\n'+
        '  "signals":[{"signal_type":"EXACTLY one of: '+signalList+'","named_explicitly":true_or_false,"recency_days":number,"source_count":number,"evidence":"1 sentence citing the source"}],\n'+
        '  "source_urls":["url1"]\n'+
        '}]}\n\n'+
        'HARD RULES:\n'+
        '- If a company already has employees in India, delivery centers, or any captive operation — even small ones — it is STATUS-A. Discard.\n'+
        '- If you are uncertain whether a company is STATUS-A or STATUS-C, discard. False positives waste analyst time more than false negatives.\n'+
        '- Return an empty candidates array if nothing credible was found.\n'+
        '- Limit to at most 4 candidates, max 3 signals each.';
      let text;
      try { text = await callGemini(prompt, true); }
      catch (e) { res.status(502).json({ error: 'Discovery failed: ' + e.message }); return; }
      const m = text.match(/\{[\s\S]*\}/);
      let parsed;
      try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
      if (!parsed || !Array.isArray(parsed.candidates)) { res.status(502).json({ error: 'Could not parse discovery output' }); return; }

      const existing = await client.query('SELECT LOWER(company_name) AS n FROM gcc_admin_leads');
      const existingNames = new Set(existing.rows.map(r => r.n));

      const inserted = [];
      let rejectedInvalidSignal = 0;
      let rejectedOperational = 0;
      for (const c of parsed.candidates) {
        if (!c.company_name || existingNames.has(c.company_name.toLowerCase())) continue;
        if (!c.gcc_status || c.gcc_status !== 'STATUS-C') { rejectedOperational++; continue; }
        const factors = scoreCandidate(c);
        if (!factors) { rejectedInvalidSignal++; continue; }
        existingNames.add(c.company_name.toLowerCase());
        const evidenceNote = factors.signal_detail.map(d => d.evidence + ' [' + d.signal_type + ']').join(' | ');
        const r = await client.query(
          `INSERT INTO gcc_admin_leads (company_name, industry, country, source_notes, status, probability_score, signal_factors, source_urls, created_by)
           VALUES ($1,$2,$3,$4,'Detected',$5,$6,$7,$8) RETURNING *`,
          [c.company_name, c.industry || null, c.country || null, evidenceNote,
           factors.total, JSON.stringify(factors), (c.source_urls || []).join(', '), session.email]
        );
        inserted.push(r.rows[0]);
      }
      return res.status(200).json({ inserted, scanned: parsed.candidates.length, rejectedInvalidSignal, rejectedOperational });
    }

    if (action === 'run_simulation') {
      const r = await client.query('SELECT * FROM gcc_admin_leads WHERE id=$1', [body.id]);
      if (r.rows.length === 0) { res.status(404).json({ error: 'Lead not found' }); return; }
      const lead = r.rows[0];
      const zoneMatch = ZONE_MAP[lead.industry] || null;
      const fteNum = parseInt(lead.year1_fte) || 80;
      const corridorCtxSim = getCorridorContext(lead.company_name, lead.country || '');
      const prompt = 'You are an India GCC setup cost expert at Pithonix.ai. Generate a TENTATIVE, lead-generation-stage GCC Setup Blueprint for internal use, '+
        'to be shared with Telangana government as a probable-lead case, not a client deliverable. Use current India market rate ranges.\n\n'+
        (zoneMatch ? 'TELANGANA DESIGNATED ZONE MATCH: For a '+lead.industry+' company, the fit is '+zoneMatch.zone+' in '+zoneMatch.city+' ('+zoneMatch.type+'). Why: '+zoneMatch.benefit+' Populate designated_zone in the output with this.\n\n' : 'No specific designated zone mapped for this industry yet; set designated_zone to null and use the city-tier model.\n\n')+
        'LEAD PROFILE (assumed, not confirmed by the company):\nCompany: '+lead.company_name+'\nIndustry: '+(lead.industry||'unknown')+'\nHQ Country: '+(lead.country||'unknown')+
        '\nFunctions Needed: '+(lead.functions_needed||'unknown')+'\nYear 1 FTE: '+(lead.year1_fte||'80-150')+'\nTimeline: '+(lead.timeline||'Balanced (18-24 months)')+
        '\nTop Priority: '+(lead.top_priority||'unknown')+'\nResearch Notes: '+(lead.research_summary||'none yet')+
        (corridorCtxSim ? '\n'+corridorCtxSim : '')+'\n\n'+
        'Return ONLY valid JSON: {"city_primary":"city","city_primary_reason":"2 sentences","designated_zone":'+(zoneMatch?'{"name":"'+zoneMatch.zone+'","type":"'+zoneMatch.type+'","benefit":"1-2 sentences"}':'null')+
        ',"setup_budget_total_usd":number,"year1_fte_estimate":number,"govt_pitch_summary":"3-4 sentences written for a Telangana government audience: why this company is a probable lead, what zone fits, and what the state should highlight when courting them","confidence_level":"High/Medium/Low — how confident this assumed profile is without direct company confirmation"}';
      let text;
      try { text = await callGemini(prompt); }
      catch (e) { res.status(502).json({ error: 'Simulation failed: ' + e.message }); return; }
      const m = text.match(/\{[\s\S]*\}/);
      let bp;
      try { bp = m ? JSON.parse(m[0]) : null; } catch { bp = null; }
      if (!bp) { res.status(502).json({ error: 'Could not parse simulation output' }); return; }
      await client.query(
        'UPDATE gcc_admin_leads SET blueprint_json=$1, designated_zone=$2, updated_at=NOW() WHERE id=$3',
        [JSON.stringify(bp), bp.designated_zone ? bp.designated_zone.name : null, body.id]
      );
      return res.status(200).json({ blueprint: bp });
    }

    // ── BLOG POST MANAGEMENT ──────────────────────────────────────────────────────
    if (action === 'blog_init') {
      const session = await requireSession(client, req);
      if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }
      await client.query(`
        CREATE TABLE IF NOT EXISTS gcc_blog_posts (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          excerpt TEXT,
          content TEXT,
          linkedin_copy TEXT,
          tags TEXT[],
          status TEXT DEFAULT 'draft',
          scheduled_at TIMESTAMPTZ,
          published_at TIMESTAMPTZ,
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      return res.status(200).json({ ok: true });
    }

    if (action === 'blog_list') {
      const session = await requireSession(client, req);
      if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }
      await client.query(`CREATE TABLE IF NOT EXISTS gcc_blog_posts (id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, excerpt TEXT, content TEXT, linkedin_copy TEXT, tags TEXT[], status TEXT DEFAULT 'draft', scheduled_at TIMESTAMPTZ, published_at TIMESTAMPTZ, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
      const r = await client.query('SELECT * FROM gcc_blog_posts ORDER BY created_at DESC');
      return res.status(200).json({ posts: r.rows });
    }

    if (action === 'blog_save') {
      const session = await requireSession(client, req);
      if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }
      await client.query(`CREATE TABLE IF NOT EXISTS gcc_blog_posts (id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, excerpt TEXT, content TEXT, linkedin_copy TEXT, tags TEXT[], status TEXT DEFAULT 'draft', scheduled_at TIMESTAMPTZ, published_at TIMESTAMPTZ, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
      const { id, title, slug, excerpt, content, linkedin_copy, tags, scheduled_at } = body;
      if (!title || !slug) { res.status(400).json({ error: 'Title and slug required' }); return; }
      const tagsArr = Array.isArray(tags) ? tags : [];
      let r;
      if (id) {
        r = await client.query(
          `UPDATE gcc_blog_posts SET title=$1,slug=$2,excerpt=$3,content=$4,linkedin_copy=$5,tags=$6,scheduled_at=$7,updated_at=NOW() WHERE id=$8 RETURNING *`,
          [title, slug, excerpt||'', content||'', linkedin_copy||'', tagsArr, scheduled_at||null, id]
        );
      } else {
        r = await client.query(
          `INSERT INTO gcc_blog_posts (title,slug,excerpt,content,linkedin_copy,tags,scheduled_at,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [title, slug, excerpt||'', content||'', linkedin_copy||'', tagsArr, scheduled_at||null, session.email]
        );
      }
      return res.status(200).json({ post: r.rows[0] });
    }

    if (action === 'blog_publish') {
      const session = await requireSession(client, req);
      if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const r = await client.query(
        `UPDATE gcc_blog_posts SET status='published', published_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
        [body.id]
      );
      return res.status(200).json({ post: r.rows[0] });
    }

    if (action === 'blog_unpublish') {
      const session = await requireSession(client, req);
      if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const r = await client.query(
        `UPDATE gcc_blog_posts SET status='draft', published_at=NULL, updated_at=NOW() WHERE id=$1 RETURNING *`,
        [body.id]
      );
      return res.status(200).json({ post: r.rows[0] });
    }

    if (action === 'blog_delete') {
      const session = await requireSession(client, req);
      if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }
      await client.query('DELETE FROM gcc_blog_posts WHERE id=$1', [body.id]);
      return res.status(200).json({ ok: true });
    }

    if (action === 'blog_seed') {
      const session = await requireSession(client, req);
      if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }
      await client.query(`CREATE TABLE IF NOT EXISTS gcc_blog_posts (id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, excerpt TEXT, content TEXT, linkedin_copy TEXT, tags TEXT[], status TEXT DEFAULT 'draft', scheduled_at TIMESTAMPTZ, published_at TIMESTAMPTZ, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`);
      const SEED_POSTS = [
        {
          title: "Why Germany's BFSI Sector Is the Next GCC Wave for Hyderabad",
          slug: "germany-bfsi-gcc-hyderabad",
          excerpt: "The reinsurance and insurance cluster forming in Germany has all the right conditions for a Hyderabad GCC move. Here is why the financial services corridor between Frankfurt and Hyderabad is heating up.",
          content: `<p>Hyderabad has quietly become a magnet for global financial services GCCs. The Financial District in Gachibowli is no longer just a name on a map. It is a functioning cluster, with a growing concentration of BFSI-focused GCCs that creates its own gravity.</p>

<p>What is less discussed is where the next wave is coming from. The signals point clearly to Germany's financial services sector, particularly the insurance and reinsurance industry centred around Frankfurt and Munich.</p>

<h3>Why Insurance and Reinsurance?</h3>

<p>Germany's insurance sector is among the most analytically intensive in the world. The core functions that GCCs specialise in, such as actuarial modelling, claims technology, risk analytics, regulatory reporting, and digital transformation, are exactly the functions that large German insurers are looking to industrialise. India's talent supply in these areas is deep and growing.</p>

<p>The cost differential is significant. Hyderabad offers a fully loaded FTE cost well below equivalent hubs in Germany or even Bengaluru. For a BFSI firm running multi-hundred-person analytics and technology teams, that arbitrage is not marginal. It is a material P&amp;L decision.</p>

<h3>The Regulatory Fit</h3>

<p>German financial services firms are highly sensitive to regulatory clarity. Telangana's rule-of-law framing, the ITE&C Department's track record of delivery on commitments, and India's improving data protection framework all matter to legal and compliance functions at these firms. The "predictability" argument resonates in ways it does not in other corridors.</p>

<h3>Cluster Behavior Is Already Visible</h3>

<p>Once one major firm from a sector establishes a GCC in a city, the follow-on wave from sector peers typically arrives within 18 to 36 months. This pattern has repeated across every major GCC cluster in Hyderabad. The German BFSI corridor is entering that window now.</p>

<p>Pithonix is actively tracking this corridor as part of its Corridor Intelligence Series. The Germany-Telangana corridor brief is available to government and investment promotion partners on request.</p>`,
          linkedin_copy: `Germany's insurance and reinsurance sector is the next GCC wave heading to Hyderabad.

The signals are clear: Frankfurt's financial giants are looking at Hyderabad's Financial District for actuarial modelling, claims tech, risk analytics, and regulatory functions.

Why Hyderabad specifically?
- Deep BFSI talent cluster already in place
- Cost well below both Germany and Bengaluru
- Regulatory predictability that German firms specifically respond to
- Cluster gravity: once a peer moves, the sector follows

Pithonix has been tracking the Germany-Telangana GCC corridor closely. The window is open now.

#GCCIndia #HyderabadGCC #Telangana #TelanganaRising #GCCEra #GCCPulse #GCCRise #GCCPros #BFSI #GermanyIndia #GlobalCapabilityCentre`,
          tags: ['Germany', 'BFSI', 'Hyderabad', 'GCC', 'Insurance', 'Corridor Intelligence']
        },
        {
          title: "The Mittelstand Opportunity: Germany's Hidden Champions and Telangana",
          slug: "mittelstand-gcc-telangana",
          excerpt: "Germany's Mittelstand, the world-class family-owned industrial companies that rarely make headlines, represent an underexplored GCC opportunity for Telangana. Understanding how they make decisions is the key.",
          content: `<p>When people talk about German companies and India, the conversation defaults to the DAX 40 giants. That is where the opportunity is assumed to be. It is not the whole picture.</p>

<p>Germany's Mittelstand, the several thousand family-owned and privately held companies that are often global leaders in highly specialised industrial niches, represent a quieter but potentially larger GCC opportunity for Telangana.</p>

<h3>What Makes Mittelstand Different</h3>

<p>These are not small companies. Many have revenues in the hundreds of millions to single-digit billions, with global customer bases and deep engineering heritage. What they share is a decision-making structure that is fundamentally different from publicly listed multinationals.</p>

<p>There are no shareholder pressure cycles. No quarterly earnings calls to manage. No public announcement required before a commitment is made. When a Mittelstand owner-manager decides to set up a capability centre in India, the organisation moves. The decision takes longer to reach, but once made, it is not reversed.</p>

<h3>The Functions That Fit</h3>

<p>Mittelstand firms are increasingly digitising their engineering, design, and service operations. The functions that translate well to a Hyderabad GCC are engineering simulation and analysis, industrial IoT and data analytics, ERP and digital transformation support, and precision manufacturing process digitisation. These are not commodity IT roles. They require domain expertise that Hyderabad's talent pool, particularly in engineering and manufacturing analytics, is well-positioned to supply.</p>

<h3>The Decision Timeline</h3>

<p>This is where Telangana's engagement strategy needs to be calibrated carefully. Mittelstand firms are not responsive to generic India pitch decks. They respond to evidence. Peer referrals carry enormous weight. A conversation with another Mittelstand owner who has already set up in Hyderabad is worth more than any brochure.</p>

<p>The engagement playbook for this segment: find the early movers, make them visible advocates, and let peer-to-peer testimony do the work. Works Council dynamics at these firms mean that internal buy-in for an India decision is a structured process. It is not something that can be rushed. But it also means the decision, once cleared, is durable.</p>

<p>Pithonix is tracking the Mittelstand segment as part of its Germany-Telangana Corridor Intelligence Brief.</p>`,
          linkedin_copy: `Germany's Mittelstand companies are an underexplored GCC opportunity for Hyderabad.

These are not small companies. They are world-class industrial specialists with global customer bases, deep engineering heritage, and family-owned decision structures that move differently from listed multinationals.

What makes them interesting for Telangana:
- Engineering simulation, industrial IoT, digital transformation functions translate perfectly
- No quarterly cycle pressure - decisions are slower but once made, they stick
- Works Council approval means buy-in is genuine when it comes
- Peer referrals carry more weight than any pitch deck

The Germany-Telangana corridor is not just about the big names. The hidden champions are coming too.

#GCCIndia #HyderabadGCC #Telangana #TelanganaRising #GCCEra #GCCGroup #GCCRise #GermanyIndia #Manufacturing #GlobalCapabilityCentre`,
          tags: ['Germany', 'Mittelstand', 'Manufacturing', 'Hyderabad', 'GCC', 'Corridor Intelligence']
        },
        {
          title: "Why German Life Sciences Companies Are Eyeing Genome Valley",
          slug: "germany-life-sciences-genome-valley",
          excerpt: "Genome Valley in Hyderabad is already home to over 200 life sciences companies. German pharma and medtech firms are starting to notice. Here is the corridor thesis.",
          content: `<p>Genome Valley is one of the most concentrated life sciences clusters in Asia. Over 200 companies, a purpose-built research infrastructure, and a talent base that spans pharmaceutical sciences, clinical analytics, and bioprocess engineering. For German life sciences firms exploring India, it is the obvious destination.</p>

<h3>Why German Life Sciences, Why Now</h3>

<p>Germany has one of the most sophisticated life sciences sectors in the world. Pharmaceutical companies, specialty chemical firms, medical device manufacturers, and bioprocess technology companies make up a sector that employs millions and competes globally on R&amp;D intensity.</p>

<p>The GCC gap in this segment is significant. Many of these firms have commercial operations in India but have not yet consolidated their R&amp;D support, clinical data functions, regulatory affairs analytics, or digital manufacturing capabilities into a structured GCC. The logic for doing so has only strengthened as India's scientific talent supply has matured.</p>

<h3>The Functions That Travel Well</h3>

<p>Clinical data management and biostatistics. Regulatory affairs and pharmacovigilance. Drug discovery support and cheminformatics. Manufacturing process analytics and quality systems. These are not peripheral functions. They are core to what German life sciences firms do, and they can be delivered from Hyderabad with access to deep domain talent that Germany cannot recruit at scale or cost.</p>

<h3>Genome Valley's GCC Zone</h3>

<p>The dedicated GCC zone at Bharat Future City adjacent to Genome Valley has been designed precisely for this use case: clinical analytics, AI-led drug discovery, and bioprocess digitisation. For a German pharma firm evaluating India, this is a turnkey proposition. Infrastructure, talent adjacency, and peer companies already in residence.</p>

<p>Pithonix is tracking German life sciences as a priority segment in its Germany-Telangana Corridor Intelligence Brief. Several companies in this segment are at active evaluation stage.</p>`,
          linkedin_copy: `Germany's life sciences sector is eyeing Genome Valley - and the case has never been stronger.

200+ resident companies. Purpose-built R&D infrastructure. A talent base in clinical analytics, bioprocess engineering, and drug discovery that Germany cannot replicate domestically at scale or cost.

The functions that are ready to move:
- Clinical data management and biostatistics
- Regulatory affairs and pharmacovigilance
- Drug discovery support and cheminformatics
- Manufacturing process analytics

The dedicated GCC zone at Bharat Future City makes this a turnkey decision for any serious German pharma or medtech evaluator.

Pithonix is tracking this corridor actively.

#GCCIndia #HyderabadGCC #Telangana #TelanganaRising #GCCEra #GCCPulse #GCCRise #GermanyIndia #LifeSciences #GenomeValley #GlobalCapabilityCentre`,
          tags: ['Germany', 'Life Sciences', 'Genome Valley', 'Pharma', 'GCC', 'Corridor Intelligence']
        },
        {
          title: "The Nemawashi Factor: Why Japanese Companies Take 18-30 Months to Choose India",
          slug: "nemawashi-japanese-gcc-india-decision",
          excerpt: "Japanese companies follow a consensus-building decision process called nemawashi, followed by a formal approval chain called ringi. Understanding this is the difference between a productive engagement and a frustrating one.",
          content: `<p>Anyone who has tried to move quickly with a Japanese corporate on an India decision knows the feeling. The meeting goes well. The interest seems genuine. And then nothing moves for months.</p>

<p>This is not indecision. It is process. And understanding it is the single most important factor in successfully converting Japanese companies into Hyderabad GCC investors.</p>

<h3>Nemawashi and Ringi</h3>

<p>Nemawashi is the practice of building broad internal consensus before a decision is formally proposed. The word literally refers to preparing the roots of a tree before transplanting. Every stakeholder who will be affected by a decision is consulted individually and informally before anything is put to a formal meeting. This takes time. It is not negotiable.</p>

<p>Ringi is the formal approval chain that follows. A proposal document circulates through the organisation, gathering stamps of approval from each relevant level. No one person makes the decision alone. The process is the decision.</p>

<p>For India GCC evaluations, this typically means an 18 to 30 month cycle from first serious conversation to formal commitment. Rushing this process does not accelerate it. It ends it.</p>

<h3>What Actually Moves the Needle</h3>

<p>Three things are proven to accelerate the nemawashi process for Japan-India GCC decisions. First, ringi-ready evidence packages: structured documentation with cost benchmarks, talent availability data, regulatory clarity confirmations, and peer case studies that decision-makers can literally include in their internal proposal. Second, peer testimony: a meeting with another Japanese company's India GCC head carries more weight in the internal consensus process than any external pitch. Third, anchor company visibility: when a known, respected Japanese company has already moved and is visibly successful, the follow-on wave from sector peers comes faster.</p>

<h3>The Agglomeration Effect</h3>

<p>Japanese firms show strong follow-the-leader behavior within sectors. Once an insurer moves, other insurers take notice. Once a trading house establishes a capability centre, peers evaluate the same. The first mover creates the template. Subsequent movers use it.</p>

<p>Hyderabad now has a Japanese anchor company in the financial services sector. The ringi clock has started for several sector peers.</p>`,
          linkedin_copy: `Why do Japanese companies take 18-30 months to decide on India? It is not slow decision-making. It is a process called nemawashi and ringi.

Nemawashi: building broad internal consensus before any formal proposal.
Ringi: a formal approval chain where no one person decides alone.

What this means for anyone trying to bring Japanese GCCs to Hyderabad:
- Never rush. Pressure ends conversations, not accelerates them.
- Provide ringi-ready evidence packages: cost benchmarks, talent data, regulatory clarity, peer case studies all structured for internal use
- Peer testimony from other Japanese GCC heads in India is worth more than any external pitch
- Once an anchor company moves, sector peers follow fast

The nemawashi process is already running for several Japanese firms watching Hyderabad closely.

#GCCIndia #HyderabadGCC #Telangana #TelanganaRising #GCCEra #GCCGroup #GCCPulse #JapanIndia #GlobalCapabilityCentre #GCCPros`,
          tags: ['Japan', 'Nemawashi', 'Decision Framework', 'GCC Strategy', 'Corridor Intelligence']
        },
        {
          title: "Why Japanese Insurance Companies Are Leading the Hyderabad GCC Story",
          slug: "japan-insurance-gcc-hyderabad",
          excerpt: "Japanese insurers are the most likely next wave of GCC investors in Hyderabad. The anchor is already here. The sector follows anchors. Here is the full thesis.",
          content: `<p>Japan has the world's largest life insurance market by assets. The country's major insurers manage portfolios that rival the GDP of mid-sized economies, and they are all running the same challenge: how do you digitise actuarial operations, modernise claims systems, and build data analytics capabilities at scale, when domestic talent is expensive and increasingly scarce?</p>

<p>The answer, for a growing number of Japanese insurers, is Hyderabad.</p>

<h3>Why Insurance First</h3>

<p>Insurance is analytically intensive in ways that map directly onto what Indian talent does well. Actuarial modelling, claims data processing, underwriting analytics, risk modelling, regulatory reporting, and digital customer experience are all functions with deep talent availability in Hyderabad. The cost arbitrage versus Tokyo or Osaka operations is significant, and the quality benchmark, particularly in quantitative and data roles, is high.</p>

<p>Japanese insurers have been watching peer behaviour closely. The follow-the-leader dynamic in this sector is strong. When one major insurer demonstrates a successful Hyderabad GCC model, with visible headcount growth and measurable output quality, the ringi process at peers becomes easier to complete. The first mover creates the evidence package that subsequent movers need.</p>

<h3>The Agglomeration Logic</h3>

<p>Hyderabad's Financial District already has a functioning BFSI cluster. The talent, infrastructure, and regulatory familiarity built up by existing GCCs create a lower-friction entry point for new entrants in the same sector. A Japanese insurer arriving in Hyderabad today is not pioneering from scratch. They are joining a cluster.</p>

<h3>The 60% Gap</h3>

<p>Approximately 60 percent of Forbes Global 2000 Japanese companies have not yet established a GCC in India. For the insurance sector specifically, the gap between the scale of Japanese insurers and their current India GCC footprint is large. That gap is an opportunity. It is closing.</p>

<p>Pithonix is tracking the Japan-Telangana corridor with a focus on the insurance and financial services segment. The window for Telangana to position as the preferred destination for this wave is open now.</p>`,
          linkedin_copy: `Japan's insurance sector is the next major GCC wave for Hyderabad. The logic is clear.

Japan has the world's largest life insurance market by assets. Every major insurer is running the same challenge: how do you digitise actuarial operations and build data analytics capability at scale when domestic talent is scarce and expensive?

Why Hyderabad wins this:
- Deep actuarial and data talent already in residence
- Financial District cluster creates lower-friction entry
- Follow-the-leader behavior means one anchor converts to sector wave
- 60% of Forbes Global 2000 Japanese companies have not yet entered India

The anchor is here. The ringi clocks are running at sector peers.

Pithonix is tracking this corridor.

#GCCIndia #HyderabadGCC #Telangana #TelanganaRising #GCCEra #GCCPulse #GCCRise #JapanIndia #Insurance #GlobalCapabilityCentre #GCCPros`,
          tags: ['Japan', 'Insurance', 'BFSI', 'Hyderabad', 'GCC', 'Corridor Intelligence']
        },
        {
          title: "The Sogo Shosha Opportunity: Japanese Trading Houses and the India GCC Case",
          slug: "sogo-shosha-gcc-india",
          excerpt: "Japan's sogo shosha are among the most globally diversified companies in the world. Their India GCC story is only beginning. Here is why the trading house corridor matters for Telangana.",
          content: `<p>The sogo shosha, Japan's general trading companies, are among the most structurally interesting organisations in the global economy. They operate across commodities, infrastructure, finance, logistics, retail, and technology. They have significant commercial investments in India. And their shared services and analytics infrastructure in India is, in most cases, underdeveloped relative to the scale of their India exposure.</p>

<h3>What Sogo Shosha Actually Do</h3>

<p>These are not simple trading intermediaries. The major Japanese trading houses have evolved into diversified holding companies with investments spanning energy, food, metals, infrastructure, chemicals, and financial services. Managing this complexity requires significant analytical and operational capability.</p>

<p>The functions that translate most naturally to a Hyderabad GCC are commodity analytics and market intelligence, supply chain optimisation and logistics analytics, shared financial services across portfolio companies, sustainability and ESG reporting, and digital transformation support for portfolio investments in India.</p>

<h3>The India Angle</h3>

<p>Japan's trading houses have been investing in India for decades. Infrastructure projects, energy investments, agricultural value chains, logistics networks. This creates an existing India management and commercial presence that a GCC can serve directly.</p>

<p>The opportunity is to consolidate what is currently distributed across portfolio companies into a structured shared services and analytics centre. Rather than each India investment running its own support functions, a GCC creates a common platform. The cost and quality case is straightforward.</p>

<h3>The Decision Dynamics</h3>

<p>Trading house decisions on GCCs are typically driven by their corporate digital transformation programs rather than individual business unit demand. The key engagement is at the group level, not the subsidiary. Hyderabad's positioning as a technology and analytics hub, combined with the existing depth of Japan-India business relationships, makes it a strong candidate.</p>

<p>Pithonix is tracking the sogo shosha segment as part of the Japan-Telangana Corridor Intelligence Brief. This segment represents a long-cycle but high-conviction opportunity for Telangana's GCC promotion strategy.</p>`,
          linkedin_copy: `Japan's sogo shosha - the giant general trading houses - are an overlooked GCC opportunity for Hyderabad.

These are not simple trading companies. They operate across commodities, infrastructure, finance, logistics, and technology, with significant India investments already in place.

The GCC case is straightforward:
- Commodity analytics and market intelligence
- Supply chain optimisation across India portfolio investments
- Shared financial services for India subsidiaries
- Digital transformation support for Indian portfolio companies

The India presence is already there. The GCC infrastructure to serve it is not.

Pithonix is tracking this corridor.

#GCCIndia #HyderabadGCC #Telangana #TelanganaRising #GCCEra #GCCGroup #GCCRise #JapanIndia #GlobalCapabilityCentre #GCCPros #SupplyChain`,
          tags: ['Japan', 'Sogo Shosha', 'Trading', 'GCC Strategy', 'Corridor Intelligence']
        }
      ];
      let inserted = 0;
      for (const p of SEED_POSTS) {
        try {
          await client.query(
            `INSERT INTO gcc_blog_posts (title,slug,excerpt,content,linkedin_copy,tags,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (slug) DO NOTHING`,
            [p.title, p.slug, p.excerpt, p.content, p.linkedin_copy, p.tags, session.email]
          );
          inserted++;
        } catch(e) { /* skip conflicts */ }
      }
      return res.status(200).json({ ok: true, inserted });
    }

    res.status(400).json({ error: 'Invalid action' });

  } catch (e) {
    console.error('gcc-admin error:', e.message);
    res.status(500).json({ error: 'Request failed' });
  } finally {
    client.release();
  }
}
